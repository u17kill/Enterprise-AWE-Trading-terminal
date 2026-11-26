import {PersonalNotes} from '../../components/personal-notes';
import {readNotes} from '../../lib/notes-store';
import type {NotesSnapshot} from '../../lib/notes-document';
import '../personal-notes.css';
import {headers} from 'next/headers';

export const dynamic='force-dynamic';
export default async function NotesPage(){
 let initial:NotesSnapshot;
 try{
  const host=(await headers()).get('host')||'';
  const address=new URL(`http://${host}`);
  if(address.host!==host||!['localhost','127.0.0.1','[::1]'].includes(address.hostname))throw new Error('Local notes only');
  initial=await readNotes();
 }
 catch{initial={ok:false,notes:null,revision:'unreadable',updatedAt:null,warnings:[],error:'无法读取本机笔记，原文件已保留。请检查目录或恢复备份后重读。'};}
 return <PersonalNotes initial={initial}/>;
}
