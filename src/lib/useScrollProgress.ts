import { useEffect, useRef, type RefObject } from 'react';

/**
 * Sets CSS variables --p (0..1 progress) and --sy (scrollY in px) on the
 * element, using a single requestAnimationFrame-throttled passive scroll
 * listener. Only runs while the element is near the viewport (IntersectionObserver).
 */
export function useScrollProgress<T extends HTMLElement>(ref: RefObject<T>): void {
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const io = new IntersectionObserver(
      (entries) => {
        visibleRef.current = entries.some((e) => e.isIntersecting);
      },
      { rootMargin: '200px 0px 200px 0px' },
    );
    io.observe(el);

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Progress: 0 when element top is at bottom of viewport,
      // 1 when element bottom is at top of viewport.
      const total = rect.height + vh;
      const passed = vh - rect.top;
      const p = Math.max(0, Math.min(1, passed / total));
      el.style.setProperty('--p', String(p));
      el.style.setProperty('--sy', String(window.scrollY));
    };

    const onScroll = () => {
      if (!visibleRef.current) return;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    compute();

    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ref]);
}

/**
 * Reveal-on-scroll hook: adds a class when the element enters the viewport.
 * Uses IntersectionObserver with staggered delays via CSS variable --delay.
 */
export function useRevealOnScroll<T extends HTMLElement>(ref: RefObject<T>, threshold = 0.15): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      el.classList.add('reveal-visible');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold },
    );
    io.observe(el);

    return () => io.disconnect();
  }, [ref, threshold]);
}
