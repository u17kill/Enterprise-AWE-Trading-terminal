import {validateNotes,type NotesBoard,type NotesSnapshot} from './notes-document';

export type NotesDraft={board:NotesBoard;revision:string;updatedAt:string};
export type NotesTransport={read:()=>Promise<NotesSnapshot>;write:(board:NotesBoard,revision:string)=>Promise<NotesSnapshot>};
export type NotesDraftStore={save:(draft:NotesDraft)=>void;clear:()=>void;archive:(draft:NotesDraft)=>void};
export type NotesView={board:NotesBoard|null;status:string;error:string;draftError:string;locked:boolean;conflict:NotesSnapshot|null;unsaved:boolean;updatedAt:string|null};
const clone=<T,>(value:T):T=>structuredClone(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function valid(s:NotesSnapshot){if(!s.ok||!s.notes||validateNotes(s.notes).errors.length)throw new Error(s.error||'无法读取有效的笔记文件');return s;}
function acknowledge(current:NotesBoard,sent:NotesBoard,saved:NotesBoard):NotesBoard{
 const sentCards=new Map(sent.columns.flatMap(c=>c.cards.map(card=>[card.id,card] as const)));
 const savedCards=new Map(saved.columns.flatMap(c=>c.cards.map(card=>[card.id,card] as const)));
 return {...current,updated:saved.updated,columns:current.columns.map(col=>({...col,cards:col.cards.map(card=>same(card,sentCards.get(card.id))?savedCards.get(card.id)||card:card)}))};
}

/** Single owner of autosave ordering. Late replies acknowledge only their captured generation. */
export class NotesSession{
 view:NotesView;
 private revision:string;
 private generation=0;
 private saved=0;
 private paused=false;
 private disposed=false;
 private flight:Promise<void>|null=null;
 private timer:ReturnType<typeof setTimeout>|null=null;
 private listeners=new Set<()=>void>();
 constructor(initial:NotesSnapshot,private transport:NotesTransport,private drafts:NotesDraftStore){
  this.revision=initial.revision;this.paused=!initial.ok;
  this.view={board:initial.notes?clone(initial.notes):null,status:initial.ok?initial.revision==='missing'?'initial':'ok':'unavailable',error:initial.error||'',draftError:'',locked:false,conflict:null,unsaved:false,updatedAt:initial.updatedAt};
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(patch:Partial<NotesView>={}){this.view={...this.view,...patch,unsaved:this.generation>this.saved};if(!this.disposed)this.listeners.forEach(f=>f());}
 private record():NotesDraft{return{board:clone(this.view.board!),revision:this.revision,updatedAt:new Date().toISOString()};}
 private persist(){try{this.drafts.save(this.record());this.emit({draftError:''});}catch{this.emit({draftError:'草稿也没写成 · 只在当前页，请重试保存或导出JSON'});}}
 private clearTimer(){if(this.timer){clearTimeout(this.timer);this.timer=null;}}
 private schedule(){this.clearTimer();if(!this.paused&&!this.disposed)this.timer=setTimeout(()=>{this.timer=null;void this.flush();},600);}
 change(next:NotesBoard){
  if(this.view.locked||!this.view.board||this.disposed)return;
  this.generation++;this.emit({board:clone(next),...(!this.paused?{status:this.flight?'saving':'dirty',error:''}:{})});this.persist();this.schedule();
 }
 restore(draft:NotesDraft){
  if(this.view.locked||this.disposed)return;
  if(this.flight){this.emit({error:'正在写回，完成后再恢复其他草稿'});return;}
  const issues=validateNotes(draft.board);if(issues.errors.length){this.emit({error:'草稿格式无效，原副本已保留'});return;}
  const mismatch=draft.revision!==this.revision;
  const file=this.view.board?{ok:this.view.status!=='unavailable',notes:clone(this.view.board),revision:this.revision,updatedAt:this.view.updatedAt,warnings:[]} as NotesSnapshot:null;
  this.revision=draft.revision;
  this.generation++;this.emit({board:clone(draft.board),status:mismatch?'conflict':'draft',conflict:mismatch?(file||{ok:false,notes:null,revision:this.revision,updatedAt:null,warnings:[]}):null,error:mismatch?'草稿与源文件的版本不同，请选择保留哪份内容':''});
  this.paused=mismatch||!file?.ok;this.persist();this.schedule();
 }
 async flush():Promise<void>{
  this.clearTimer();if(this.flight)return this.flight;
  if(this.paused||this.disposed||!this.view.board||this.generation===this.saved)return;
  // Assign before starting asynchronous work, including transports that throw synchronously.
  this.flight=Promise.resolve().then(()=>this.drain()).finally(()=>{this.flight=null;});
  return this.flight;
 }
 private async drain(){
  while(!this.paused&&!this.disposed&&this.generation>this.saved&&this.view.board){
   const generation=this.generation,board=clone(this.view.board),revision=this.revision;
   this.emit({status:'saving',error:''});
   try{
    const result=valid(await this.transport.write(board,revision));this.revision=result.revision;this.saved=generation;
    this.emit({board:this.generation===generation?clone(result.notes!):acknowledge(this.view.board,board,result.notes!),updatedAt:result.updatedAt});
    if(this.generation===this.saved){
     try{this.drafts.clear();this.emit({draftError:''});}catch{this.emit({draftError:'文件已保存，但本页浏览器草稿未能清理'});}
     this.emit({status:'ok'});
    }else{this.persist();this.emit({status:'dirty'});}
   }catch(error){
    this.paused=true;
    const e=error as Error&{status?:number};
    if(e.status===409){
     let conflict:NotesSnapshot;try{conflict=valid(await this.transport.read());}catch{conflict={ok:false,notes:null,revision:'',updatedAt:null,warnings:[]};}
     this.emit({status:'conflict',conflict,error:'源文件已被其他页面修改，当前草稿保留，请选择使用文件或保留本页覆盖'});
    }else this.emit({status:e instanceof TypeError?'offline':'fail',error:e.message||'写回失败，草稿保留'});
    this.persist();
   }
  }
 }
 async retry(){
  if(this.view.locked||this.disposed)return;
  if(!this.view.board){await this.reload();return;}
  if(this.view.conflict)return;
  this.emit({locked:true});this.clearTimer();
  try{
   if(this.flight)await this.flight;
   const file=valid(await this.transport.read());
   if(file.revision!==this.revision){this.paused=true;this.emit({status:'conflict',conflict:file,error:'源文件版本已变化，草稿保留，请选择'});return;}
   this.paused=false;this.emit({error:'',status:this.generation===this.saved?(file.revision==='missing'?'initial':'ok'):'dirty',updatedAt:file.updatedAt});
  }catch(e){this.paused=true;this.emit({status:e instanceof TypeError?'offline':'fail',error:(e as Error).message});return;}
  finally{this.emit({locked:false});}
  await this.flush();
 }
 async reload(){
  if(this.view.locked||this.disposed)return;
  this.paused=true;this.clearTimer();this.emit({locked:true,error:''});
  try{
   if(this.flight)await this.flight;
   const file=valid(await this.transport.read());
   // Read first; if it failed, no draft has been cleared or replaced.
   if(this.generation>this.saved&&this.view.board)this.drafts.archive(this.record());
   this.drafts.clear();this.revision=file.revision;this.saved=this.generation;this.paused=false;
   this.emit({board:clone(file.notes!),status:file.revision==='missing'?'initial':'ok',updatedAt:file.updatedAt,conflict:null,draftError:'',error:''});
  }catch(e){this.emit({status:e instanceof TypeError?'offline':'fail',error:'重读失败，当前草稿未丢弃：'+(e as Error).message});}
  finally{this.emit({locked:false});}
 }
 async resolve(choice:'file'|'local'){
  if(choice==='file'){await this.reload();return;}
  if(this.view.locked||this.disposed||!this.view.board)return;
  this.paused=true;this.clearTimer();this.emit({locked:true});
  try{
   if(this.flight)await this.flight;
   const file=valid(await this.transport.read());this.revision=file.revision;this.paused=false;
   this.emit({conflict:null,error:'',status:'dirty'});this.persist();
  }catch(e){this.emit({error:'无法核对最新文件，草稿保留：'+(e as Error).message});return;}
  finally{this.emit({locked:false});}
  await this.flush();
 }
 setDraftError(error:string){this.emit({draftError:error});}
 dispose(){this.disposed=true;this.clearTimer();this.listeners.clear();}
}
