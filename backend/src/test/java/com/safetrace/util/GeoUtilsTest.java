package com.safetrace.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GeoUtilsTest {

    @Test
    void 같은_지점이면_거리는_0이다() {
        assertEquals(0.0, GeoUtils.distanceMeters(36.3504, 127.3845, 36.3504, 127.3845), 0.0001);
    }

    @Test
    void 대전시청과_서울시청_사이는_약_140km다() {
        double distance = GeoUtils.distanceMeters(36.3504, 127.3845, 37.5663, 126.9779);

        assertEquals(140_000, distance, 1_000);
    }

    @Test
    void 위도_0점001도_차이는_약_111m다() {
        double distance = GeoUtils.distanceMeters(36.3504, 127.3845, 36.3514, 127.3845);

        assertEquals(111.2, distance, 0.5);
    }
}
