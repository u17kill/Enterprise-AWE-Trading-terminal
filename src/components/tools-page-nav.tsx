import Link from 'next/link';

const pages=[['/chart/SPX','图表空间'],['/portfolio','当前持仓'],['/options','期权计算']] as const;

export function ToolsPageNav({currentPath}:{currentPath:string}){
 const chart=currentPath.startsWith('/chart/');
 return <nav className="tools-page-nav" aria-label="投资工具页面">
  {pages.map(([path,name])=><Link key={path} href={path==='/chart/SPX'&&chart?currentPath:path} replace aria-current={(path==='/chart/SPX'?chart:currentPath===path)?'page':undefined}>{name}</Link>)}
 </nav>;
}
