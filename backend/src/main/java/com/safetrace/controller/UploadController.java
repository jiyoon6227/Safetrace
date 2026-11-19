package com.safetrace.controller;

import com.safetrace.util.ImageSanitizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

// 현장 사진을 로컬 디스크(uploadDir)에 저장 후 /uploads/파일명 URL 반환 (서빙은 WebConfig)
//
// 업로드 경로는 절대경로로 변환 후 저장 (상대경로를 transferTo에 넘기면 Tomcat 임시폴더 기준으로 해석됨)
// 확장자·Content-Type은 사용자가 마음대로 보낼 수 있으므로, 파일 내용으로 실제 이미지인지 다시 확인하고
// 촬영 위치(GPS) 같은 메타데이터를 지운 파일만 저장한다. 저장 확장자도 확인된 실제 형식을 따른다.
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    @Value("${app.upload-dir}")
    private String uploadDir;

    // 이미지 파일만 허용, 확장자와 Content-Type 모두 검사 (/uploads/**로 그대로 서빙되므로 임의 파일 차단)
    private static final java.util.Set<String> ALLOWED_EXTENSIONS =
            java.util.Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp");
    private static final java.util.Set<String> ALLOWED_CONTENT_TYPES =
            java.util.Set.of("image/jpeg", "image/png", "image/gif", "image/webp");

    @PostMapping
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어 있습니다.");
        }

        String original = file.getOriginalFilename();
        String ext = (original != null && original.contains("."))
                ? original.substring(original.lastIndexOf('.')).toLowerCase()
                : "";

        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("이미지 파일(jpg, jpeg, png, gif, webp)만 업로드할 수 있습니다.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다.");
        }

        ImageSanitizer.Result image = ImageSanitizer.sanitize(file.getBytes());
        String savedName = UUID.randomUUID() + image.extension();

        Path dirPath = Path.of(uploadDir).toAbsolutePath();
        Files.createDirectories(dirPath);
        Path target = dirPath.resolve(savedName);

        Files.write(target, image.data());

        return Map.of("url", "/uploads/" + savedName);
    }
}