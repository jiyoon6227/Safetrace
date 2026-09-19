package com.safetrace.service;

import com.safetrace.domain.MemberRegion;
import com.safetrace.mapper.MemberRegionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemberRegionService {

    private final MemberRegionMapper memberRegionMapper;

    public List<MemberRegion> getMyRegions(Long memberId) {
        return memberRegionMapper.findByMemberId(memberId);
    }

    // 관심지역 추가.
    // 새 지역을 대표지역으로 등록하는 경우 기존 대표지역을 먼저 해제해서
    // 한 회원에게 대표지역이 여러 개 생기지 않도록 한다.
    @Transactional
    public void addRegion(Long memberId, String regionName, Double latitude, Double longitude, String regionLabel, boolean isPrimary) {
        if (isPrimary) {
            memberRegionMapper.clearPrimary(memberId);
        }

        MemberRegion region = new MemberRegion();
        region.setMemberId(memberId);
        region.setRegionName(regionName);
        region.setLatitude(latitude);
        region.setLongitude(longitude);
        region.setRegionLabel(regionLabel == null || regionLabel.isBlank() ? "관심지역" : regionLabel);
        region.setIsPrimary(isPrimary ? "Y" : "N");
        memberRegionMapper.insert(region);
    }

    // 본인 소유 관심지역만 삭제 가능하도록 소유자 검증
    public void deleteRegion(Long memberRegionId, Long memberId) {
        boolean owns = memberRegionMapper.findByMemberId(memberId).stream()
                .anyMatch(r -> r.getMemberRegionId().equals(memberRegionId));
        if (!owns) {
            throw new IllegalArgumentException("본인의 관심지역만 삭제할 수 있습니다.");
        }
        memberRegionMapper.delete(memberRegionId);
    }

    // 대표 지역 변경 - 기존 대표를 전부 해제하고 선택한 지역 하나만 대표로 지정
    @Transactional
    public void setPrimaryRegion(Long memberRegionId, Long memberId) {
        boolean owns = memberRegionMapper.findByMemberId(memberId).stream()
                .anyMatch(r -> r.getMemberRegionId().equals(memberRegionId));
        if (!owns) {
            throw new IllegalArgumentException("본인의 관심지역만 대표로 지정할 수 있습니다.");
        }
        memberRegionMapper.clearPrimary(memberId);
        memberRegionMapper.setPrimary(memberRegionId);
    }
}