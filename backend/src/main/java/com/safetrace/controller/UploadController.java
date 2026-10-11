package com.safetrace.controller;

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
// 업로드 경로는 절대경로로 변환 후 스트림 복사 (상대경로를 transferTo에 넘기면 Tomcat 임시폴더 기준으로 해석됨)
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

        String savedName = UUID.randomUUID() + ext;

        Path dirPath = Path.of(uploadDir).toAbsolutePath();
        Files.createDirectories(dirPath);
        Path target = dirPath.resolve(savedName);

        try (var in = file.getInputStream()) {
            Files.copy(in, target);
        }

        return Map.of("url", "/uploads/" + savedName);
    }
}