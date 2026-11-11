package com.safetrace.controller;

import com.safetrace.domain.Department;
import com.safetrace.service.ResourceQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final ResourceQueryService resourceQueryService;

    // 자원을 요청할 때 대상 부서를 고르는 용도 - 담당 직원과 자원 관리자만
    @GetMapping
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    public List<Department> getDepartments() {
        return resourceQueryService.getDepartments();
    }
}
