package com.safetrace.util;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.zip.CRC32;

// 업로드된 이미지의 실제 형식을 파일 내용(매직바이트)으로 확인하고, 촬영 위치(GPS)·기기 정보 같은 메타데이터를 지운다.
// 화질이 바뀌지 않도록 이미지를 다시 인코딩하지 않고, 파일 구조에서 메타데이터 부분만 건너뛰고 복사한다.
//  - JPEG: EXIF/XMP/IPTC/주석 제거 (사진 회전 정보인 orientation 값만 남김)
//  - PNG : 텍스트·EXIF·시간 청크 제거
//  - GIF : 주석·텍스트·기타 확장 블록 제거 (애니메이션 반복 정보는 유지)
//  - WebP: EXIF/XMP 청크 제거
public final class ImageSanitizer {

    public record Result(String extension, byte[] data) {}

    private static final String INVALID = "올바른 이미지 파일이 아닙니다. (jpg, png, gif, webp만 가능)";

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final Set<String> PNG_KEEP = Set.of(
            "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "bKGD", "pHYs", "hIST",
            "acTL", "fcTL", "fdAT");
    private static final Set<String> WEBP_KEEP = Set.of("VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP");

    private ImageSanitizer() {}

    public static Result sanitize(byte[] data) {
        if (data == null || data.length < 12) {
            throw new IllegalArgumentException(INVALID);
        }
        try {
            return strip(data);
        } catch (IndexOutOfBoundsException e) {
            // 파일 구조가 깨져서 길이 정보가 파일 크기를 벗어난 경우
            throw new IllegalArgumentException(INVALID);
        }
    }

    private static Result strip(byte[] data) {
        if (startsWith(data, (byte) 0xFF, (byte) 0xD8, (byte) 0xFF)) {
            return new Result(".jpg", stripJpeg(data));
        }
        if (startsWith(data, PNG_SIGNATURE)) {
            return new Result(".png", stripPng(data));
        }
        if (ascii(data, 0, 6).equals("GIF87a") || ascii(data, 0, 6).equals("GIF89a")) {
            return new Result(".gif", stripGif(data));
        }
        if (ascii(data, 0, 4).equals("RIFF") && ascii(data, 8, 4).equals("WEBP")) {
            return new Result(".webp", stripWebp(data));
        }
        throw new IllegalArgumentException(INVALID);
    }

    // ---- JPEG ---------------------------------------------------------------

    private static byte[] stripJpeg(byte[] d) {
        int orientation = findJpegOrientation(d);
        ByteArrayOutputStream out = new ByteArrayOutputStream(d.length);
        out.write(0xFF);
        out.write(0xD8);

        boolean orientationWritten = orientation < 2;
        boolean sawFrame = false;
        boolean sawScan = false;
        int i = 2;

        while (i < d.length) {
            if (u8(d, i) != 0xFF) {
                throw new IllegalArgumentException(INVALID);
            }
            while (i < d.length && u8(d, i) == 0xFF) {
                i++; // 마커 앞의 채움 바이트
            }
            if (i >= d.length) {
                break;
            }
            int marker = u8(d, i++);

            if (marker == 0xD9) {
                break; // EOI 뒤에 붙은 데이터는 버린다
            }
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                continue; // 길이가 없는 마커
            }
            if (i + 2 > d.length) {
                throw new IllegalArgumentException(INVALID);
            }
            int length = u16(d, i);
            if (length < 2 || i + length > d.length) {
                throw new IllegalArgumentException(INVALID);
            }
            int segmentEnd = i + length;

            // 맨 앞의 JFIF(APP0) 다음 자리에 회전 정보만 담은 EXIF를 넣는다
            if (!orientationWritten && marker != 0xE0) {
                writeOrientationSegment(out, orientation);
                orientationWritten = true;
            }

            if (isFrameMarker(marker)) {
                sawFrame = true;
            }
            if (marker == 0xDA) {
                // 스캔 헤더 + 압축된 이미지 데이터. 다음 마커가 나올 때까지 그대로 복사
                int scanEnd = skipEntropyData(d, segmentEnd);
                writeMarker(out, marker);
                out.write(d, i, scanEnd - i);
                sawScan = true;
                i = scanEnd;
                continue;
            }
            if (keepJpegSegment(marker, d, i + 2, segmentEnd)) {
                writeMarker(out, marker);
                out.write(d, i, length);
            }
            i = segmentEnd;
        }

        if (!sawFrame || !sawScan) {
            throw new IllegalArgumentException(INVALID);
        }
        // EOI 없이 잘린 파일도 브라우저는 보여주므로, 끝만 닫아서 저장
        writeMarker(out, 0xD9);
        return out.toByteArray();
    }

    // 유지할 JPEG 세그먼트: JFIF(APP0), Adobe(APP14), 색상 프로필(APP2 ICC), 그리고 이미지 구조 세그먼트(DQT/DHT/SOF 등)
    private static boolean keepJpegSegment(int marker, byte[] d, int dataStart, int end) {
        if (marker == 0xE0 || marker == 0xEE) {
            return true;
        }
        if (marker == 0xE2) {
            return ascii(d, dataStart, Math.min(11, end - dataStart)).equals("ICC_PROFILE");
        }
        // APP1(EXIF/XMP), APP3~APP13, APP15, 주석(COM)은 제거
        return !((marker >= 0xE1 && marker <= 0xEF) || marker == 0xFE);
    }

    private static boolean isFrameMarker(int marker) {
        return marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
    }

    // SOS 헤더 뒤의 압축 데이터 끝(다음 마커 위치)을 찾는다. 0xFF00(채움)과 RSTn은 데이터의 일부
    private static int skipEntropyData(byte[] d, int from) {
        int i = from;
        while (i < d.length) {
            if (u8(d, i) == 0xFF && i + 1 < d.length) {
                int next = u8(d, i + 1);
                if (next == 0x00 || (next >= 0xD0 && next <= 0xD7)) {
                    i += 2;
                    continue;
                }
                if (next == 0xFF) {
                    i++;
                    continue;
                }
                return i;
            }
            i++;
        }
        return d.length;
    }

    // EXIF(APP1)에서 orientation(1~8)만 읽는다. 없거나 이상하면 0
    private static int findJpegOrientation(byte[] d) {
        int i = 2;
        while (i + 4 <= d.length && u8(d, i) == 0xFF) {
            int marker = u8(d, i + 1);
            if (marker == 0xDA || marker == 0xD9) {
                return 0;
            }
            int length = u16(d, i + 2);
            if (length < 2 || i + 2 + length > d.length) {
                return 0;
            }
            if (marker == 0xE1) {
                int value = readOrientation(d, i + 4, i + 2 + length);
                if (value != 0) {
                    return value;
                }
            }
            i += 2 + length;
        }
        return 0;
    }

    private static int readOrientation(byte[] d, int start, int end) {
        // "Exif\0\0" + TIFF 헤더(바이트 순서 2 + 42 + IFD0 오프셋 4)
        if (end - start < 14 || !ascii(d, start, 4).equals("Exif")) {
            return 0;
        }
        int tiff = start + 6;
        boolean little = d[tiff] == 'I' && d[tiff + 1] == 'I';
        if (!little && !(d[tiff] == 'M' && d[tiff + 1] == 'M')) {
            return 0;
        }
        long ifd = u32(d, tiff + 4, little);
        long entriesAt = tiff + ifd;
        if (ifd < 8 || entriesAt + 2 > end) {
            return 0;
        }
        int count = u16(d, (int) entriesAt, little);
        for (int n = 0; n < count; n++) {
            long entry = entriesAt + 2 + 12L * n;
            if (entry + 12 > end) {
                return 0;
            }
            if (u16(d, (int) entry, little) == 0x0112) {
                int value = u16(d, (int) entry + 8, little);
                return value >= 2 && value <= 8 ? value : 0;
            }
        }
        return 0;
    }

    private static void writeOrientationSegment(ByteArrayOutputStream out, int orientation) {
        byte[] exif = {
                'E', 'x', 'i', 'f', 0, 0,
                'M', 'M', 0x00, 0x2A, 0, 0, 0, 8,   // TIFF 헤더, IFD0은 바로 다음
                0x00, 0x01,                         // 항목 1개
                0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, // orientation, SHORT, 개수 1
                0x00, (byte) orientation, 0, 0,     // 값
                0, 0, 0, 0                          // 다음 IFD 없음
        };
        writeMarker(out, 0xE1);
        out.write((exif.length + 2) >> 8);
        out.write((exif.length + 2) & 0xFF);
        out.write(exif, 0, exif.length);
    }

    private static void writeMarker(ByteArrayOutputStream out, int marker) {
        out.write(0xFF);
        out.write(marker);
    }

    // ---- PNG ----------------------------------------------------------------

    private static byte[] stripPng(byte[] d) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(d.length);
        out.write(d, 0, PNG_SIGNATURE.length);
        int i = PNG_SIGNATURE.length;
        boolean first = true;
        boolean sawData = false;

        while (i + 12 <= d.length) {
            long length = u32(d, i, false);
            String type = ascii(d, i + 4, 4);
            long chunkEnd = i + 12L + length;
            if (length > Integer.MAX_VALUE || chunkEnd > d.length) {
                throw new IllegalArgumentException(INVALID);
            }
            if (first && !type.equals("IHDR")) {
                throw new IllegalArgumentException(INVALID);
            }
            first = false;

            CRC32 crc = new CRC32();
            crc.update(d, i + 4, 4 + (int) length);
            if (crc.getValue() != u32(d, i + 8 + (int) length, false)) {
                throw new IllegalArgumentException(INVALID);
            }

            if (type.equals("IDAT")) {
                sawData = true;
            }
            if (PNG_KEEP.contains(type)) {
                out.write(d, i, (int) (chunkEnd - i));
            }
            i = (int) chunkEnd;
            if (type.equals("IEND")) {
                if (!sawData) {
                    throw new IllegalArgumentException(INVALID);
                }
                return out.toByteArray(); // IEND 뒤에 붙은 데이터는 버린다
            }
        }
        throw new IllegalArgumentException(INVALID);
    }

    // ---- GIF ----------------------------------------------------------------

    private static byte[] stripGif(byte[] d) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(d.length);
        // 헤더(6) + 화면 정보(7)
        if (d.length < 13) {
            throw new IllegalArgumentException(INVALID);
        }
        int packed = u8(d, 10);
        int i = 13;
        if ((packed & 0x80) != 0) {
            i += 3 * (1 << ((packed & 0x07) + 1)); // 전역 색상표
        }
        if (i > d.length) {
            throw new IllegalArgumentException(INVALID);
        }
        out.write(d, 0, i);

        boolean sawImage = false;
        while (i < d.length) {
            int block = u8(d, i);
            if (block == 0x3B) { // 끝
                if (!sawImage) {
                    throw new IllegalArgumentException(INVALID);
                }
                out.write(0x3B);
                return out.toByteArray();
            }
            if (block == 0x2C) { // 이미지
                if (i + 10 > d.length) {
                    throw new IllegalArgumentException(INVALID);
                }
                int imagePacked = u8(d, i + 9);
                int end = i + 10;
                if ((imagePacked & 0x80) != 0) {
                    end += 3 * (1 << ((imagePacked & 0x07) + 1)); // 지역 색상표
                }
                end += 1; // LZW 최소 코드 크기
                end = skipGifSubBlocks(d, end);
                out.write(d, i, end - i);
                sawImage = true;
                i = end;
            } else if (block == 0x21) { // 확장 블록
                if (i + 2 > d.length) {
                    throw new IllegalArgumentException(INVALID);
                }
                int label = u8(d, i + 1);
                int end = skipGifSubBlocks(d, i + 2);
                // 투명도·프레임 간격(0xF9)과 반복 정보(NETSCAPE/ANIMEXTS)만 유지
                if (label == 0xF9 || (label == 0xFF && isLoopExtension(d, i))) {
                    out.write(d, i, end - i);
                }
                i = end;
            } else {
                throw new IllegalArgumentException(INVALID);
            }
        }
        throw new IllegalArgumentException(INVALID);
    }

    private static boolean isLoopExtension(byte[] d, int at) {
        if (at + 14 > d.length || u8(d, at + 2) != 11) {
            return false;
        }
        String id = ascii(d, at + 3, 11);
        return id.equals("NETSCAPE2.0") || id.equals("ANIMEXTS1.0");
    }

    // 서브블록(길이 1바이트 + 데이터)이 0길이로 끝날 때까지 건너뛴 위치를 돌려준다
    private static int skipGifSubBlocks(byte[] d, int from) {
        int i = from;
        while (i < d.length) {
            int size = u8(d, i);
            i += 1 + size;
            if (size == 0) {
                return i;
            }
        }
        throw new IllegalArgumentException(INVALID);
    }

    // ---- WebP ---------------------------------------------------------------

    private static byte[] stripWebp(byte[] d) {
        long riffSize = u32(d, 4, true);
        if (riffSize < 4 || riffSize + 8 > d.length) {
            throw new IllegalArgumentException(INVALID);
        }
        int end = (int) riffSize + 8;
        ByteArrayOutputStream body = new ByteArrayOutputStream(d.length);
        int i = 12;
        boolean first = true;
        boolean sawImage = false;

        while (i + 8 <= end) {
            String type = ascii(d, i, 4);
            long size = u32(d, i + 4, true);
            long padded = size + (size & 1);
            if (i + 8 + padded > end) {
                throw new IllegalArgumentException(INVALID);
            }
            if (first && !(type.equals("VP8 ") || type.equals("VP8L") || type.equals("VP8X"))) {
                throw new IllegalArgumentException(INVALID);
            }
            first = false;

            if (type.equals("VP8 ") || type.equals("VP8L") || type.equals("ANMF")) {
                sawImage = true;
            }
            if (WEBP_KEEP.contains(type)) {
                byte[] chunk = java.util.Arrays.copyOfRange(d, i, i + 8 + (int) padded);
                if (type.equals("VP8X") && size >= 1) {
                    chunk[8] = (byte) (chunk[8] & ~0x0C); // 확장 플래그에서 EXIF(0x08), XMP(0x04) 표시를 끈다
                }
                body.write(chunk, 0, chunk.length);
            }
            i += 8 + (int) padded;
        }
        if (first || !sawImage) {
            throw new IllegalArgumentException(INVALID);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream(body.size() + 12);
        out.writeBytes("RIFF".getBytes(StandardCharsets.US_ASCII));
        long newSize = body.size() + 4L;
        out.write((int) (newSize & 0xFF));
        out.write((int) ((newSize >> 8) & 0xFF));
        out.write((int) ((newSize >> 16) & 0xFF));
        out.write((int) ((newSize >> 24) & 0xFF));
        out.writeBytes("WEBP".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(body.toByteArray());
        return out.toByteArray();
    }

    // ---- 바이트 읽기 도우미 -----------------------------------------------------

    private static boolean startsWith(byte[] d, byte... prefix) {
        if (d.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (d[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static String ascii(byte[] d, int from, int length) {
        if (from < 0 || length < 0 || from + length > d.length) {
            return "";
        }
        return new String(d, from, length, StandardCharsets.ISO_8859_1);
    }

    private static int u8(byte[] d, int i) {
        return d[i] & 0xFF;
    }

    private static int u16(byte[] d, int i) {
        return u16(d, i, false);
    }

    private static int u16(byte[] d, int i, boolean little) {
        int a = u8(d, i);
        int b = u8(d, i + 1);
        return little ? (b << 8) | a : (a << 8) | b;
    }

    private static long u32(byte[] d, int i, boolean little) {
        long value = 0;
        for (int n = 0; n < 4; n++) {
            int b = u8(d, little ? i + 3 - n : i + n);
            value = (value << 8) | b;
        }
        return value;
    }
}
