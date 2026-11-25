'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

interface SidebarContextType {
  isOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  activeAppId: string | null;
  activeRoleTitle: string | null;
  setActiveRoleTitle: (title: string | null) => void;
}

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('trace_sidebar_change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('trace_sidebar_change', callback);
  };
};

const getSnapshot = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('trace_sidebar_collapsed') === 'true';
  } catch {
    return false;
  }
};

const getServerSnapshot = () => false;

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [activeRoleTitle, setActiveRoleTitle] = useState<string | null>(null);
  const pathname = usePathname();

  const setCollapsed = useCallback((collapsed: boolean) => {
    try {
      localStorage.setItem('trace_sidebar_collapsed', String(collapsed));
      window.dispatchEvent(new Event('trace_sidebar_change'));
    } catch {
      // Ignore
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    try {
      const current = localStorage.getItem('trace_sidebar_collapsed') === 'true';
      localStorage.setItem('trace_sidebar_collapsed', String(!current));
      window.dispatchEvent(new Event('trace_sidebar_change'));
    } catch {
      // Ignore
    }
  }, []);

  // Extract application ID from URL if present during render
  const match = pathname ? pathname.match(/\/(prep|arena|report|why-not)\/([^/?#]+)/) : null;
  const urlAppId = match?.[2] || null;

  // Retrieve cached application ID from localStorage if not present in URL
  const [cachedAppId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('trace_active_app_id');
      } catch {
        return null;
      }
    }
    return null;
  });

  // Sync active ID to localStorage when on an application page
  useEffect(() => {
    if (urlAppId) {
      try {
        localStorage.setItem('trace_active_app_id', urlAppId);
      } catch {
        // Ignore
      }
    }
  }, [urlAppId]);

  // Adjust state during render on route change to auto-close drawer (official React state adjustment pattern)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (isOpen) {
      setIsOpen(false);
    }
  }

  const activeAppId = urlAppId || cachedAppId;

  const openSidebar = useCallback(() => setIsOpen(true), []);
  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard shortcuts (Cmd+B / Ctrl+B to toggle, Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox');

      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      if (!isInput && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setIsOpen((prev) => !prev);
        } else {
          toggleCollapse();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        isCollapsed,
        toggleCollapse,
        setCollapsed,
        activeAppId,
        activeRoleTitle,
        setActiveRoleTitle,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return {
      isOpen: false,
      openSidebar: () => {},
      closeSidebar: () => {},
      toggleSidebar: () => {},
      isCollapsed: false,
      toggleCollapse: () => {},
      setCollapsed: () => {},
      activeAppId: null,
      activeRoleTitle: null,
      setActiveRoleTitle: () => {},
    };
  }
  return context;
}
