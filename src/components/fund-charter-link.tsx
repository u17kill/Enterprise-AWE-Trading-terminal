import Link from "next/link";

export function FundCharterLink({ current = false }: { current?: boolean }) {
  return <Link className={`fund-charter-link${current ? " current" : ""}`} href="/charter" aria-current={current ? "page" : undefined}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 20 5v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>
    <span>基金宪法</span>
  </Link>;
}
