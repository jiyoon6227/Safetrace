package com.safetrace.mapper;

import com.safetrace.domain.Notification;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface NotificationMapper {

    void insert(Notification notification);

    // 마이페이지 "최근 알림"용 - 최신순 최대 30건
    List<Notification> findByMemberId(@Param("memberId") Long memberId);

    // 단건 조회 - 삭제 전에 본인 알림이 맞는지 확인할 때 씀
    Notification findById(@Param("notificationId") Long notificationId);

    void delete(@Param("notificationId") Long notificationId);

    // 회원의 알림 전체 삭제 ("전체 삭제" 버튼용)
    void deleteAllByMemberId(@Param("memberId") Long memberId);
}