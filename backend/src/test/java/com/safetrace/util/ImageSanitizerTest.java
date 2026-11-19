package com.safetrace.util;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageSanitizerTest {

    private static final String GPS = "GPS_37.5665N_126.9780E";

    // ---- JPEG ---------------------------------------------------------------

    @Test
    void JPEG의_EXIF_위치정보와_주석은_지워지고_화질은_그대로다() throws IOException {
        byte[] original = jpeg();
        byte[] withMeta = insertAfterSoi(original,
                jpegSegment(0xE1, concat("Exif\0\0".getBytes(StandardCharsets.ISO_8859_1), GPS.getBytes())),
                jpegSegment(0xE1, concat("http://ns.adobe.com/xap/1.0/\0".getBytes(), ("<x:xmpmeta>" + GPS + "</x:xmpmeta>").getBytes())),
                jpegSegment(0xED, ("Photoshop 3.0\0" + GPS).getBytes()),
                jpegSegment(0xFE, ("comment " + GPS).getBytes()));
        assertTrue(contains(withMeta, GPS));

        ImageSanitizer.Result result = ImageSanitizer.sanitize(withMeta);

        assertEquals(".jpg", result.extension());
        assertFalse(contains(result.data(), "GPS_"));
        assertFalse(contains(result.data(), "Exif"));
        assertFalse(contains(result.data(), "xmpmeta"));
        assertSamePixels(original, result.data());
    }

    @Test
    void JPEG의_회전_정보만_남기고_나머지_EXIF는_지운다() throws IOException {
        byte[] original = jpeg();
        byte[] withExif = insertAfterSoi(original, jpegSegment(0xE1, exifWithOrientation(6, GPS)));
        assertTrue(contains(withExif, GPS));

        byte[] cleaned = ImageSanitizer.sanitize(withExif).data();

        assertFalse(contains(cleaned, "GPS_"));
        assertTrue(contains(cleaned, "Exif"));
        assertEquals(6, orientationOf(cleaned));
        assertSamePixels(original, cleaned);
    }

    @Test
    void 회전_정보가_없거나_정상값이_아니면_EXIF를_남기지_않는다() throws IOException {
        byte[] noOrientation = insertAfterSoi(jpeg(), jpegSegment(0xE1, exifWithOrientation(1, GPS)));
        byte[] outOfRange = insertAfterSoi(jpeg(), jpegSegment(0xE1, exifWithOrientation(99, GPS)));

        assertFalse(contains(ImageSanitizer.sanitize(noOrientation).data(), "Exif"));
        assertFalse(contains(ImageSanitizer.sanitize(outOfRange).data(), "Exif"));
    }

    @Test
    void JPEG_색상_프로필은_유지하고_그_외_APP_세그먼트는_지운다() throws IOException {
        byte[] withSegments = insertAfterSoi(jpeg(),
                jpegSegment(0xE2, concat("ICC_PROFILE\0".getBytes(), new byte[]{1, 1, 9, 9})),
                jpegSegment(0xE2, concat("MPF\0".getBytes(), GPS.getBytes())));

        byte[] cleaned = ImageSanitizer.sanitize(withSegments).data();

        assertTrue(contains(cleaned, "ICC_PROFILE"));
        assertFalse(contains(cleaned, "MPF"));
        assertFalse(contains(cleaned, "GPS_"));
    }

    @Test
    void JPEG_끝에_몰래_붙인_데이터는_버린다() throws IOException {
        byte[] original = jpeg();
        byte[] appended = concat(original, "TRAILING_SECRET".getBytes());

        byte[] cleaned = ImageSanitizer.sanitize(appended).data();

        assertFalse(contains(cleaned, "TRAILING_SECRET"));
        assertSamePixels(original, cleaned);
    }

    @Test
    void 이미_깨끗한_JPEG는_다시_처리해도_같다() throws IOException {
        byte[] once = ImageSanitizer.sanitize(insertAfterSoi(jpeg(), jpegSegment(0xFE, GPS.getBytes()))).data();

        assertArrayEquals(once, ImageSanitizer.sanitize(once).data());
    }

    // ---- PNG ----------------------------------------------------------------

    @Test
    void PNG의_텍스트와_EXIF_청크는_지워지고_화질은_그대로다() throws IOException {
        byte[] original = png();
        byte[] withMeta = insertPngChunksBeforeIdat(original,
                pngChunk("tEXt", ("Comment\0" + GPS).getBytes()),
                pngChunk("iTXt", ("XML:com.adobe.xmp\0\0\0\0\0" + GPS).getBytes()),
                pngChunk("eXIf", ("MM\0*" + GPS).getBytes()),
                pngChunk("tIME", new byte[]{7, (byte) 0xEA, 1, 1, 0, 0, 0}));
        assertTrue(contains(withMeta, GPS));

        ImageSanitizer.Result result = ImageSanitizer.sanitize(withMeta);

        assertEquals(".png", result.extension());
        assertFalse(contains(result.data(), "GPS_"));
        assertFalse(contains(result.data(), "tEXt"));
        assertFalse(contains(result.data(), "eXIf"));
        assertFalse(contains(result.data(), "tIME"));
        assertTrue(contains(result.data(), "IDAT"));
        assertSamePixels(original, result.data());
    }

    @Test
    void PNG_끝에_붙은_데이터는_버린다() throws IOException {
        byte[] original = png();

        byte[] cleaned = ImageSanitizer.sanitize(concat(original, "TRAILING_SECRET".getBytes())).data();

        assertFalse(contains(cleaned, "TRAILING_SECRET"));
        assertSamePixels(original, cleaned);
    }

    @Test
    void PNG_청크가_손상되었으면_거절한다() throws IOException {
        byte[] broken = png();
        broken[broken.length / 2] ^= 0x5A; // IDAT 중간을 건드려 CRC가 맞지 않게 만든다

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(broken));
    }

    @Test
    void PNG가_중간에서_잘렸으면_거절한다() throws IOException {
        byte[] original = png();
        byte[] truncated = java.util.Arrays.copyOf(original, original.length - 20);

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(truncated));
    }

    // ---- GIF ----------------------------------------------------------------

    @Test
    void GIF의_주석_블록은_지워지고_이미지는_그대로다() throws IOException {
        byte[] original = gif();
        byte[] comment = concat(new byte[]{0x21, (byte) 0xFE, (byte) GPS.length()}, concat(GPS.getBytes(), new byte[]{0}));
        byte[] withComment = insertBeforeLastByte(original, comment);
        assertTrue(contains(withComment, GPS));

        ImageSanitizer.Result result = ImageSanitizer.sanitize(withComment);

        assertEquals(".gif", result.extension());
        assertFalse(contains(result.data(), "GPS_"));
        assertSamePixels(original, result.data());
    }

    @Test
    void GIF_헤더만_있고_이미지가_없으면_거절한다() {
        byte[] header = "GIF89a".getBytes(StandardCharsets.ISO_8859_1);
        byte[] onlyHeader = concat(header, new byte[]{1, 0, 1, 0, 0, 0, 0, 0x3B});

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(onlyHeader));
    }

    // ---- WebP ---------------------------------------------------------------

    @Test
    void WebP의_EXIF와_XMP_청크는_지워지고_파일_크기_정보가_다시_맞춰진다() {
        byte[] vp8x = {0x08 | 0x04 | 0x10, 0, 0, 0, 1, 0, 0, 1, 0, 0}; // EXIF + XMP + 알파 플래그
        byte[] webp = riff(
                webpChunk("VP8X", vp8x),
                webpChunk("ALPH", new byte[]{1, 2, 3}),
                webpChunk("VP8 ", new byte[]{9, 9, 9, 9}),
                webpChunk("EXIF", ("MM\0*" + GPS).getBytes()),
                webpChunk("XMP ", ("<x:xmpmeta>" + GPS + "</x:xmpmeta>").getBytes()));
        assertTrue(contains(webp, GPS));

        ImageSanitizer.Result result = ImageSanitizer.sanitize(webp);
        byte[] cleaned = result.data();

        assertEquals(".webp", result.extension());
        assertFalse(contains(cleaned, "GPS_"));
        assertFalse(contains(cleaned, "EXIF"));
        assertFalse(contains(cleaned, "XMP "));
        assertTrue(contains(cleaned, "ALPH"));
        assertTrue(contains(cleaned, "VP8 "));
        // RIFF 크기 = 전체 길이 - 8
        long declared = (cleaned[4] & 0xFFL) | (cleaned[5] & 0xFFL) << 8 | (cleaned[6] & 0xFFL) << 16 | (cleaned[7] & 0xFFL) << 24;
        assertEquals(cleaned.length - 8, declared);
        // VP8X 플래그: EXIF(0x08), XMP(0x04)는 꺼지고 알파(0x10)는 유지
        assertEquals(0x10, cleaned[20] & 0xFF);
    }

    @Test
    void WebP_RIFF_크기가_실제보다_크면_거절한다() {
        byte[] webp = riff(webpChunk("VP8 ", new byte[]{9, 9, 9, 9}));
        webp[4] = (byte) 0xFF;
        webp[5] = (byte) 0xFF;

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(webp));
    }

    // ---- 이미지가 아닌 파일 ---------------------------------------------------

    @Test
    void 확장자만_이미지이고_내용이_다르면_거절한다() {
        assertThrows(IllegalArgumentException.class,
                () -> ImageSanitizer.sanitize("<html><script>alert(1)</script></html>".getBytes()));
        assertThrows(IllegalArgumentException.class,
                () -> ImageSanitizer.sanitize("<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>".getBytes()));
        assertThrows(IllegalArgumentException.class,
                () -> ImageSanitizer.sanitize(new byte[]{'M', 'Z', (byte) 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, (byte) 0xFF, (byte) 0xFF}));
        assertThrows(IllegalArgumentException.class,
                () -> ImageSanitizer.sanitize("plain text file contents".getBytes()));
    }

    @Test
    void 비어_있거나_너무_짧으면_거절한다() {
        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(null));
        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(new byte[0]));
        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}));
    }

    @Test
    void JPEG_머리글자만_있고_이미지_구조가_없으면_거절한다() {
        byte[] fake = new byte[64];
        fake[0] = (byte) 0xFF;
        fake[1] = (byte) 0xD8;
        fake[2] = (byte) 0xFF;
        fake[3] = (byte) 0xE0;
        fake[4] = 0x7F; // 세그먼트 길이가 파일 크기를 벗어남
        fake[5] = (byte) 0xFF;

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(fake));
    }

    @Test
    void JPEG_머리글자_뒤에_엉뚱한_내용이면_거절한다() {
        byte[] fake = concat(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, "not really a jpeg at all".getBytes());

        assertThrows(IllegalArgumentException.class, () -> ImageSanitizer.sanitize(fake));
    }

    // ---- 테스트용 파일 만들기 ---------------------------------------------------

    private static BufferedImage sample() {
        BufferedImage image = new BufferedImage(24, 16, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                image.setRGB(x, y, (x * 10) << 16 | (y * 15) << 8 | ((x + y) * 5));
            }
        }
        return image;
    }

    private static byte[] encode(String format, BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    private static byte[] jpeg() throws IOException {
        return encode("jpg", sample());
    }

    private static byte[] png() throws IOException {
        return encode("png", sample());
    }

    private static byte[] gif() throws IOException {
        return encode("gif", sample());
    }

    private static void assertSamePixels(byte[] expected, byte[] actual) throws IOException {
        BufferedImage a = ImageIO.read(new ByteArrayInputStream(expected));
        BufferedImage b = ImageIO.read(new ByteArrayInputStream(actual));
        assertEquals(a.getWidth(), b.getWidth());
        assertEquals(a.getHeight(), b.getHeight());
        for (int y = 0; y < a.getHeight(); y++) {
            for (int x = 0; x < a.getWidth(); x++) {
                assertEquals(a.getRGB(x, y), b.getRGB(x, y));
            }
        }
    }

    private static byte[] jpegSegment(int marker, byte[] data) {
        int length = data.length + 2;
        byte[] segment = new byte[data.length + 4];
        segment[0] = (byte) 0xFF;
        segment[1] = (byte) marker;
        segment[2] = (byte) (length >> 8);
        segment[3] = (byte) length;
        System.arraycopy(data, 0, segment, 4, data.length);
        return segment;
    }

    // 빅엔디안 EXIF: orientation 항목 + GPS 문자열을 담은 ImageDescription 항목
    private static byte[] exifWithOrientation(int orientation, String description) {
        byte[] text = (description + "\0").getBytes(StandardCharsets.US_ASCII);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(new byte[]{'E', 'x', 'i', 'f', 0, 0, 'M', 'M', 0, 0x2A, 0, 0, 0, 8});
        out.writeBytes(new byte[]{0, 2});
        out.writeBytes(new byte[]{0x01, 0x0E, 0, 2, 0, 0, 0, (byte) text.length, 0, 0, 0, 38}); // ImageDescription (오프셋 38)
        out.writeBytes(new byte[]{0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, (byte) orientation, 0, 0});
        out.writeBytes(new byte[]{0, 0, 0, 0});
        out.writeBytes(text);
        return out.toByteArray();
    }

    // 출력 JPEG에서 orientation 값을 찾는다 (우리가 만든 최소 EXIF 구조 기준)
    private static int orientationOf(byte[] jpeg) {
        byte[] pattern = {0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, 0x00};
        for (int i = 0; i + pattern.length < jpeg.length; i++) {
            boolean match = true;
            for (int n = 0; n < pattern.length; n++) {
                if (jpeg[i + n] != pattern[n]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return jpeg[i + pattern.length] & 0xFF;
            }
        }
        return 0;
    }

    private static byte[] insertAfterSoi(byte[] jpeg, byte[]... segments) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        for (byte[] segment : segments) {
            out.writeBytes(segment);
        }
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private static byte[] insertBeforeLastByte(byte[] data, byte[] extra) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(data, 0, data.length - 1);
        out.writeBytes(extra);
        out.write(data[data.length - 1]);
        return out.toByteArray();
    }

    private static byte[] pngChunk(String type, byte[] data) {
        byte[] typeBytes = type.getBytes(StandardCharsets.US_ASCII);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(int32(data.length));
        out.writeBytes(typeBytes);
        out.writeBytes(data);
        out.writeBytes(int32(crc.getValue()));
        return out.toByteArray();
    }

    private static byte[] insertPngChunksBeforeIdat(byte[] png, byte[]... chunks) {
        int idat = indexOf(png, "IDAT") - 4; // 길이 필드 시작 위치
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(png, 0, idat);
        for (byte[] chunk : chunks) {
            out.writeBytes(chunk);
        }
        out.write(png, idat, png.length - idat);
        return out.toByteArray();
    }

    private static byte[] webpChunk(String type, byte[] data) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes(type.getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(int32Little(data.length));
        out.writeBytes(data);
        if (data.length % 2 == 1) {
            out.write(0);
        }
        return out.toByteArray();
    }

    private static byte[] riff(byte[]... chunks) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.writeBytes("WEBP".getBytes(StandardCharsets.US_ASCII));
        for (byte[] chunk : chunks) {
            body.writeBytes(chunk);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.writeBytes("RIFF".getBytes(StandardCharsets.US_ASCII));
        out.writeBytes(int32Little(body.size()));
        out.writeBytes(body.toByteArray());
        return out.toByteArray();
    }

    private static byte[] int32(long value) {
        return new byte[]{(byte) (value >> 24), (byte) (value >> 16), (byte) (value >> 8), (byte) value};
    }

    private static byte[] int32Little(long value) {
        return new byte[]{(byte) value, (byte) (value >> 8), (byte) (value >> 16), (byte) (value >> 24)};
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
    }

    private static boolean contains(byte[] data, String text) {
        return indexOf(data, text) >= 0;
    }

    private static int indexOf(byte[] data, String text) {
        byte[] needle = text.getBytes(StandardCharsets.ISO_8859_1);
        for (int i = 0; i + needle.length <= data.length; i++) {
            int n = 0;
            while (n < needle.length && data[i + n] == needle[n]) {
                n++;
            }
            if (n == needle.length) {
                return i;
            }
        }
        return -1;
    }
}
