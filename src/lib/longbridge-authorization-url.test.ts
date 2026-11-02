import { describe, expect, it } from "vitest";
import { marketDataAuthorizationUrl } from "./longbridge-authorization-url";

describe("Longbridge market-data authorization", () => {
  it("requests no account, watchlist, order, or trading scope while retaining the OAuth state", () => {
    const advertised = new URL("https://open.longbridge.com/oauth2/authorize/confirm?client_id=abc&code_challenge=xyz&state=s123&scope=4+6+10+11");
    const limited = marketDataAuthorizationUrl(advertised);
    expect(limited.searchParams.get("scope")).toBe("");
    expect(limited.searchParams.get("state")).toBe("s123");
    expect(limited.searchParams.get("code_challenge")).toBe("xyz");
    expect(advertised.searchParams.get("scope")).toBe("4 6 10 11");
  });
});
