'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'cyberpunk';
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Cyberpunk theme"
      title={`Switch to ${dark ? 'Light' : 'Cyberpunk'} theme`} onClick={toggleTheme}
      className="m-0 inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full border border-wb-border bg-wb-raised px-3.5 py-2 text-xs font-semibold text-wb-text shadow-sm transition-colors hover:border-wb-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wb-accent motion-reduce:transition-none">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" className="text-wb-accent">
        {dark ? <path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z" /> : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>}
      </svg>
      <span>{dark ? 'Cyberpunk' : 'Light'}</span>
      <span aria-hidden="true" className={`relative h-5 w-9 rounded-full border border-wb-border ${dark ? 'bg-wb-accent/20' : 'bg-wb-muted/15'}`}>
        <span className={`absolute top-0.5 left-0 h-3.5 w-3.5 rounded-full bg-wb-accent transition-transform motion-reduce:transition-none ${dark ? 'translate-x-[17px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}
