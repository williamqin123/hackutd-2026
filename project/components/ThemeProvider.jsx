'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '../lib/theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('cyberpunk');

  useEffect(() => {
    let initial = document.documentElement.dataset.theme === 'light' ? 'light' : 'cyberpunk';
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'cyberpunk') initial = saved;
    } catch {}
    document.documentElement.dataset.theme = initial;
    setTheme(initial);
    const sync = (event) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = event.newValue === 'light' ? 'light' : 'cyberpunk';
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = theme === 'light' ? '#edf2f6' : '#070b14';
    });
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'cyberpunk' ? 'light' : 'cyberpunk';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch {
      // The switch still works when browser storage is unavailable.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
