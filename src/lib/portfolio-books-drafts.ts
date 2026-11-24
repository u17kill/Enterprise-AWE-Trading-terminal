import type {Book,BookData} from './portfolio-books-store';
import {validateBook} from './portfolio-books-validation';

export type BookDraft={matrix:BookData;revision:string;dirty:boolean};
// Earlier dashboards stored the book directly under these same keys. Never discard
// those drafts or silently choose them over a newer file: ask for a conflict choice.
export function parseBookDraft(book:Book,raw:string):BookDraft {
 const value=JSON.parse(raw);
 const wrapped=value&&typeof value==='object'&&'matrix' in value;
 const matrix=wrapped?value.matrix:value?.data??value;
 if(validateBook(book,matrix).length)throw new Error('无效草稿');
 return {matrix,revision:wrapped&&typeof value.revision==='string'?value.revision:'legacy-draft',dirty:wrapped?value.dirty!==false:true};
}
export function backupBookDraft(storage:Pick<Storage,'setItem'>,key:string,draft:BookDraft){
 const backupKey=key+'.backup.'+Date.now();
 storage.setItem(backupKey,JSON.stringify(draft));
 return backupKey;
}
