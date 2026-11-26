import {render,screen,fireEvent,within,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {FundCharterEditor} from './fund-charter-editor';
import {defaultCharter,type CharterSnapshot} from '../lib/fund-charter-document';
const initial=():CharterSnapshot=>({ok:true,document:defaultCharter(),revision:'missing',updatedAt:null});
const click=(name:string)=>fireEvent.click(screen.getAllByRole('button',{name})[0]);
function add(){click('编辑基金宪法');click('新增信条');fireEvent.change(screen.getByLabelText('信条标题'),{target:{value:'测试新增信条'}});fireEvent.change(screen.getByLabelText(/正文/),{target:{value:'第一段\n\n第二段'}});click('应用到页面');}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.stubGlobal('confirm',vi.fn(()=>true));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('可编辑基金宪法',()=>{
 it('新增和跨支柱移动，编号和标题自动更新，应用不直接写文件',()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<FundCharterEditor initial={initial()}/>);add();
  expect(screen.getAllByRole('article')).toHaveLength(11);expect(screen.getByRole('heading',{name:'投资信条'})).toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
  const article=screen.getByRole('heading',{name:'测试新增信条'}).closest('article')!;fireEvent.click(within(article).getByRole('button',{name:'编辑信条'}));
  fireEvent.change(screen.getByLabelText('所属支柱'),{target:{value:'compounding'}});click('应用到页面');
  expect(document.getElementById('compounding')).toHaveTextContent('测试新增信条');
  fireEvent.click(within(screen.getByRole('heading',{name:'测试新增信条'}).closest('article')!).getByRole('button',{name:'删除信条'}));expect(screen.getAllByRole('article')).toHaveLength(10);
 });
 it('支柱可添加、排序和删除',()=>{
  render(<FundCharterEditor initial={initial()}/>);click('编辑基金宪法');click('新增支柱');fireEvent.change(screen.getByLabelText('支柱名称'),{target:{value:'新支柱'}});click('应用到页面');
  const section=screen.getByRole('heading',{name:'新支柱'}).closest('section')!;fireEvent.click(within(section).getByRole('button',{name:'上移支柱'}));expect(document.querySelectorAll('.charter-pillar')[3]).toHaveTextContent('新支柱');
  fireEvent.click(within(section).getByRole('button',{name:'删除支柱'}));expect(document.querySelectorAll('.charter-pillar')).toHaveLength(4);
 });
 it('未应用表单在刷新后恢复，同页保存成功后不再恢复旧草稿',async()=>{
  const view=render(<FundCharterEditor initial={initial()}/>);click('编辑基金宪法');click('新增信条');fireEvent.change(screen.getByLabelText('信条标题'),{target:{value:'未应用文字'}});view.unmount();
  const second=render(<FundCharterEditor initial={initial()}/>);expect(screen.getByLabelText('信条标题')).toHaveValue('未应用文字');click('应用到页面');
  const saved=JSON.parse(localStorage.getItem(sessionStorage.getItem('awe.fund-charter.page.v1')!)!).document;
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,document:saved,revision:'saved',updatedAt:'2026-11-26T00:00:00Z'})}));click('保存全部修改');
  await screen.findByText('已保存到本机文件');second.unmount();render(<FundCharterEditor initial={{ok:true,document:saved,revision:'saved',updatedAt:null}}/>);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getAllByRole('article')).toHaveLength(11);
 });
 it('失败保留草稿，冲突不会静默覆盖文件',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:'磁盘不可写'})});vi.stubGlobal('fetch',fetch);render(<FundCharterEditor initial={initial()}/>);add();click('保存全部修改');await screen.findByText(/磁盘不可写/);expect(localStorage.length).toBeGreaterThan(0);
  fetch.mockResolvedValueOnce({ok:false,status:409,json:async()=>({error:'冲突'})}).mockResolvedValueOnce({ok:true,json:async()=>({...initial(),revision:'other'})});click('保存全部修改');await screen.findByText(/文件与本机草稿的版本不同/);expect(screen.getByRole('button',{name:'保存全部修改'})).toBeDisabled();expect(screen.getAllByRole('article')).toHaveLength(11);expect(fetch).toHaveBeenCalledTimes(3);
 });
 it('其他标签页的旧草稿不会自动覆盖已保存文件',async()=>{
  localStorage.setItem('awe.fund-charter.draft.v1.other',JSON.stringify({document:{...defaultCharter(),title:'其他页未保存'},revision:'missing',updatedAt:new Date().toISOString()}));render(<FundCharterEditor initial={initial()}/>);
  await waitFor(()=>expect(screen.getByRole('heading',{name:'投资十大信条'})).toBeInTheDocument());expect(screen.queryByRole('heading',{name:'其他页未保存'})).not.toBeInTheDocument();
 });
 it('复制标签页后分配独立草稿键，不清理其他页的新版草稿',async()=>{
  const key='awe.fund-charter.draft.v1.original';sessionStorage.setItem('awe.fund-charter.page.v1',key);
  const draft={document:{...defaultCharter(),title:'复制的草稿'},revision:'missing',updatedAt:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(draft));
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,document:draft.document,revision:'saved',updatedAt:null})}));render(<FundCharterEditor initial={initial()}/>);
  expect(sessionStorage.getItem('awe.fund-charter.page.v1')).not.toBe(key);
  const newer=JSON.stringify({...draft,document:{...draft.document,title:'另页继续输入'}});localStorage.setItem(key,newer);click('保存全部修改');await screen.findByText('已保存到本机文件');expect(localStorage.getItem(key)).toBe(newer);
 });
 it('不完整的导入表单不会作为可编辑表单恢复',()=>{
  const key='awe.fund-charter.draft.v1.invalid';sessionStorage.setItem('awe.fund-charter.page.v1',key);localStorage.setItem(key,JSON.stringify({document:defaultCharter(),revision:'missing',updatedAt:new Date().toISOString(),form:{kind:'final',fields:{},original:{}}}));render(<FundCharterEditor initial={initial()}/>);expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(localStorage.getItem(key)).not.toBeNull();
 });
});
