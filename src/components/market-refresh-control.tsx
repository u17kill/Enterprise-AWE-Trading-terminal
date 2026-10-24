type Props = {
  connected: boolean;
  checking: boolean;
  refreshing: boolean;
  returnPath: string;
  onRefresh: () => void;
};

export function MarketRefreshControl({ connected, checking, refreshing, returnPath, onRefresh }: Props) {
  return <div className="market-refresh-control">
    <button type="button" aria-label="更新当前页面数据" disabled={checking || refreshing || !connected} onClick={onRefresh}>{refreshing ? "更新中…" : "↻ 更新数据"}</button>
    {!connected && !checking && <a href={`/api/longbridge/connect?return=${encodeURIComponent(returnPath)}`}>连接 Longbridge</a>}
  </div>;
}
