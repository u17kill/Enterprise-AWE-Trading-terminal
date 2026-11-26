import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({host:'127.0.0.1:3128',read:vi.fn()}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:state.host})}));
vi.mock('../../lib/notes-store',()=>({readNotes:state.read}));
vi.mock('../../components/personal-notes',()=>({PersonalNotes:()=>null}));
import NotesPage from './page';
import {defaultNotes} from '../../lib/notes-document';
beforeEach(()=>{state.host='127.0.0.1:3128';state.read.mockReset().mockResolvedValue({ok:true,notes:defaultNotes(),revision:'missing',updatedAt:null,warnings:[]});});
describe('private notes page',()=>{
 it('reads runtime notes for a loopback host',async()=>{const page=await NotesPage();expect(state.read).toHaveBeenCalledTimes(1);expect(page.props.initial.ok).toBe(true);});
 it('never reads or embeds private notes for an external host',async()=>{state.host='attacker.example';const page=await NotesPage();expect(state.read).not.toHaveBeenCalled();expect(page.props.initial.notes).toBeNull();});
 it('does not silently substitute defaults for a corrupt file',async()=>{state.read.mockRejectedValue(new Error('corrupt'));const page=await NotesPage();expect(page.props.initial.notes).toBeNull();expect(page.props.initial.ok).toBe(false);});
});
