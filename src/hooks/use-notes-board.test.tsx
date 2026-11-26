import {renderHook,act,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useNotesBoard} from './use-notes-board';
import {defaultNotes,type NotesSnapshot} from '../lib/notes-document';
const initial=(revision='r1'):NotesSnapshot=>({ok:true,notes:defaultNotes(),revision,updatedAt:null,warnings:[]});
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
describe('notes browser recovery',()=>{
 it('synchronously saves every change and forks draft identity on reload',()=>{
  const source=initial();const h=renderHook(()=>useNotesBoard(source));const old=sessionStorage.getItem('awe.notes.page.v1')!;
  act(()=>h.result.current.change({...source.notes!,columns:[{id:'col-test',title:'我的  原文',cards:[]}]}));expect(JSON.parse(localStorage.getItem(old)!).board.columns[0].title).toBe('我的  原文');h.unmount();
  const again=renderHook(()=>useNotesBoard(source));expect(again.result.current.board?.columns[0].title).toBe('我的  原文');expect(sessionStorage.getItem('awe.notes.page.v1')).not.toBe(old);expect(localStorage.getItem(old)).not.toBeNull();
 });
 it('stale drafts retain their old baseline across repeated refreshes and never auto overwrite',async()=>{
  const key='awe.notes.draft.v1.stale';sessionStorage.setItem('awe.notes.page.v1',key);localStorage.setItem(key,JSON.stringify({board:{...defaultNotes(),columns:[]},revision:'r1',updatedAt:new Date().toISOString()}));
  const source=initial('r2');const first=renderHook(()=>useNotesBoard(source));expect(first.result.current.status).toBe('conflict');const next=sessionStorage.getItem('awe.notes.page.v1')!;expect(JSON.parse(localStorage.getItem(next)!).revision).toBe('r1');first.unmount();
  const again=renderHook(()=>useNotesBoard(source));await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(again.result.current.status).toBe('conflict');expect(fetch).not.toHaveBeenCalled();
 });
});
