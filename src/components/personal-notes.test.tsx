import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { notesCreationWarning, PersonalNotes } from './personal-notes';
import type { NotesBoard, NotesSnapshot } from '../lib/notes-document';

const controls = vi.hoisted(() => ({ status: 'ok', locked: false, error: '', conflict: null as NotesSnapshot | null, retry: vi.fn(), reload: vi.fn(), resolve: vi.fn(), restore: vi.fn() }));
vi.mock('../hooks/use-notes-board', () => ({ useNotesBoard(initial: NotesSnapshot) {
  const [board, change] = useState(initial.notes);
  return { board, change, ...controls, draftError: '', choices: [] };
} }));
const now = '2026-11-26T01:02:03Z';
function snapshot(): NotesSnapshot {
  const notes: NotesBoard = { schemaVersion: 1, updated: now, columns: [
    { id: 'col-a', title: '随手记', cards: [{ id: 'c-a', title: '原文', body: '  <b>原样</b>\n  文本😀', created: now, updated: now }, { id: 'c-b', title: '第二张', body: 'x'.repeat(145) + 'HiddenMatch', created: now, updated: now }] },
    { id: 'col-b', title: '归档', cards: [] },
  ] };
  return { ok: true, notes, revision: 'abc', updatedAt: now, warnings: [] };
}
beforeEach(() => { controls.status = 'ok'; controls.locked = false; controls.error = ''; controls.conflict = null; vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); });
describe('personal notes', () => {
  it('rejects a new column at the storage limit without changing the board', () => {
    const initial = snapshot(); initial.notes!.columns = Array.from({ length: 100 }, (_, i) => ({ id: `col-${i}`, title: `主题${i}`, cards: [] }));
    render(<PersonalNotes initial={initial} />);
    fireEvent.click(screen.getByRole('button', { name: '新建泳道' }));
    expect(screen.getByRole('alert')).toHaveTextContent('最多100条泳道');
    expect(screen.getAllByRole('region', { name: /^泳道：/ })).toHaveLength(100);
    expect(screen.queryByRole('textbox', { name: '泳道名称' })).not.toBeInTheDocument();
  });
  it('rejects new cards at the aggregate storage limit and permits cards below it', () => {
    const initial = snapshot(); const card = initial.notes!.columns[0].cards[0];
    initial.notes!.columns[0].cards = Array.from({ length: 5000 }, (_, i) => ({ ...card, id: `c-${i}` }));
    expect(notesCreationWarning(initial.notes!, 'card')).toContain('最多5000张卡片');
    initial.notes!.columns[0].cards.pop();
    expect(notesCreationWarning(initial.notes!, 'card')).toBe('');
  });
  it('keeps exact text and updates body count immediately in the drawer', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: '打开笔记：原文' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: '笔记标题' })).toHaveFocus();
    const body = within(dialog).getByRole('textbox', { name: '纯文本正文' });
    expect(body).toHaveValue('  <b>原样</b>\n  文本😀');
    const exact = '\n  <script>原样</script>  😀\n';
    fireEvent.change(body, { target: { value: exact } });
    expect(body).toHaveValue(exact);
    expect(within(dialog).getByText(`正文 ${exact.length} 字`)).toBeInTheDocument();
    fireEvent.keyDown(body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开笔记：原文' })).toHaveFocus();
  });
  it('searches full bodies, explains hidden matches and disables card sorting', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hiddenmatch' } });
    expect(screen.getByText('正文包含匹配')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开笔记：原文' })).not.toBeInTheDocument();
    expect(screen.getByText('匹配 1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上移笔记：第二张' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    expect(screen.getByRole('button', { name: '打开笔记：原文' })).toBeInTheDocument();
  });
  it('creates, renames and deletes columns and creates and moves cards', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: '新建泳道' }));
    const title = screen.getByRole('textbox', { name: '泳道名称' });
    expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: '新的主题' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    const lane = screen.getByRole('region', { name: '泳道：新的主题' });
    fireEvent.click(within(lane).getByRole('button', { name: '新建卡片' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '笔记标题' }), { target: { value: '新增卡' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '所属泳道' }), { target: { value: 'col-b' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
    expect(within(screen.getByRole('region', { name: '泳道：归档' })).getByRole('button', { name: '打开笔记：新增卡' })).toBeInTheDocument();
    fireEvent.click(within(lane).getByRole('button', { name: '删除泳道：新的主题' }));
    expect(screen.queryByRole('region', { name: '泳道：新的主题' })).not.toBeInTheDocument();
  });
  it('reorders with keyboard buttons and keeps boundary buttons disabled', () => {
    render(<PersonalNotes initial={snapshot()} />);
    expect(screen.getByRole('button', { name: '上移笔记：原文' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '上移笔记：第二张' }));
    expect(screen.getAllByRole('button', { name: /^打开笔记/ })[0]).toHaveAccessibleName('打开笔记：第二张');
    fireEvent.click(screen.getByRole('button', { name: '左移泳道：归档' }));
    expect(screen.getAllByRole('region', { name: /^泳道/ })[0]).toHaveAccessibleName('泳道：归档');
  });
  it('keeps empty titles valid and warns without truncating long text', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: '打开笔记：原文' }));
    const title = screen.getByRole('textbox', { name: '笔记标题' });
    fireEvent.change(title, { target: { value: '长'.repeat(65) } });
    expect(title).toHaveValue('长'.repeat(65));
    expect(screen.getByText(/标题超过60字/)).toBeInTheDocument();
    fireEvent.change(title, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.getByRole('button', { name: '打开笔记：（无标题）' })).toBeInTheDocument();
  });
  it('keeps failure visible without disabling editing and provides conflict choices', () => {
    controls.status = 'conflict'; controls.error = '源文件版本已改变'; controls.conflict = snapshot();
    render(<PersonalNotes initial={snapshot()} />);
    expect(screen.getByText('源文件版本已改变')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保留本页覆盖' }));
    expect(controls.resolve).toHaveBeenCalledWith('local');
    expect(screen.getByRole('button', { name: '打开笔记：原文' })).not.toBeDisabled();
  });
  it('cancels inline renaming and preserves the next new-column edit', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: '重命名泳道：随手记' }));
    const input = screen.getByRole('textbox', { name: '泳道名称' });
    fireEvent.change(input, { target: { value: '不保留这个名字' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(screen.getByRole('region', { name: '泳道：随手记' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新建泳道' }));
    fireEvent.change(screen.getByRole('textbox', { name: '泳道名称' }), { target: { value: '接下来' } });
    fireEvent.blur(screen.getByRole('textbox', { name: '泳道名称' }));
    expect(screen.getByRole('region', { name: '泳道：接下来' })).toBeInTheDocument();
  });
  it('traps keyboard focus, supports shortcut close, and confirms card deletion', () => {
    render(<PersonalNotes initial={snapshot()} />);
    fireEvent.click(screen.getByRole('button', { name: '打开笔记：原文' }));
    const dialog = screen.getByRole('dialog');
    const first = within(dialog).getByRole('button', { name: '关闭笔记抽屉' });
    const last = within(dialog).getByRole('button', { name: '关闭' });
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' }); expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Enter', ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开笔记：原文' }));
    fireEvent.click(screen.getByRole('button', { name: '删除笔记' }));
    expect(window.confirm).toHaveBeenCalledWith('确定删除笔记“原文”？');
    expect(screen.queryByRole('button', { name: '打开笔记：原文' })).not.toBeInTheDocument();
  });
  it('drags a card before another and across lanes, using a separate handle', () => {
    render(<PersonalNotes initial={snapshot()} />);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getByRole('button', { name: '拖动笔记：第二张' }), { dataTransfer });
    fireEvent.drop(screen.getByRole('button', { name: '打开笔记：原文' }).closest('article')!);
    expect(screen.getAllByRole('button', { name: /^打开笔记/ })[0]).toHaveAccessibleName('打开笔记：第二张');
    fireEvent.dragStart(screen.getByRole('button', { name: '拖动笔记：第二张' }), { dataTransfer });
    fireEvent.drop(screen.getByRole('region', { name: '泳道：归档' }));
    expect(within(screen.getByRole('region', { name: '泳道：归档' })).getByRole('button', { name: '打开笔记：第二张' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('exports the entire board during filtering, including preserved metadata', async () => {
    const initial = snapshot(); initial.notes!.columns[0].cards[0].future = { preserve: true };
    const create = vi.fn().mockReturnValue('blob:notes'); Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<PersonalNotes initial={initial} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not found' } });
    fireEvent.click(screen.getByRole('button', { name: '导出JSON' }));
    const blob = create.mock.calls[0][0] as Blob;
    const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(JSON.parse(text)).toEqual(initial.notes);
  });
});
