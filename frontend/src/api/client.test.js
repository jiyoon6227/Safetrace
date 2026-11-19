import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logout } from "./client";

describe("logout", () => {
  let store;

  beforeEach(() => {
    store = new Map([["token", "jwt-value"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("서버에 토큰 무효화를 요청하고 브라우저 토큰을 지운다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/logout");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer jwt-value");
    expect(store.has("token")).toBe(false);
  });

  it("서버 응답을 기다리지 않고 바로 브라우저 토큰부터 지운다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    logout();

    expect(store.has("token")).toBe(false);
  });

  it("서버에 닿지 않아도 오류 없이 로그아웃된다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(logout()).resolves.toBeUndefined();

    expect(store.has("token")).toBe(false);
  });

  it("이미 로그아웃된 상태면 서버에 요청하지 않는다", async () => {
    store.delete("token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
