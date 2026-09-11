package com.safetrace.external;

/**
 * 기상청 단기예보 API는 위경도가 아니라 5km*5km 격자 좌표(nx, ny)로 지점을 지정한다.
 * 위경도 -> 격자좌표 변환은 기상청이 공개한 람베르트 정각원추도법(LCC) 공식을 그대로 옮긴 것.
 * (기상청 "기상자료개방포털"에 공개된 GPS-격자 변환 소스코드 기준. 상수값을 임의로 바꾸면 안 됨.)
 */
public class KmaGridConverter {

    private static final double RE = 6371.00877;   // 지구 반경(km)
    private static final double GRID = 5.0;         // 격자 간격(km)
    private static final double SLAT1 = 30.0;       // 투영 위도1(deg)
    private static final double SLAT2 = 60.0;       // 투영 위도2(deg)
    private static final double OLON = 126.0;       // 기준점 경도(deg)
    private static final double OLAT = 38.0;        // 기준점 위도(deg)
    private static final double XO = 43;            // 기준점 X좌표(GRID)
    private static final double YO = 136;           // 기준점 Y좌표(GRID)

    public record Grid(int nx, int ny) {}

    public static Grid toGrid(double lat, double lon) {
        double degrad = Math.PI / 180.0;

        double re = RE / GRID;
        double slat1 = SLAT1 * degrad;
        double slat2 = SLAT2 * degrad;
        double olon = OLON * degrad;
        double olat = OLAT * degrad;

        double sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
        sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
        double sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
        sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
        double ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
        ro = re * sf / Math.pow(ro, sn);

        double ra = Math.tan(Math.PI * 0.25 + lat * degrad * 0.5);
        ra = re * sf / Math.pow(ra, sn);
        double theta = lon * degrad - olon;
        if (theta > Math.PI) theta -= 2.0 * Math.PI;
        if (theta < -Math.PI) theta += 2.0 * Math.PI;
        theta *= sn;

        int nx = (int) (ra * Math.sin(theta) + XO + 0.5);
        int ny = (int) (ro - ra * Math.cos(theta) + YO + 0.5);

        return new Grid(nx, ny);
    }
}