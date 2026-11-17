"use client";
import { useEffect, ReactNode } from 'react';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Load theme on mount
    const stored = localStorage.getItem('theme') || 'dark';
    const isDark = stored === 'dark';
    
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  return <>{children}</>;
}
