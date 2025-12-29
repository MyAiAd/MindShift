'use client';

import React from 'react';
import { ThemeConfig } from '@/lib/themes';
import { Check } from 'lucide-react';

interface ThemePreviewCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onSelect: () => void;
}

export function ThemePreviewCard({ theme, isSelected, onSelect }: ThemePreviewCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative group w-full text-left rounded-lg border-2 transition-all overflow-hidden ${
        isSelected
          ? 'border-primary shadow-lg ring-2 ring-primary ring-opacity-50'
          : 'border-border hover:border-primary/50 hover:shadow-md'
      }`}
      aria-label={`Select ${theme.name} theme`}
      aria-pressed={isSelected}
    >
      {/* Color Preview - Large visual preview area */}
      <div className="h-28 grid grid-cols-4 gap-0 relative overflow-hidden">
        {/* Main background color (75% width) */}
        <div
          className="col-span-3 relative"
          style={{ backgroundColor: theme.preview.background }}
        >
          {/* Foreground text color sample */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: theme.preview.foreground }}
          >
            <div className="text-xs font-semibold opacity-60">Aa</div>
          </div>
        </div>
        
        {/* Secondary/Card color (25% width) */}
        <div
          className="col-span-1"
          style={{ backgroundColor: theme.preview.secondary }}
        />
      </div>

      {/* Accent Bar - Shows primary color prominently */}
      <div
        className="h-2"
        style={{ backgroundColor: theme.preview.primary }}
      />

      {/* Theme Info */}
      <div className="p-4 bg-card">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1 flex items-center">
              {theme.name}
              {isSelected && (
                <Check className="ml-2 h-4 w-4 text-primary flex-shrink-0" />
              )}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {theme.description}
            </p>
            {theme.author && (
              <p className="text-xs text-muted-foreground italic">
                by {theme.author}
              </p>
            )}
          </div>
        </div>

        {/* Color Swatches - Shows all key colors */}
        <div className="flex space-x-2 mt-4 pt-3 border-t border-border">
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded border-2 border-border shadow-sm"
              style={{ backgroundColor: theme.preview.background }}
              title="Background"
            />
            <span className="text-xs text-muted-foreground mt-1">BG</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded border-2 border-border shadow-sm"
              style={{ backgroundColor: theme.preview.foreground }}
              title="Foreground"
            />
            <span className="text-xs text-muted-foreground mt-1">FG</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded border-2 border-border shadow-sm"
              style={{ backgroundColor: theme.preview.primary }}
              title="Primary"
            />
            <span className="text-xs text-muted-foreground mt-1">Pri</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded border-2 border-border shadow-sm"
              style={{ backgroundColor: theme.preview.secondary }}
              title="Secondary"
            />
            <span className="text-xs text-muted-foreground mt-1">Sec</span>
          </div>
        </div>
      </div>

      {/* Selected Badge - Top right corner */}
      {isSelected && (
        <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-semibold shadow-lg">
          Active
        </div>
      )}
    </button>
  );
}
