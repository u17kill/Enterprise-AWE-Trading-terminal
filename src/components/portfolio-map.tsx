"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { DEFAULT_MATRIX, loadMatrix, MATRIX_KEY, validateMatrixBackup, type MatrixColumn, type MatrixGroup, type MatrixItem, type MatrixRegion, type PortfolioMatrix, type TileStatus } from "../lib/portfolio-matrix";
import { PORTFOLIO_KEY } from "../lib/portfolio-map";
import "../app/portfolio-map.css";

type Editor =
  | { kind: "item"; value: MatrixItem; fresh: boolean }
  | { kind: "column"; value: MatrixColumn; fresh: boolean }
  | { kind: "group"; value: MatrixGroup; fresh: boolean }
  | { kind: "region"; value: MatrixRegion; fresh: boolean };
const newId = () => crypto.randomUUID();
const statusLabels: Record<TileStatus, string> = { held: "已持仓", watch: "观察中", add: "计划加仓" };
const kindLabels = { item: "标的", column: "主题", group: "策略", region: "地区" };

function downloadJson(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("无法读取备份文件。"));
    reader.readAsText(file);
  });
}

export function PortfolioMapPage() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [matrix, setMatrix] = useState<PortfolioMatrix>(() => {
    if (typeof window === "undefined") return DEFAULT_MATRIX;
    try { return loadMatrix(window.localStorage); } catch { return DEFAULT_MATRIX; }
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState(false);
  const hasOldData = useSyncExternalStore(() => () => {}, () => {
    try { return Boolean(window.localStorage.getItem(PORTFOLIO_KEY)); } catch { return false; }
  }, () => false);
  useEffect(() => {
    if (!mounted) return;
    let failed = false;
    try { localStorage.setItem(MATRIX_KEY, JSON.stringify(matrix)); }
    catch { failed = true; }
    const timer = window.setTimeout(() => setSaveError(failed), 0);
    return () => window.clearTimeout(timer);
  }, [matrix, mounted]);

  const columns = matrix.groups.flatMap((group) => {
    const own = matrix.columns.filter((column) => column.groupId === group.id);
    return own.length ? own : [{ id: `empty-${group.id}`, groupId: group.id, name: "", placeholder: true }];
  });
  const openItem = (columnId = matrix.columns[0]?.id, regionId = matrix.regions[0]?.id) => {
    if (!columnId || !regionId) { setMessage("请先添加策略、主题和地区。"); return; }
    setMessage("");
    setEditor({ kind: "item", fresh: true, value: { id: newId(), columnId, regionId, symbol: "", name: "", amount: "", status: "held" } });
  };
  const openColumn = (groupId: string) => {
    setMessage("");
    setEditor({ kind: "column", fresh: true, value: { id: newId(), groupId, name: "" } });
  };
  const save = () => {
    if (!editor) return;
    const active = editor;
    if (active.kind === "item") {
      const value = { ...active.value, symbol: active.value.symbol.trim(), name: active.value.name.trim(), amount: active.value.amount.trim() };
      if (!value.symbol || !value.name) { setMessage("请填写代码或简称，以及公司或资产名称。"); return; }
      setMatrix((current) => ({ ...current, items: active.fresh ? [...current.items, value] : current.items.map((item) => item.id === value.id ? value : item) }));
    } else if (active.kind === "column") {
      const value = { ...active.value, name: active.value.name.trim() };
      if (!value.name) { setMessage("请填写主题名称。"); return; }
      setMatrix((current) => ({ ...current, columns: active.fresh ? [...current.columns, value] : current.columns.map((item) => item.id === value.id ? value : item) }));
    } else if (active.kind === "group") {
      const value = { ...active.value, name: active.value.name.trim() };
      if (!value.name) { setMessage("请填写策略名称。"); return; }
      setMatrix((current) => ({ ...current, groups: active.fresh ? [...current.groups, value] : current.groups.map((item) => item.id === value.id ? value : item) }));
    } else {
      const value = { ...active.value, name: active.value.name.trim() };
      if (!value.name) { setMessage("请填写地区名称。"); return; }
      setMatrix((current) => ({ ...current, regions: active.fresh ? [...current.regions, value] : current.regions.map((item) => item.id === value.id ? value : item) }));
    }
    setEditor(null); setMessage("");
  };
  const remove = () => {
    if (!editor || editor.fresh) return;
    const active = editor;
    const label = active.kind === "item" ? active.value.symbol : active.value.name;
    if (!window.confirm(`删除“${label}”${active.kind === "item" ? "" : "及其中的标的"}？`)) return;
    setMatrix((current) => {
      if (active.kind === "item") return { ...current, items: current.items.filter((item) => item.id !== active.value.id) };
      if (active.kind === "column") return { ...current, columns: current.columns.filter((item) => item.id !== active.value.id), items: current.items.filter((item) => item.columnId !== active.value.id) };
      if (active.kind === "region") return { ...current, regions: current.regions.filter((item) => item.id !== active.value.id), items: current.items.filter((item) => item.regionId !== active.value.id) };
      const removed = new Set(current.columns.filter((item) => item.groupId === active.value.id).map((item) => item.id));
      return { ...current, groups: current.groups.filter((item) => item.id !== active.value.id), columns: current.columns.filter((item) => item.groupId !== active.value.id), items: current.items.filter((item) => !removed.has(item.columnId)) };
    });
    setEditor(null); setMessage("");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await readFile(file));
      const next = validateMatrixBackup(raw);
      if (!next) throw new Error("备份内容有缺失或无效标的，未替换当前地图。");
      if (!window.confirm(`导入将以 ${next.items.length} 个标的替换当前 V0.3 地图，继续吗？`)) return;
      setMatrix(next); setMessage("地图已从备份恢复。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "导入失败。"); }
  };

  if (!mounted) return <div className="portfolio-shell" aria-label="正在读取本地持仓" />;
  return <div className="portfolio-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">A<span>↗</span></span><span><strong>AWE</strong><small>TRADING TERMINAL</small></span></Link>
      <div className="sidebar-label">工作台</div>
      <nav aria-label="主导航"><Link className="nav-item" href="/"><span className="nav-glyph">◫</span>总览看板</Link><Link className="nav-item" href="/chart/SPX"><span className="nav-glyph">⌁</span>图表空间</Link><Link className="nav-item active" href="/portfolio"><span className="nav-glyph">▦</span>持仓地图</Link></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-dot" />V0.3 · 持仓矩阵</div><p>地图只保存在这个浏览器中，请定期导出备份。</p></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>持仓地图</strong></div><span className="sample-pill">{saveError ? "保存失败" : "本地保存"}</span></header>
      <div className="matrix-content">
        <div className="matrix-intro"><div><span className="section-eyebrow">FULL SATELLITE MAP · V0.3</span><h1>持仓地图</h1><p>按策略、主题和地区展开。点击任何标题或标的即可编辑。</p></div>
          <div className="matrix-toolbar"><button className="primary-button" onClick={() => openItem()}>＋ 添加标的</button><button onClick={() => { setMessage(""); setEditor({ kind: "group", fresh: true, value: { id: newId(), name: "", color: "#90d9f5" } }); }}>＋ 策略</button><button onClick={() => { setMessage(""); setEditor({ kind: "region", fresh: true, value: { id: newId(), name: "" } }); }}>＋ 地区</button></div>
        </div>
        <div className="matrix-meta"><div className="matrix-legend"><span><i className="status-held" />已持仓</span><span><i className="status-watch" />暂未持仓 · 观察</span><span><i className="status-add" />计划加仓</span></div><div className="matrix-backup"><button onClick={() => downloadJson("awe-portfolio-matrix-v03.json", JSON.stringify(matrix, null, 2))}>导出地图</button><label className="matrix-import">导入地图<input type="file" accept="application/json,.json" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></label>{hasOldData && <button onClick={() => { const old = localStorage.getItem(PORTFOLIO_KEY); if (old) downloadJson("awe-portfolio-v13-backup.json", old); }}>下载旧版持仓备份</button>}</div></div>
        <p className="matrix-source">初始内容按你提供的示意图录入；图中数字是原样备注，不代表已核验的当前持仓、市价或盈亏。{saveError ? "当前浏览器没有保存修改。" : "修改后自动保存在本浏览器。"}</p>
        {saveError && <p role="alert" aria-label="保存失败" className="matrix-message">浏览器存储不可用，本次修改没有保存。请导出地图备份。</p>}
        {message && !editor && <p role="status" className="matrix-message">{message}</p>}
        {matrix.groups.length ? <div className="matrix-scroll"><table className="matrix-table" aria-label="持仓矩阵"><thead>
          <tr><th className="matrix-corner" rowSpan={2}>地区 / 主题</th>{matrix.groups.map((group) => <th key={group.id} colSpan={Math.max(1, matrix.columns.filter((column) => column.groupId === group.id).length)} className="matrix-group"><div style={{ backgroundColor: group.color }}><button aria-label={`编辑策略 ${group.name}`} onClick={() => { setMessage(""); setEditor({ kind: "group", fresh: false, value: group }); }}>{group.name}</button><button aria-label={`添加主题到 ${group.name}`} title="添加主题" onClick={() => openColumn(group.id)}>＋</button></div></th>)}</tr>
          <tr>{columns.map((column) => <th key={column.id} className="matrix-column">{"placeholder" in column && column.placeholder ? <button aria-label={`添加主题到 ${matrix.groups.find((group) => group.id === column.groupId)?.name}`} onClick={() => openColumn(column.groupId)}>＋ 添加主题</button> : <button aria-label={`编辑主题 ${column.name}`} onClick={() => { setMessage(""); setEditor({ kind: "column", fresh: false, value: column }); }}>{column.name}</button>}</th>)}</tr>
        </thead><tbody>{matrix.regions.map((region) => <tr key={region.id}>
          <th scope="row" className="matrix-region"><button aria-label={`编辑地区 ${region.name}`} onClick={() => { setMessage(""); setEditor({ kind: "region", fresh: false, value: region }); }}>{region.name}</button></th>
          {columns.map((column) => {
            const tiles = matrix.items.filter((item) => item.columnId === column.id && item.regionId === region.id);
            const double = ["ai-infra", "ai-app"].includes(column.id);
            return <td key={column.id} className={`matrix-cell${double ? " matrix-cell-double" : ""}`}>
              {"placeholder" in column && column.placeholder ? null : <>
                <div className="matrix-tiles" style={double ? { gridTemplateRows: `repeat(${Math.max(1, Math.ceil(tiles.length / 2))}, auto)` } : undefined}>
                  {tiles.map((item) => <button key={item.id} className={`matrix-tile status-${item.status}`} aria-label={`编辑 ${item.symbol}`} title={`${item.name} · ${statusLabels[item.status]}`} onClick={() => { setMessage(""); setEditor({ kind: "item", fresh: false, value: item }); }}>
                    <strong>{item.symbol}</strong>{item.name !== item.symbol && <small>{item.name}</small>}{item.amount && <span>{item.amount}</span>}
                  </button>)}
                </div>
                <button className="matrix-add-tile" aria-label={`添加标的到 ${column.name} ${region.name}`} title="添加标的" onClick={() => openItem(column.id, region.id)}>＋</button>
              </>}
            </td>;
          })}
        </tr>)}</tbody></table></div> : <div className="matrix-empty">还没有策略。点击“＋ 策略”开始创建地图。</div>}
      </div>
    </main>
    {editor && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditor(null); setMessage(""); } }}><section className="portfolio-editor" role="dialog" aria-modal="true" aria-label={`编辑${kindLabels[editor.kind]}`}>
      <h2>{editor.fresh ? "添加" : "编辑"}{kindLabels[editor.kind]}</h2>
      {editor.kind === "item" && <div className="portfolio-fields"><label>代码 / 简称<input value={editor.value.symbol} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, symbol: event.target.value } })} /></label><label>公司 / 资产名称<input value={editor.value.name} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, name: event.target.value } })} /></label><label>仓位 / 备注<input value={editor.value.amount} placeholder="例如 9.5k、put 115" onChange={(event) => setEditor({ ...editor, value: { ...editor.value, amount: event.target.value } })} /></label><label>状态<select value={editor.value.status} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, status: event.target.value as TileStatus } })}><option value="held">已持仓 · 灰色</option><option value="watch">观察中 · 黄色</option><option value="add">计划加仓 · 绿色</option></select></label><label>主题<select value={editor.value.columnId} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, columnId: event.target.value } })}>{matrix.groups.flatMap((group) => matrix.columns.filter((column) => column.groupId === group.id).map((column) => <option key={column.id} value={column.id}>{group.name} / {column.name}</option>))}</select></label><label>地区<select value={editor.value.regionId} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, regionId: event.target.value } })}>{matrix.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label></div>}
      {editor.kind === "column" && <div className="portfolio-fields"><label>主题名称<input value={editor.value.name} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, name: event.target.value } })} /></label><label>所属策略<select value={editor.value.groupId} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, groupId: event.target.value } })}>{matrix.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>}
      {editor.kind === "group" && <div className="portfolio-fields"><label>策略名称<input value={editor.value.name} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, name: event.target.value } })} /></label><label>标题颜色<input type="color" value={editor.value.color} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, color: event.target.value } })} /></label></div>}
      {editor.kind === "region" && <div className="portfolio-fields"><label>地区名称<input value={editor.value.name} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, name: event.target.value } })} /></label></div>}
      {message && <p role="alert" className="matrix-message">{message}</p>}
      <div className="portfolio-editor-actions">{!editor.fresh && <button className="danger" onClick={remove}>删除{kindLabels[editor.kind]}</button>}<button onClick={() => { setEditor(null); setMessage(""); }}>取消</button><button className="primary-button" onClick={save}>保存{kindLabels[editor.kind]}</button></div>
    </section></div>}
  </div>;
}
