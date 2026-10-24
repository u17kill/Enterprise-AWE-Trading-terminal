"use client";

import { useEffect, useState } from "react";
import type { SampleCandle } from "./chart-data";
import type { IntradayPoint, LiveQuote } from "./longbridge-data";

type RefreshResult = {
  quotes: Record<string, LiveQuote>;
  trendsBySymbol?: Record<string, IntradayPoint[]>;
  candlesByInterval?: Partial<Record<"1D" | "1W" | "1M", SampleCandle[]>>;
  unsupported: string[];
  asOf: string;
};

export function useLongbridgeMarket() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RefreshResult | null>(null);

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
      setResult(data as RefreshResult);
      setConnected(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "行情更新失败。");
    } finally { setRefreshing(false); }
  }

  return { connected, checking, refreshing, error, result, refresh };
}
