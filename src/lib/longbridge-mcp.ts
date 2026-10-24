import "server-only";

import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { OAuthClientProvider, type OAuthDiscoveryState, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

const MCP_URL = new URL("https://mcp.longbridge.com");
const COOKIE_NAME = "awe-longbridge-session";
const MAX_AGE_SECONDS = 60 * 60 * 24;

class LongbridgeOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl: string;
  readonly clientMetadata: OAuthClientMetadata;
  authorizationUrl: URL | null = null;
  expectedState: string | null = null;
  private registration?: OAuthClientInformationMixed;
  private storedTokens?: OAuthTokens;
  private verifier?: string;
  private discovery?: OAuthDiscoveryState;

  constructor(origin: string) {
    this.redirectUrl = `${origin}/api/longbridge/callback`;
    this.clientMetadata = { client_name: "AWE Trading Terminal", redirect_uris: [this.redirectUrl] };
  }
  state() { this.expectedState = randomUUID(); return this.expectedState; }
  clientInformation() { return this.registration; }
  saveClientInformation(value: OAuthClientInformationMixed) { this.registration = value; }
  tokens() { return this.storedTokens; }
  saveTokens(value: OAuthTokens) { this.storedTokens = value; }
  redirectToAuthorization(value: URL) { this.authorizationUrl = value; }
  saveCodeVerifier(value: string) { this.verifier = value; }
  codeVerifier() { if (!this.verifier) throw new Error("OAuth verifier missing"); return this.verifier; }
  saveDiscoveryState(value: OAuthDiscoveryState) { this.discovery = value; }
  discoveryState() { return this.discovery; }
  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all" || scope === "tokens") this.storedTokens = undefined;
    if (scope === "all" || scope === "client") this.registration = undefined;
    if (scope === "all" || scope === "verifier") this.verifier = undefined;
    if (scope === "all" || scope === "discovery") this.discovery = undefined;
  }
}

type Session = { provider: LongbridgeOAuthProvider; returnPath: string; createdAt: number };
const globalSessions = globalThis as typeof globalThis & { __aweLongbridgeSessions?: Map<string, Session> };
const sessions = globalSessions.__aweLongbridgeSessions ??= new Map<string, Session>();

export { COOKIE_NAME, MAX_AGE_SECONDS, UnauthorizedError };

export function appOrigin(requestHost: string): string {
  const configured = process.env.AWE_BASE_URL;
  if (configured) return new URL(configured).origin;
  if (!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(requestHost)) throw new Error("Set AWE_BASE_URL for non-local deployments");
  return `http://${requestHost}`;
}

export function newSession(origin: string, returnPath: string): { id: string; session: Session } {
  for (const [key, value] of sessions) if (Date.now() - value.createdAt > MAX_AGE_SECONDS * 1000) sessions.delete(key);
  const id = randomUUID();
  const session = { provider: new LongbridgeOAuthProvider(origin), returnPath, createdAt: Date.now() };
  sessions.set(id, session);
  return { id, session };
}

export function getSession(id: string | undefined): Session | null {
  if (!id) return null;
  const session = sessions.get(id);
  return session && Date.now() - session.createdAt <= MAX_AGE_SECONDS * 1000 ? session : null;
}

export function hasLongbridgeToken(session: Session | null): boolean { return Boolean(session?.provider.tokens()); }

function transport(provider: LongbridgeOAuthProvider) {
  return new StreamableHTTPClientTransport(MCP_URL, { authProvider: provider });
}

export async function beginAuthorization(session: Session): Promise<URL | null> {
  const client = new Client({ name: "awe-trading-terminal", version: "0.2.0" });
  try {
    await client.connect(transport(session.provider));
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError && session.provider.authorizationUrl) return session.provider.authorizationUrl;
    throw error;
  } finally { await client.close().catch(() => {}); }
}

export async function finishAuthorization(session: Session, code: string): Promise<void> {
  await transport(session.provider).finishAuth(code);
  session.provider.expectedState = null;
}

export async function callLongbridgeTool(session: Session, name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = new Client({ name: "awe-trading-terminal", version: "0.2.0" });
  try {
    await client.connect(transport(session.provider));
    const response = await client.callTool({ name, arguments: args });
    if (response.isError) throw new Error("Longbridge returned a tool error");
    const content = response.content;
    const item = Array.isArray(content) ? content.find((entry: unknown) => entry && typeof entry === "object" && "type" in entry && entry.type === "text") : null;
    if (!item || typeof item.text !== "string") throw new Error("Longbridge returned no market data");
    return JSON.parse(item.text);
  } finally { await client.close().catch(() => {}); }
}
