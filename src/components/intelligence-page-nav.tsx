import Link from 'next/link';

export const INTELLIGENCE_PAGES = [
  {path:'/news',name:'市场新闻'},
  {path:'/voices',name:'专家观点'},
  {path:'/research',name:'机构研报'},
  {path:'/calendar',name:'财经日历'},
  {path:'/holdings',name:'大佬持仓'},
] as const;

export function IntelligencePageNav({currentPath}:{currentPath:string}) {
  return <nav className="intelligence-page-nav" aria-label="市场情报页面">
    {INTELLIGENCE_PAGES.map(page=><Link key={page.path} href={page.path} replace aria-current={currentPath===page.path?'page':undefined}>{page.name}</Link>)}
  </nav>;
}
