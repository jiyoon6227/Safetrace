package com.safetrace.util;

/**
 * 위경도 좌표 사이의 거리 계산 유틸.
 * 하버사인 공식 사용 - 위경도는 구면 좌표라 단순 유클리드 거리로는 오차가 크기 때문.
 * 원래 IncidentService 안에 private 메서드로만 있던 걸, NotificationService(재난 알림
 * 반경 매칭)에서도 똑같이 필요해져서 공통 유틸로 분리함.
 */
public final class GeoUtils {

    private static final double EARTH_RADIUS_M = 6371000;

    private GeoUtils() {
    }

    public static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_M * c;
    }
}