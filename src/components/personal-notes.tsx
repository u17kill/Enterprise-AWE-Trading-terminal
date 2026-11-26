"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';
import { ToolsPageHeading } from './tools-page-heading';
import { ToolsPageNav } from './tools-page-nav';
import { useNotesBoard } from '../hooks/use-notes-board';
import { formatNotesTime, notesStats, type NotesBoard, type NotesCard, type NotesSnapshot } from '../lib/notes-document';

const statusLabels: Record<string, string> = {
  initial: '尚未创建源文件 · 开始记录后自动保存', ok: '已写入源文件', draft: '已恢复草稿，待写回', dirty: '有改动，准备写回', saving: '正在写回',
  offline: '未连本地服务，改动留在草稿', fail: '写回失败，草稿保留', nostore: '草稿也未写成，仅当前页', conflict: '源文件已改变，请选择版本', unavailable: '源文件读取失败',
};
function highlighted(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase(), needle = query.toLowerCase();
  const result: ReactNode[] = []; let from = 0, match = lower.indexOf(needle);
  while (match !== -1) { result.push(text.slice(from, match), <mark key={match}>{text.slice(match, match + query.length)}</mark>); from = match + query.length; match = lower.indexOf(needle, from); }
  result.push(text.slice(from)); return result;
}
function cardName(card: NotesCard) { return card.title || '（无标题）'; }
export function notesCreationWarning(board: NotesBoard, kind: 'column' | 'card'): string {
  if (kind === 'column' && board.columns.length >= 100) return '最多100条泳道，请先删除不需要的泳道。现有内容已保留。';
  if (kind === 'card' && board.columns.reduce((sum, column) => sum + column.cards.length, 0) >= 5000) return '最多5000张卡片，请先删除不需要的卡片。现有内容已保留。';
  return '';
}
function changedCard(card: NotesCard, values: Partial<NotesCard>): NotesCard { return { ...card, ...values, updated: new Date().toISOString() }; }
function swapped<T>(items: T[], index: number, direction: number): T[] {
  const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
}
type Drag = { kind: 'column' | 'card'; id: string } | null;

function NotesDrawer({ board, card, columnId, locked, onUpdate, onMove, onDelete, onClose, onExport }: {
  board: NotesBoard; card: NotesCard; columnId: string; locked: boolean;
  onUpdate: (values: Partial<NotesCard>) => void; onMove: (id: string) => void; onDelete: () => void; onClose: () => void; onExport: () => void;
}) {
  const dialog = useRef<HTMLElement>(null), title = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    title.current?.focus();
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; const opener = document.getElementById(`notes-card-${card.id}`); if (opener) opener.focus(); else if (previous?.isConnected) previous.focus(); };
  }, [card.id]);
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('*') ?? [])].filter((element) => ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) && !element.hasAttribute('disabled'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  return <div className="notes-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="notes-drawer" role="dialog" aria-modal="true" aria-labelledby="notes-editor-heading" onKeyDown={keyboard}>
      <div className="notes-drawer-heading"><div><span className="section-eyebrow">PERSONAL NOTES</span><h2 id="notes-editor-heading">编辑笔记</h2></div><button type="button" onClick={onClose} aria-label="关闭笔记抽屉">×</button></div>
      <label className="notes-field">笔记标题<input ref={title} value={card.title} disabled={locked} onChange={(event) => onUpdate({ title: event.target.value })} /></label>
      {card.title.length > 60 && <p className="notes-hint">标题超过60字，原文仍会完整保存。</p>}
      <label className="notes-field notes-body-field">纯文本正文<textarea value={card.body} disabled={locked} onChange={(event) => onUpdate({ body: event.target.value })} spellCheck={false} /></label>
      <label className="notes-field">所属泳道<select value={columnId} disabled={locked} onChange={(event) => onMove(event.target.value)}>{board.columns.map((column) => <option key={column.id} value={column.id}>{column.title || '（未命名泳道）'}</option>)}</select></label>
      <dl className="notes-times"><div><dt>创建</dt><dd>{formatNotesTime(card.created)}</dd></div><div><dt>修改</dt><dd>{formatNotesTime(card.updated)}</dd></div></dl>
      <footer className="notes-drawer-footer"><button type="button" className="notes-delete" disabled={locked} onClick={onDelete}>删除笔记</button><button type="button" onClick={onExport}>导出JSON</button><span>正文 {card.body.length} 字</span><button type="button" className="notes-primary" onClick={onClose}>关闭</button></footer>
      <p className="notes-hint">输入自动保存 · Esc 或 Ctrl / ⌘ + Enter 关闭</p>
    </section>
  </div>;
}

export function PersonalNotes({ initial }: { initial: NotesSnapshot }) {
  const session = useNotesBoard(initial), { board, locked } = session;
  const [query, setQuery] = useState(''), [editing, setEditing] = useState<string | null>(null), [columnTitle, setColumnTitle] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [drag, setDrag] = useState<Drag>(null);
  const [creationWarning, setCreationWarning] = useState('');
  const renameInput = useRef<HTMLInputElement>(null), cancelledRename = useRef(false);
  useEffect(() => { if (editing) { renameInput.current?.focus(); renameInput.current?.select(); } }, [editing]);
  const stats = board ? notesStats(board) : { columns: 0, cards: 0, chars: 0 };
  const matching = (card: NotesCard) => !query || card.title.toLowerCase().includes(query.toLowerCase()) || card.body.toLowerCase().includes(query.toLowerCase());
  const matches = board?.columns.reduce((sum, column) => sum + column.cards.filter(matching).length, 0) ?? 0;
  const activeColumn = board?.columns.find((column) => column.cards.some((card) => card.id === selected));
  const activeCard = activeColumn?.cards.find((card) => card.id === selected);
  function change(next: NotesBoard) { if (!locked) { setCreationWarning(''); session.change(next); } }
  function updateCard(id: string, values: Partial<NotesCard>) {
    if (!board) return;
    change({ ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.map((card) => card.id === id ? changedCard(card, values) : card) })) });
  }
  function moveCard(id: string, destination: string, before?: string) {
    if (!board || id === before) return;
    const source = board.columns.find((column) => column.cards.some((card) => card.id === id));
    const card = source?.cards.find((card) => card.id === id);
    if (!card || !board.columns.some((column) => column.id === destination)) return;
    change({ ...board, columns: board.columns.map((column) => {
      const cards = column.cards.filter((item) => item.id !== id);
      if (column.id === destination) { const at = before ? cards.findIndex((item) => item.id === before) : cards.length; cards.splice(at < 0 ? cards.length : at, 0, changedCard(card, {})); }
      return { ...column, cards };
    }) });
  }
  function reorderCard(columnId: string, index: number, direction: number) {
    if (!board || query) return;
    change({ ...board, columns: board.columns.map((column) => column.id === columnId ? { ...column, cards: swapped(column.cards, index, direction).map((card, nextIndex) => nextIndex === index || nextIndex === index + direction ? changedCard(card, {}) : card) } : column) });
  }
  function rename() {
    if (cancelledRename.current) { cancelledRename.current = false; return; }
    if (!board || !editing) return;
    change({ ...board, columns: board.columns.map((column) => column.id === editing ? { ...column, title: columnTitle } : column) }); setEditing(null);
  }
  function newColumn() {
    if (!board) return;
    const warning = notesCreationWarning(board, 'column'); setCreationWarning(warning); if (warning) return;
    cancelledRename.current = false;
    const id = `col-${crypto.randomUUID()}`;
    change({ ...board, columns: [...board.columns, { id, title: '新泳道', cards: [] }] }); setColumnTitle('新泳道'); setEditing(id);
  }
  function newCard(columnId: string) {
    if (!board) return;
    const warning = notesCreationWarning(board, 'card'); setCreationWarning(warning); if (warning) return;
    const id = `c-${crypto.randomUUID()}`, time = new Date().toISOString();
    change({ ...board, columns: board.columns.map((column) => column.id === columnId ? { ...column, cards: [...column.cards, { id, title: '', body: '', created: time, updated: time }] } : column) }); setSelected(id);
  }
  function exportBoard() {
    if (!board) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `notes-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function dropOnColumn(columnId: string) {
    if (!board || locked || selected || !drag) return;
    if (drag.kind === 'card') { if (!query) moveCard(drag.id, columnId); }
    else {
      const from = board.columns.findIndex((column) => column.id === drag.id), to = board.columns.findIndex((column) => column.id === columnId);
      if (from >= 0 && to >= 0 && from !== to) { const columns = [...board.columns]; const [column] = columns.splice(from, 1); columns.splice(to, 0, column); change({ ...board, columns }); }
    }
    setDrag(null);
  }
  const retryVisible = ['offline', 'fail', 'nostore', 'unavailable'].includes(session.status);
  return <div className="app-shell notes-shell"><AppSidebar currentPath="/notes" /><main className="main-content tools-page-content notes-main">
    <ToolsPageHeading title="个人笔记" description="按主题收纳想法，原文自动保存在本机" actions={<button type="button" className="notes-export" onClick={exportBoard} disabled={!board}>导出JSON</button>} />
    <ToolsPageNav currentPath="/notes" />
    <section className="notes-toolbar" aria-label="笔记工具条">
      <div className="notes-stats"><span>泳道 {stats.columns}</span><span>卡片 {stats.cards}</span><span>正文 {stats.chars} 字</span>{query && <strong>匹配 {matches} / {stats.cards}</strong>}</div>
      <div className="notes-toolbar-controls"><div className="notes-search"><input type="search" aria-label="搜索笔记标题或正文" placeholder="搜索标题或正文" value={query} onChange={(event) => { setQuery(event.target.value); setDrag(null); }} />{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>×</button>}</div><button type="button" disabled={locked} onClick={() => void session.reload()}>重读文件</button></div>
      <div className={`notes-save-status notes-status-${session.status}`} role="status"><span className="notes-status-dot" />{statusLabels[session.status] ?? session.status}{session.status === 'ok' && board?.updated && <time> · {formatNotesTime(board.updated)}</time>}{retryVisible && <button type="button" disabled={locked} onClick={() => void session.retry()}>重试</button>}</div>
    </section>
    {locked && <p className="notes-banner" role="status">正在读取或切换版本，暂时不能编辑。</p>}
    {session.error && <p className="notes-banner" role="alert">{session.error}</p>}
    {creationWarning && <p className="notes-banner" role="alert">{creationWarning}</p>}
    {session.draftError && <p className="notes-banner" role="alert">{session.draftError} 请导出JSON保留当前内容。</p>}
    {session.conflict && <section className="notes-banner notes-conflict" aria-label="版本冲突"><p>本页与源文件均已保留，请选择要继续使用的版本。</p><button type="button" disabled={locked} onClick={() => void session.resolve('file')}>使用文件</button><button type="button" disabled={locked} onClick={() => void session.resolve('local')}>保留本页覆盖</button></section>}
    {session.choices.length > 0 && <details className="notes-recovery"><summary>恢复其他草稿（{session.choices.length}）</summary>{session.choices.map((choice) => <button key={choice.key} type="button" disabled={locked} onClick={() => session.restore(choice.key)}>恢复 {formatNotesTime(choice.updatedAt)}</button>)}</details>}
    {initial.warnings.length > 0 && <details className="notes-recovery"><summary>数据提示（{initial.warnings.length}）</summary>{initial.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</details>}
    {query && <p className="notes-hint">清空搜索后调整顺序；可在抽屉中更换所属泳道。</p>}
    {!board ? <div className="notes-unavailable">无法读取笔记源文件，请重读文件后再编辑。</div> : <section className="notes-board" aria-label="个人笔记看板">
      {board.columns.map((column, index) => {
        const visible = column.cards.filter(matching), name = column.title || '（未命名泳道）';
        return <section key={column.id} className="notes-column" aria-label={`泳道：${name}`} onDragOver={(event) => { if (drag && !locked && !selected) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); dropOnColumn(column.id); }}>
          <header className="notes-column-head"><button type="button" className="notes-drag-handle" aria-label={`拖动泳道：${name}`} draggable={!locked && !selected} disabled={locked} onDragStart={(event) => { event.dataTransfer.setData('text/plain', column.id); event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'column', id: column.id }); }} onDragEnd={() => setDrag(null)}>⠿</button>
            {editing === column.id ? <input ref={renameInput} aria-label="泳道名称" className="notes-column-name-input" value={columnTitle} disabled={locked} onChange={(event) => setColumnTitle(event.target.value)} onBlur={rename} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { event.preventDefault(); rename(); } if (event.key === 'Escape') { event.preventDefault(); cancelledRename.current = true; setEditing(null); } }} /> : <button type="button" className="notes-column-title" title={column.title} disabled={locked} aria-label={`重命名泳道：${name}`} onClick={() => { cancelledRename.current = false; setColumnTitle(column.title); setEditing(column.id); }}>{name}</button>}
            <span className="notes-column-count">{query ? `${visible.length} / ${column.cards.length}` : column.cards.length}</span>
          </header>
          {((editing === column.id ? columnTitle : column.title).length > 16) && <p className="notes-hint">泳道名称超过16字，仍完整保存。</p>}
          <div className="notes-column-actions"><button type="button" aria-label={`左移泳道：${name}`} disabled={locked || index === 0} onClick={() => change({ ...board, columns: swapped(board.columns, index, -1) })}>←</button><button type="button" aria-label={`右移泳道：${name}`} disabled={locked || index === board.columns.length - 1} onClick={() => change({ ...board, columns: swapped(board.columns, index, 1) })}>→</button><span>正文 {column.cards.reduce((sum, card) => sum + card.body.length, 0)} 字</span><button type="button" className="notes-delete" aria-label={`删除泳道：${name}`} disabled={locked} onClick={() => { if (window.confirm(`删除泳道“${name}”及其中 ${column.cards.length} 张卡片？`)) change({ ...board, columns: board.columns.filter((item) => item.id !== column.id) }); }}>删除</button></div>
          <div className="notes-cards">
            {visible.length === 0 && <p className="notes-empty">{query ? '此泳道没有匹配笔记' : '还没有笔记，记下一个想法。'}</p>}
            {visible.map((card) => {
              const cardIndex = column.cards.findIndex((item) => item.id === card.id), preview = card.body.slice(0, 140), title = cardName(card);
              const beyondPreview = query && !card.title.toLowerCase().includes(query.toLowerCase()) && !preview.toLowerCase().includes(query.toLowerCase()) && card.body.toLowerCase().includes(query.toLowerCase());
              return <article key={card.id} className="notes-card" onDragOver={(event) => { if (drag?.kind === 'card' && !query && !locked && !selected) { event.preventDefault(); event.stopPropagation(); } }} onDrop={(event) => { if (drag?.kind === 'card' && !query && !locked && !selected) { event.preventDefault(); event.stopPropagation(); moveCard(drag.id, column.id, card.id); setDrag(null); } }}>
                <button type="button" id={`notes-card-${card.id}`} className="notes-card-open" aria-label={`打开笔记：${title}`} disabled={locked} onClick={() => setSelected(card.id)}><strong>{highlighted(title, query)}</strong><span className="notes-card-preview">{highlighted(preview, query)}</span>{beyondPreview && <small className="notes-match-hint">正文包含匹配</small>}</button>
                <div className="notes-card-footer"><button type="button" className="notes-drag-handle" aria-label={`拖动笔记：${title}`} title={query ? '清空搜索后调整顺序' : '拖动排序或移动到其他泳道'} disabled={locked || Boolean(query)} draggable={!locked && !query && !selected} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData('text/plain', card.id); event.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'card', id: card.id }); }} onDragEnd={() => setDrag(null)}>⠿</button><time dateTime={card.updated}>{formatNotesTime(card.updated, true)}</time><span>{card.body.length} 字</span><button type="button" aria-label={`上移笔记：${title}`} disabled={locked || Boolean(query) || cardIndex === 0} onClick={() => reorderCard(column.id, cardIndex, -1)}>↑</button><button type="button" aria-label={`下移笔记：${title}`} disabled={locked || Boolean(query) || cardIndex === column.cards.length - 1} onClick={() => reorderCard(column.id, cardIndex, 1)}>↓</button></div>
              </article>;
            })}
          </div><button type="button" className="notes-add-card" disabled={locked} onClick={() => newCard(column.id)}>新建卡片</button>
        </section>;
      })}
      <button type="button" className="notes-add-column" disabled={locked} onClick={newColumn}>新建泳道</button>
    </section>}
    {board && stats.cards === 0 && <p className="notes-hint">尚无笔记。所有内容仅保存在本机。</p>}
    {board && activeCard && activeColumn && <NotesDrawer board={board} card={activeCard} columnId={activeColumn.id} locked={locked} onExport={exportBoard} onUpdate={(values) => updateCard(activeCard.id, values)} onMove={(id) => moveCard(activeCard.id, id)} onClose={() => setSelected(null)} onDelete={() => { if (window.confirm(`确定删除笔记“${cardName(activeCard)}”？`)) { change({ ...board, columns: board.columns.map((column) => ({ ...column, cards: column.cards.filter((card) => card.id !== activeCard.id) })) }); setSelected(null); } }} />}
  </main></div>;
}
