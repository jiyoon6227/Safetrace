package com.safetrace.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

// 현장제보에 첨부하는 사진을 서버 로컬 디스크(uploadDir)에 저장하고,
// 브라우저에서 바로 열어볼 수 있는 URL(/uploads/파일명)을 돌려준다.
// 실제 파일 서빙은 WebConfig의 addResourceHandlers가 처리.
//
// 주의: transferTo()에 상대경로를 그대로 넘기면 Tomcat이 자기 내부 임시
// 작업폴더 기준으로 다시 해석해버려서 "경로를 찾을 수 없음" 에러가 남.
// 그래서 절대경로로 바꾼 뒤, transferTo() 대신 스트림을 직접 복사한다.
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    @Value("${app.upload-dir}")
    private String uploadDir;

    // 재난 제보/사건 등록용 사진 업로드라 이미지만 받는다. 이게 없으면 .html/.js/.exe 등
    // 어떤 파일이든 올려서 /uploads/**(WebConfig에서 정적 리소스로 그대로 서빙)를 통해
    // 우리 도메인에서 그대로 열리게 만들 수 있다 - 확장자와 실제 Content-Type을 둘 다 검사한다.
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