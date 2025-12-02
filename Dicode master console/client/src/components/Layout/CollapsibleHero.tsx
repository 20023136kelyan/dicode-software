'use client';

import { ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleHeroProps {
  children: ReactNode;
  collapseThreshold?: number;
  showManualCollapse?: boolean;
}

const SCROLL_DELTA = 12;

const getStorageKey = (pathname: string): string => {
  return `hero-card-collapsed-${pathname}`;
};

const getStoredCollapsedState = (pathname: string): boolean => {
  if (typeof window === 'undefined') return false;
  const key = getStorageKey(pathname);
  const stored = localStorage.getItem(key);
  return stored === 'true';
};

const setStoredCollapsedState = (pathname: string, collapsed: boolean) => {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(pathname);
  localStorage.setItem(key, String(collapsed));
};

export default function CollapsibleHero({
  children,
  collapseThreshold = 160,
  showManualCollapse = false,
}: CollapsibleHeroProps) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() => getStoredCollapsedState(pathname));

  // Update collapsed state when pathname changes (user navigates to different page)
  useEffect(() => {
    setIsCollapsed(getStoredCollapsedState(pathname));
  }, [pathname]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    const measure = () => {
      if (!contentRef.current) return;
      setContentHeight(contentRef.current.scrollHeight);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(contentRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>('[data-scroll-container]');
    if (!scrollContainer) return;

    let lastScrollTop = scrollContainer.scrollTop;

    const handleScroll = () => {
      const currentTop = scrollContainer.scrollTop;
      const delta = currentTop - lastScrollTop;

      if (delta > SCROLL_DELTA && currentTop > collapseThreshold) {
        setIsCollapsed(true);
        setStoredCollapsedState(pathname, true);
      }

      lastScrollTop = currentTop;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [collapseThreshold, pathname]);

  const handleManualExpand = () => {
    setIsCollapsed(false);
    setStoredCollapsedState(pathname, false);

    const scrollContainer = document.querySelector<HTMLElement>('[data-scroll-container]');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleManualCollapse = () => {
    setIsCollapsed(true);
    setStoredCollapsedState(pathname, true);
  };

  const measuredHeight = contentHeight ? `${contentHeight}px` : 'none';
  const maxHeight = isCollapsed ? '0px' : measuredHeight;

  return (
    <div className="relative">
      <div
        className="overflow-hidden transition-[max-height,opacity,transform] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          maxHeight,
          opacity: isCollapsed ? 0 : 1,
          transform: isCollapsed ? 'translateY(-12px)' : 'translateY(0)',
        }}
        aria-hidden={isCollapsed}
      >
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Expand button (shown when collapsed) */}
      <div
        className={`pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 transition-opacity duration-300 ${
          isCollapsed ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-900"
          onClick={handleManualExpand}
          aria-label="Expand hero card"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Collapse button (shown when expanded, below the card) */}
      {showManualCollapse && (
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            !isCollapsed ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: contentHeight ? `${contentHeight + 12}px` : 'auto',
          }}
        >
          <button
            type="button"
            className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:text-slate-900"
            onClick={handleManualCollapse}
            aria-label="Collapse hero card"
          >
            <ChevronDown className="h-5 w-5 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
}
