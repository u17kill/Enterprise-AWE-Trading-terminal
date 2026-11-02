import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeCanaryOrder } from "../../../lib/canary-order";

const { readStoredCanaryOrder, writeStoredCanaryOrder } = vi.hoisted(() => ({ readStoredCanaryOrder: vi.fn(), writeStoredCanaryOrder: vi.fn() }));
vi.mock("../../../lib/canary-order-store", () => ({ readStoredCanaryOrder, writeStoredCanaryOrder }));

import { GET, PUT } from "./route";

beforeEach(() => { vi.clearAllMocks(); readStoredCanaryOrder.mockResolvedValue(normalizeCanaryOrder(null)); writeStoredCanaryOrder.mockResolvedValue(undefined); });

describe("local indicator order API", () => {
  it("reads and writes on localhost and rejects remote origins", async () => {
    const local = "http://127.0.0.1:3103/api/canary-order";
    expect((await GET(new Request(local, { headers: { host: "127.0.0.1:3103" } }))).status).toBe(200);
    const order = normalizeCanaryOrder(null);
    expect((await PUT(new Request(local, { method: "PUT", headers: { host: "127.0.0.1:3103", origin: "http://127.0.0.1:3103", "content-type": "application/json" }, body: JSON.stringify(order) }))).status).toBe(200);
    expect(writeStoredCanaryOrder).toHaveBeenCalledWith(order);
    expect((await GET(new Request("http://example.com/api/canary-order", { headers: { host: "example.com" } }))).status).toBe(403);
    expect((await PUT(new Request(local, { method: "PUT", headers: { host: "127.0.0.1:3103", origin: "http://evil.test", "content-type": "application/json" }, body: JSON.stringify(order) }))).status).toBe(403);
  });
});
