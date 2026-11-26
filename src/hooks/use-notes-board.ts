"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Connects the persistent notes controller on browser mount. */
import {useEffect,useRef,useState} from 'react';
import {validateNotes,type NotesSnapshot} from '../lib/notes-document';
import {NotesSession,type NotesDraft,type NotesView,type NotesDraftStore} from '../lib/notes-session';

const prefix='awe.notes.draft.v1.';
const pagePointer='awe.notes.page.v1';
export type NotesDraftChoice=NotesDraft&{key:string};
export function readNotesDrafts():NotesDraftChoice[]{
 const all:NotesDraftChoice[]=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
  try{const d=JSON.parse(localStorage.getItem(key)||'');if(d&&typeof d.revision==='string'&&typeof d.updatedAt==='string'&&!validateNotes(d.board).errors.length)all.push({...d,key});}catch{/* Keep unrecognized bytes intact. */}
 }
 return all.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
async function request(method:'GET'|'POST',body?:unknown):Promise<NotesSnapshot>{
 const response=await fetch('/api/notes',{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 const result=await response.json() as NotesSnapshot;
 if(!response.ok||!result.ok||!result.notes){throw Object.assign(new Error(result.error||'无法读取或写回个人笔记'),{status:response.status});}
 return result;
}
export function useNotesBoard(initial:NotesSnapshot){
 const [view,setView]=useState<NotesView>({board:initial.notes,status:initial.ok?'initial':'unavailable',error:initial.error||'',draftError:'',locked:true,conflict:null,unsaved:false,updatedAt:initial.updatedAt});
 const [choices,setChoices]=useState<NotesDraftChoice[]>([]);
 const session=useRef<NotesSession|null>(null);
 useEffect(()=>{
  // Never write through a cloned sessionStorage identity after Duplicate Tab.
  const key=prefix+crypto.randomUUID();let old:string|null=null,storageError='';
  try{old=sessionStorage.getItem(pagePointer);sessionStorage.setItem(pagePointer,key);}catch{storageError='无法记录本页恢复位置；可在恢复列表手动找回草稿';}
  const store:NotesDraftStore={
   save:d=>{localStorage.setItem(key,JSON.stringify(d));},
   clear:()=>{localStorage.removeItem(key);},
   archive:d=>{localStorage.setItem(prefix+crypto.randomUUID(),JSON.stringify(d));},
  };
  const s=new NotesSession(initial,{read:()=>request('GET'),write:(notes,revision)=>request('POST',{notes,revision})},store);session.current=s;
  const update=()=>{setView(s.view);try{setChoices(readNotesDrafts().filter(d=>d.key!==key));}catch{/* Controller already displays draft write errors. */}};
  const unsubscribe=s.subscribe(update);
  try{const all=readNotesDrafts();const own=all.find(d=>d.key===old);if(own&&JSON.stringify(own.board)!==JSON.stringify(initial.notes))s.restore(own);setChoices(all.filter(d=>d.key!==key));}catch{storageError='浏览器草稿不可用，请注意本机文件保存状态并及时导出';}
  if(storageError)s.setDraftError(storageError);update();
  return()=>{unsubscribe();s.dispose();session.current=null;};
 },[initial]);
 useEffect(()=>{
  if(!view.unsaved)return;
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);
  const guard=(e:MouseEvent)=>{if(!view.draftError)return;const a=(e.target as Element)?.closest?.('a[href]');if(a&&!a.getAttribute('href')?.startsWith('#')&&!confirm('草稿未保留，离开前请导出或完成写回。仍要离开？')){e.preventDefault();e.stopPropagation();}};
  document.addEventListener('click',guard,true);return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',guard,true);};
 },[view.unsaved,view.draftError]);
 const reload=async()=>{if(view.unsaved&&!confirm('改用源文件内容？当前草稿会先保留为恢复副本，文件不会被改写。'))return;await session.current?.reload();};
 const resolve=async(choice:'file'|'local')=>{if(!confirm(choice==='file'?'使用源文件内容？当前文字先保留为草稿副本。':'用本页文字覆盖最新文件？旧文件会先备份。'))return;await session.current?.resolve(choice);};
 const restore=(key:string)=>{
  const s=session.current;if(!s||s.view.locked)return;
  try{const d=readNotesDrafts().find(x=>x.key===key);if(!d)return;if(!confirm('恢复此草稿？当前未保存文字会先保留为恢复副本。'))return;if(s.view.unsaved&&s.view.board)localStorage.setItem(prefix+crypto.randomUUID(),JSON.stringify({board:s.view.board,revision:'unknown-recovery',updatedAt:new Date().toISOString()}));s.restore(d);}catch{s.setDraftError('无法保留当前文字，未切换草稿；请先导出');}
 };
 return {...view,status:view.draftError&&view.unsaved&&!['conflict','saving'].includes(view.status)?'nostore':view.status,choices,change:(board:NonNullable<NotesSnapshot['notes']>)=>session.current?.change(board),retry:async()=>{await session.current?.retry();},reload,resolve,restore};
}
