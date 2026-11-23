import Link from 'next/link';
import { TEMPERATURE_PAGES } from '../lib/temperature-pages';

export const CANARY_PAGES = [
  { name: '指标大全', path: '/canary' },
  { name: '资产风向', path: '/canary/direction' },
  ...TEMPERATURE_PAGES,
] as const;

export function CanaryPageNav({ currentPath, busy = [] }: { currentPath: string; busy?: readonly string[] }) {
  return <nav aria-label="温度研究页面" className="canary-page-nav">
    {CANARY_PAGES.map(page => <Link key={page.path} href={page.path} aria-current={currentPath === page.path ? 'page' : undefined}>
      {page.name}{'kind' in page && busy.includes(page.kind) && ' · 更新中'}
    </Link>)}
  </nav>;
}
