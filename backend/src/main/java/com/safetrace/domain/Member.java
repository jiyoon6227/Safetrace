package com.safetrace.domain;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Member {
    private Long memberId;
    private String loginId;
    private String password;
    private String name;
    private String email;
    private String phone;
    private String profileImageUrl;
    private String address;
    private String addressDetail;
    private String role;
    private Long departmentId;
    private String departmentName; // SF_DEPARTMENT 조인 결과 (조회 전용, insert/update 시 안 씀)
    private String emailNotifyEnabled;
    private String disasterNotifyEnabled;
    private String reportNotifyEnabled;
    private String isWithdrawn;
    private LocalDateTime withdrawnAt;
    private LocalDateTime createdAt;
}