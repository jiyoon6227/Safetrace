import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const JWT = "header.payload.signature";

class FakeSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  close() {}
}

function okResponse(body) {
  return { status: 200, ok: true, json: async () => body };
}

describe("WebSocket 접속", () => {
  let store;

  beforeEach(() => {
    vi.resetModules();
    FakeSocket.instances = [];
    store = new Map([["token", JWT]]);
    vi.stubGlobal("localStorage", {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    });
    vi.stubGlobal("window", {
      location: { protocol: "https:", host: "safetrace.kr" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("WebSocket", FakeSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("접속 주소에는 JWT 대신 1회용 티켓을 싣는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ ticket: "ticket-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const { connectIncidentSocket } = await import("./socket");

    connectIncidentSocket(() => {});
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));

    const [ticketUrl, ticketOptions] = fetchMock.mock.calls[0];
    expect(ticketUrl).toBe("/api/ws/ticket");
    expect(ticketOptions.method).toBe("POST");
    expect(ticketOptions.headers.Authorization).toBe(`Bearer ${JWT}`);

    const socketUrl = FakeSocket.instances[0].url;
    expect(socketUrl).toBe("wss://safetrace.kr/ws/incidents?ticket=ticket-1");
    expect(socketUrl).not.toContain(JWT);
    expect(socketUrl).not.toContain("token=");
  });

  it("로그아웃 상태에서는 티켓도 요청하지 않고 접속하지 않는다", async () => {
    store.delete("token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { connectReportSocket } = await import("./socket");

    connectReportSocket(() => {});
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("티켓을 기다리는 사이에 닫히면 접속하지 않는다", async () => {
    let resolveTicket;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((resolve) => { resolveTicket = resolve; })));
    const { connectSafetyCheckSocket } = await import("./socket");

    const connection = connectSafetyCheckSocket(() => {});
    connection.close();
    resolveTicket(okResponse({ ticket: "ticket-1" }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("티켓을 못 받으면 3초 뒤 다시 시도하고, 그때는 새 티켓으로 접속한다", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 500, ok: false, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse({ ticket: "ticket-2" }));
    vi.stubGlobal("fetch", fetchMock);
    const { connectIncidentSocket } = await import("./socket");

    connectIncidentSocket(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(3000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toContain("ticket=ticket-2");
  });
});
