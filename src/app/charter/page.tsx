import {FundCharterEditor} from '../../components/fund-charter-editor';
import {readCharter} from '../../lib/fund-charter-store';
import type {CharterSnapshot} from '../../lib/fund-charter-document';

export const dynamic='force-dynamic';

export default async function FundCharterPage(){
 let initial:CharterSnapshot;
 try{initial=await readCharter();}
 catch{initial={ok:false,document:null,revision:'unreadable',updatedAt:null,error:'无法读取基金宪法文件，原文件已保留。请检查文件权限或恢复备份后重新读取。'};}
 return <FundCharterEditor initial={initial}/>;
}
