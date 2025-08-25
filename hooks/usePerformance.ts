import { useEffect } from 'react';

export function usePerformance() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return;

    // Log Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${entry.name}: ${entry.startTime.toFixed(2)}ms`);
        }
        
        // You could send this to analytics here
        // sendToAnalytics(entry);
      }
    });

    // Observe various performance metrics
    try {
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint', 'largest-contentful-paint'] });
    } catch (e) {
      // Some entry types might not be supported
    }

    // Log initial page load time
    window.addEventListener('load', () => {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] Page load time: ${loadTime}ms`);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);
}

export default usePerformance;