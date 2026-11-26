// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {defaultNotes,validateNotes,notesStats,formatNotesTime} from './notes-document';
describe('notes model',()=>{
 it('creates independent empty columns and counts original UTF16 body including whitespace',()=>{
 const board=defaultNotes();expect(board.columns).toHaveLength(3);expect(notesStats(board)).toEqual({columns:3,cards:0,chars:0});
 board.columns[0].cards.push({id:'c-one',title:'',body:'  中\n😀',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'});
 expect(notesStats(board)).toEqual({columns:3,cards:1,chars:6});expect(defaultNotes().columns[0].cards).toEqual([]);
 });
 it('allows zero columns, warns without truncating and rejects duplicate ids or wrong types',()=>{
 const board=defaultNotes();board.columns=[];expect(validateNotes(board).errors).toEqual([]);
 board.columns=[{id:'col-one',title:'a'.repeat(17),cards:[{id:'c-one',title:'x'.repeat(61),body:'',created:'2026-01-01T00:00:00Z',updated:'2026-01-01T00:00:00Z'}]}];
 expect(validateNotes(board).warnings).toHaveLength(2);expect(validateNotes(board).errors).toEqual([]);
 board.columns[0].cards.push({...board.columns[0].cards[0]});expect(validateNotes(board).errors.length).toBeGreaterThan(0);
 expect(validateNotes({...board,columns:'bad'}).errors.length).toBeGreaterThan(0);
 });
 it('displays ISO and legacy timestamps in Singapore time',()=>{
 expect(formatNotesTime('2026-01-01T00:00:00Z')).toContain('08:00');expect(formatNotesTime('2026-01-01 08:00')).toContain('08:00');expect(formatNotesTime('bad')).toBe('—');
 });
});

it('shows month and day with short card timestamps',()=>{expect(formatNotesTime('2026-11-26T00:00:00Z',true)).toContain('11/26');expect(formatNotesTime('2026-11-26T00:00:00Z',true)).toContain('08:00');});
