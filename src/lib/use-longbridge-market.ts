"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SampleCandle } from "./chart-data";
import type { IntradayPoint, LiveQuote } from "./longbridge-data";
import type { Fundamentals } from "./fundamentals";

type RefreshResult = {
  quotes: Record<string, LiveQuote>;
  trendsBySymbol?: Record<string, IntradayPoint[]>;
  candlesByInterval?: Partial<Record<"1D" | "1W" | "1M", SampleCandle[]>>;
  fundamentals?: Fundamentals | null;
  weekRange?: { high: number; low: number; end: string } | null;
  unsupported: string[];
  asOf: string;
};

const CACHE_EVENT = "awe-market-cache-change";

function subscribeToCache(callback: () => void) {
  window.addEventListener(CACHE_EVENT, callback);
  return () => window.removeEventListener(CACHE_EVENT, callback);
}

function parseCachedResult(snapshot: string): RefreshResult | null {
  if (!snapshot) return null;
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!value || typeof value !== "object") return null;
    const result = value as Partial<RefreshResult>;
    return result.quotes && typeof result.quotes === "object" && !Array.isArray(result.quotes) && Array.isArray(result.unsupported) && typeof result.asOf === "string"
      ? result as RefreshResult : null;
  } catch { return null; }
}

export function useLongbridgeMarket(cacheKey?: string) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [freshResult, setFreshResult] = useState<RefreshResult | null>(null);
  const readSnapshot = useCallback(() => {
    if (!cacheKey) return "";
    try { return window.sessionStorage.getItem(cacheKey) ?? ""; }
    catch { return ""; }
  }, [cacheKey]);
  const snapshot = useSyncExternalStore(subscribeToCache, readSnapshot, () => "");
  const cachedResult = useMemo(() => parseCachedResult(snapshot), [snapshot]);
  const result = freshResult ?? cachedResult;

  useEffect(() => {
    let active = true;
    fetch("/api/longbridge/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setConnected(data.connected === true); })
      .catch(() => {})
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function refresh(symbols: string[], chartSymbol?: string) {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/longbridge/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ symbols, chartSymbol }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) setConnected(false);
        throw new Error(data.error || "行情更新失败。");
      }
      const nextResult = data as RefreshResult;
      setFreshResult(nextResult);
      if (cacheKey) {
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(nextResult));
          window.dispatchEvent(new Event(CACHE_EVENT));
        } catch { /* Keep the current quote visible when browser storage is unavailable. */ }
      }
      setConnected(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "行情更新失败。");
    } finally { setRefreshing(false); }
  }

  return { connected, checking, refreshing, error, result, refresh };
}
