package com.safetrace.controller;

import com.safetrace.util.UploadUrlValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// 업로드 API가 파일 내용을 확인하고 위치 정보를 지운 파일만 저장하는지 확인한다 (Spring 컨텍스트 없이)
class UploadControllerTest {

    @TempDir
    Path uploadDir;

    private UploadController controller;

    @BeforeEach
    void setUp() {
        controller = new UploadController();
        ReflectionTestUtils.setField(controller, "uploadDir", uploadDir.toString());
    }

    private byte[] image(String format) throws IOException {
        BufferedImage image = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    // JPEG 맨 앞에 GPS 문구가 든 주석 세그먼트를 끼워 넣는다
    private byte[] jpegWithGps() throws IOException {
        byte[] jpeg = image("jpg");
        byte[] text = "GPS_37.5665N_126.9780E".getBytes(StandardCharsets.US_ASCII);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2);
        out.write(0xFF);
        out.write(0xFE);
        out.write((text.length + 2) >> 8);
        out.write((text.length + 2) & 0xFF);
        out.write(text);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    private long savedFileCount() throws IOException {
        try (Stream<Path> files = Files.list(uploadDir)) {
            return files.count();
        }
    }

    @Test
    void 위치_정보가_들어_있는_사진은_정보를_지운_파일로_저장된다() throws Exception {
        byte[] original = jpegWithGps();
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", original);

        Map<String, String> result = controller.upload(file);

        String url = result.get("url");
        assertTrue(UploadUrlValidator.isValid(url));
        assertTrue(url.endsWith(".jpg"));
        byte[] saved = Files.readAllBytes(uploadDir.resolve(url.substring("/uploads/".length())));
        assertFalse(new String(saved, StandardCharsets.ISO_8859_1).contains("GPS_"));
        assertTrue(saved.length > 0);
    }

    @Test
    void 저장_확장자는_사용자가_보낸_이름이_아니라_실제_형식을_따른다() throws Exception {
        // PNG 내용을 .jpg 이름과 image/jpeg로 보낸 경우
        MockMultipartFile file = new MockMultipartFile("file", "photo.jpg", "image/jpeg", image("png"));

        String url = controller.upload(file).get("url");

        assertTrue(url.endsWith(".png"));
        assertTrue(UploadUrlValidator.isValid(url));
    }

    @Test
    void 이미지가_아닌_내용은_확장자와_Content_Type이_이미지여도_저장하지_않는다() throws Exception {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);

        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo.jpg", "image/jpeg", html)));
        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo.png", "image/png", svg)));

        assertEquals(0, savedFileCount());
    }

    @Test
    void 확장자나_Content_Type이_이미지가_아니면_저장하지_않는다() throws Exception {
        byte[] jpeg = image("jpg");

        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo.html", "image/jpeg", jpeg)));
        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo", "image/jpeg", jpeg)));
        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo.jpg", "text/html", jpeg)));
        assertThrows(IllegalArgumentException.class,
                () -> controller.upload(new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[0])));

        assertEquals(0, savedFileCount());
    }

    @Test
    void 같은_사진을_두_번_올려도_서로_다른_파일명으로_저장된다() throws Exception {
        byte[] png = image("png");

        String first = controller.upload(new MockMultipartFile("file", "a.png", "image/png", png)).get("url");
        String second = controller.upload(new MockMultipartFile("file", "a.png", "image/png", png)).get("url");

        assertFalse(first.equals(second));
        assertEquals(2, savedFileCount());
    }
}
