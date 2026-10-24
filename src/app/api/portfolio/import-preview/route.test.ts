import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("private historical portfolio preview", () => {
  it("cannot be served from a production deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("https://example.com/api/portfolio/import-preview", { headers: { host: "127.0.0.1:3100" } });
    expect((await GET(request)).status).toBe(404);
  });

  it("cannot be served through a non-loopback development host", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest("http://192.0.2.1:3100/api/portfolio/import-preview", { headers: { host: "192.0.2.1:3100" } });
    expect((await GET(request)).status).toBe(404);
  });
});
