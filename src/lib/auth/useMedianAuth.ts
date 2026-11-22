import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    median?: {
      signIn?: (provider: string) => Promise<{ idToken?: string; email?: string }>;
      isMedian?: () => boolean;
    };
  }
}

export function isMedianWebView(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.median?.isMedian?.()) return true;
  // Fallback: check user agent for Median.co
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('median') || ua.includes('median.co');
}

export function useMedianAuth() {
  const [isMedian, setIsMedian] = useState(false);

  useEffect(() => {
    setIsMedian(isMedianWebView());
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ idToken?: string; email?: string } | null> => {
    if (!isMedian || !window.median?.signIn) return null;
    return window.median.signIn('google');
  }, [isMedian]);

  const signInWithApple = useCallback(async (): Promise<{ idToken?: string; email?: string } | null> => {
    if (!isMedian || !window.median?.signIn) return null;
    return window.median.signIn('apple');
  }, [isMedian]);

  return {
    isMedian,
    signInWithGoogle,
    signInWithApple,
  };
}
