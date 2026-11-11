package com.safetrace.mapper;

import com.safetrace.domain.Department;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface DepartmentMapper {

    List<Department> findAll();
}
