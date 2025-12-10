import React, { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Loader } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  pullThreshold?: number;
  className?: string;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  pullThreshold = 80,
  className = '',
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);

  const opacity = useTransform(pullDistance, [0, pullThreshold], [0, 1]);
  const scale = useTransform(pullDistance, [0, pullThreshold], [0.5, 1]);
  const rotate = useTransform(pullDistance, [0, pullThreshold * 2], [0, 720]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].pageY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply rubber-band effect
      const dampedDiff = diff * 0.4;
      pullDistance.set(dampedDiff);
    }
  }, [isPulling, isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    const distance = pullDistance.get();

    if (distance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      pullDistance.set(pullThreshold * 0.75);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }

    pullDistance.set(0);
    setIsPulling(false);
  }, [isPulling, pullDistance, pullThreshold, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {(isPulling || isRefreshing) && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-0 z-10"
            style={{
              y: useTransform(pullDistance, (d) => Math.min(d, pullThreshold) - 40),
            }}
          >
            <motion.div
              className="w-10 h-10 rounded-full bg-light-card shadow-lg flex items-center justify-center border border-light-border"
              style={{ opacity, scale }}
            >
              {isRefreshing ? (
                <Loader size={20} className="text-primary animate-spin" />
              ) : (
                <motion.div style={{ rotate }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        style={{
          y: useTransform(pullDistance, (d) => Math.min(d, pullThreshold) * 0.5),
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
