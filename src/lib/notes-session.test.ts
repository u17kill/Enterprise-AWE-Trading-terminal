import {describe,it,expect,vi,afterEach} from 'vitest';
import {NotesSession} from './notes-session';
import type {NotesSnapshot,NotesBoard} from './notes-document';
const board=(body='原文'):NotesBoard=>({schemaVersion:1,updated:'',columns:[{id:'col-a',title:'随手记',cards:[{id:'c-a',title:'一条想法',body,created:'2026-11-26T00:00:00Z',updated:'2026-11-26T00:00:00Z'}]}]});
const snap=(body='原文',revision='r1'):NotesSnapshot=>({ok:true,notes:board(body),revision,updatedAt:null,warnings:[]});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};};
const drafts=()=>({save:vi.fn(),clear:vi.fn(),archive:vi.fn()});
afterEach(()=>vi.useRealTimers());
describe('notes autosave safety',()=>{
 it('successful retry restores saved status after a failed clean reload',async()=>{
  const read=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(snap());const write=vi.fn();const s=new NotesSession(snap(),{read,write},drafts());await s.reload();expect(s.view.status).toBe('offline');await s.retry();expect(s.view.status).toBe('ok');expect(write).not.toHaveBeenCalled();s.dispose();
 });
 it('debounces600ms and chains only one write, preserving input received during slow save',async()=>{
  vi.useFakeTimers();const first=deferred<NotesSnapshot>(),second=deferred<NotesSnapshot>();const write=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);const d=drafts();const s=new NotesSession(snap(),{read:async()=>snap(),write},d);
  s.change(board('第一轮'));expect(d.save).toHaveBeenCalled();await vi.advanceTimersByTimeAsync(599);expect(write).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(write).toHaveBeenCalledTimes(1);
  s.change(board('后输入的不能丢'));await vi.advanceTimersByTimeAsync(1000);expect(write).toHaveBeenCalledTimes(1);first.resolve(snap('第一轮','r2'));await vi.advanceTimersByTimeAsync(0);expect(s.view.board?.columns[0].cards[0].body).toBe('后输入的不能丢');expect(write).toHaveBeenCalledTimes(2);expect(write.mock.calls[1][1]).toBe('r2');expect(d.clear).not.toHaveBeenCalled();
  second.resolve(snap('后输入的不能丢','r3'));await vi.advanceTimersByTimeAsync(0);expect(s.view.status).toBe('ok');expect(d.clear).toHaveBeenCalledTimes(1);s.dispose();
 });
 it('halts on409 without retrying new input and resolves file only after archiving draft',async()=>{
  const write=vi.fn().mockRejectedValue(Object.assign(new Error('冲突'),{status:409}));const d=drafts();const s=new NotesSession(snap(),{read:async()=>snap('别页版本','r2'),write},d);s.change(board('本页版本'));await s.flush();expect(s.view.status).toBe('conflict');expect(s.view.board?.columns[0].cards[0].body).toBe('本页版本');s.change(board('继续输入'));await s.flush();expect(write).toHaveBeenCalledTimes(1);await s.resolve('file');expect(d.archive).toHaveBeenCalled();expect(s.view.board?.columns[0].cards[0].body).toBe('别页版本');s.dispose();
 });
 it('failed reload preserves board and draft; does not clear before successful read',async()=>{
  const d=drafts();const s=new NotesSession(snap(),{read:vi.fn().mockRejectedValue(new Error('读失败')),write:vi.fn()},d);s.change(board('保留  空格\n换行'));await s.reload();expect(s.view.board?.columns[0].cards[0].body).toBe('保留  空格\n换行');expect(d.clear).not.toHaveBeenCalled();expect(d.archive).not.toHaveBeenCalled();s.dispose();
 });
 it('reload blocks input and waits for inflight save before reading',async()=>{
  const pending=deferred<NotesSnapshot>();const read=vi.fn().mockResolvedValue(snap('已落盘','r2'));const s=new NotesSession(snap(),{read,write:()=>pending.promise},drafts());s.change(board('已落盘'));const saving=s.flush();const reload=s.reload();expect(s.view.locked).toBe(true);s.change(board('被锁时不能改'));expect(s.view.board?.columns[0].cards[0].body).toBe('已落盘');expect(read).not.toHaveBeenCalled();pending.resolve(snap('已落盘','r2'));await saving;await reload;expect(read).toHaveBeenCalledTimes(1);expect(s.view.locked).toBe(false);s.dispose();
 });
 it('offline failure keeps draft and retry checks source revision before continuing',async()=>{
  const write=vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(snap('保留文字','r2'));const read=vi.fn().mockResolvedValue(snap());const d=drafts();const s=new NotesSession(snap(),{read,write},d);s.change(board('保留文字'));await s.flush();expect(s.view.status).toBe('offline');expect(d.clear).not.toHaveBeenCalled();await s.retry();expect(read).toHaveBeenCalledTimes(1);expect(s.view.status).toBe('ok');s.dispose();
 });
 it('restored stale draft enters conflict instead of overwriting manually recovered source',async()=>{
  const write=vi.fn(),d=drafts();const s=new NotesSession(snap('恢复的文件','r2'),{read:async()=>snap(),write},d);s.restore({board:board('旧草稿'),revision:'r1',updatedAt:'2026-11-26T00:00:00Z'});await s.flush();expect(s.view.status).toBe('conflict');expect(write).not.toHaveBeenCalled();expect(d.save.mock.calls.at(-1)?.[0].revision).toBe('r1');s.dispose();
 });
 it('draft storage failure stays visible but successful file save still succeeds',async()=>{
  const d=drafts();d.save.mockImplementation(()=>{throw Error('quota')});const s=new NotesSession(snap(),{read:async()=>snap(),write:async()=>snap('输入','r2')},d);s.change(board('输入'));expect(s.view.draftError).toBeTruthy();await s.flush();expect(s.view.status).toBe('ok');expect(s.view.unsaved).toBe(false);s.dispose();
 });
});
