package com.safetrace.mapper;

import com.safetrace.domain.Notice;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface NoticeMapper {

    List<Notice> findAll();

    Notice findById(@Param("noticeId") Long noticeId);

    void insert(Notice notice);

    void update(Notice notice);

    void delete(@Param("noticeId") Long noticeId);

    void increaseViewCount(@Param("noticeId") Long noticeId);
}
