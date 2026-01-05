'use client';

import { useState, useEffect, useCallback } from 'react';

export type GlassPerformanceMode = 'full' | 'reduced' | 'minimal';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: 'chargingchange' | 'levelchange', listener: EventListener): void;
  removeEventListener(type: 'chargingchange' | 'levelchange', listener: EventListener): void;
}

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
}

/**
 * Hook to detect device performance conditions and suggest glass effect quality
 * 
 * Returns:
 * - 'full': Normal mode, all effects enabled
 * - 'reduced': Low battery (< 40%), reduce blur and glow
 * - 'minimal': Very low battery (< 20%) or data saver, disable blur entirely
 * 
 * Also applies the appropriate CSS class to document root
 */
export function useGlassPerformance(): {
  performanceMode: GlassPerformanceMode;
  batteryLevel: number | null;
  isCharging: boolean | null;
  isDataSaver: boolean;
} {
  const [performanceMode, setPerformanceMode] = useState<GlassPerformanceMode>('full');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);
  const [isDataSaver, setIsDataSaver] = useState(false);

  const updatePerformanceMode = useCallback((level: number | null, charging: boolean | null, dataSaver: boolean) => {
    // Data saver always takes priority
    if (dataSaver) {
      setPerformanceMode('minimal');
      return;
    }

    // If we can't detect battery, assume full performance
    if (level === null || charging === null) {
      setPerformanceMode('full');
      return;
    }

    // If charging, always use full
    if (charging) {
      setPerformanceMode('full');
      return;
    }

    // Battery level thresholds
    if (level < 0.2) {
      setPerformanceMode('minimal');
    } else if (level < 0.4) {
      setPerformanceMode('reduced');
    } else {
      setPerformanceMode('full');
    }
  }, []);

  // Check for data saver mode
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const nav = navigator as NavigatorWithBattery;
    if (nav.connection?.saveData) {
      setIsDataSaver(true);
    }
  }, []);

  // Monitor battery status
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const nav = navigator as NavigatorWithBattery;
    
    if (!nav.getBattery) {
      // Battery API not supported, use full mode
      return;
    }

    let battery: BatteryManager | null = null;

    const handleLevelChange = () => {
      if (battery) {
        setBatteryLevel(battery.level);
        updatePerformanceMode(battery.level, battery.charging, isDataSaver);
      }
    };

    const handleChargingChange = () => {
      if (battery) {
        setIsCharging(battery.charging);
        updatePerformanceMode(battery.level, battery.charging, isDataSaver);
      }
    };

    nav.getBattery().then((b) => {
      battery = b;
      
      // Set initial values
      setBatteryLevel(b.level);
      setIsCharging(b.charging);
      updatePerformanceMode(b.level, b.charging, isDataSaver);

      // Listen for changes
      b.addEventListener('levelchange', handleLevelChange);
      b.addEventListener('chargingchange', handleChargingChange);
    }).catch(() => {
      // Battery API failed, use full mode
    });

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', handleLevelChange);
        battery.removeEventListener('chargingchange', handleChargingChange);
      }
    };
  }, [isDataSaver, updatePerformanceMode]);

  // Apply CSS class to document root
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    
    // Remove all performance classes
    root.classList.remove('glass-performance-reduced', 'glass-performance-minimal');
    
    // Add appropriate class
    if (performanceMode === 'reduced') {
      root.classList.add('glass-performance-reduced');
    } else if (performanceMode === 'minimal') {
      root.classList.add('glass-performance-minimal');
    }
  }, [performanceMode]);

  return {
    performanceMode,
    batteryLevel,
    isCharging,
    isDataSaver,
  };
}

/**
 * Simplified hook that just returns the performance mode
 */
export function useGlassPerformanceMode(): GlassPerformanceMode {
  const { performanceMode } = useGlassPerformance();
  return performanceMode;
}

