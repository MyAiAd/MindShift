'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { selectionFeedback, impactFeedback } from '@/lib/haptics';

export interface SwipeableSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number[]; // Array of heights in pixels, e.g., [300, 600]
  initialSnapPoint?: number; // Index of initial snap point
  className?: string;
}

export function SwipeableSheet({
  isOpen,
  onClose,
  children,
  snapPoints = [300, window.innerHeight * 0.9],
  initialSnapPoint = 0,
  className,
}: SwipeableSheetProps) {
  const [currentSnapIndex, setCurrentSnapIndex] = React.useState(initialSnapPoint);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const [startY, setStartY] = React.useState(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  const currentHeight = snapPoints[currentSnapIndex] + dragY;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow dragging from the handle or top area
    const target = e.target as HTMLElement;
    if (!target.closest('.sheet-handle-area')) return;

    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    selectionFeedback();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const deltaY = startY - currentY;

    setDragY(deltaY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 50; // Minimum drag distance to trigger snap

    // Determine if we should close, snap up, or snap down
    if (dragY < -threshold) {
      // Dragged down
      if (currentSnapIndex === 0) {
        // At lowest point, close the sheet
        impactFeedback('medium');
        onClose();
      } else {
        // Snap to lower point
        impactFeedback('light');
        setCurrentSnapIndex(currentSnapIndex - 1);
      }
    } else if (dragY > threshold) {
      // Dragged up
      if (currentSnapIndex < snapPoints.length - 1) {
        impactFeedback('light');
        setCurrentSnapIndex(currentSnapIndex + 1);
      }
    } else {
      // Snap back to current position
      selectionFeedback();
    }

    setDragY(0);
  };

  const handleBackdropClick = () => {
    impactFeedback('medium');
    onClose();
  };

  // Reset snap point when sheet closes
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentSnapIndex(initialSnapPoint);
      setDragY(0);
    }
  }, [isOpen, initialSnapPoint]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
          'transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white dark:bg-gray-900',
          'rounded-t-3xl shadow-2xl',
          'transition-transform duration-300 ease-out',
          isDragging && 'transition-none',
          className
        )}
        style={{
          height: `${currentHeight}px`,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle Area */}
        <div className="sheet-handle-area sticky top-0 z-10 flex items-center justify-center py-3 bg-white dark:bg-gray-900 rounded-t-3xl border-b border-gray-200 dark:border-gray-800">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full pb-safe">
          {children}
        </div>
      </div>
    </>
  );
}
