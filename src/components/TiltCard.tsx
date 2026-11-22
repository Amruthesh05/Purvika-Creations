import { useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { classNames } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
}

export function TiltCard({ children, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (py - 0.5) * -8;
    const ry = (px - 0.5) * 8;
    el.style.setProperty('--tilt-x', `${rx}deg`);
    el.style.setProperty('--tilt-y', `${ry}deg`);
    el.style.setProperty('--glow-x', `${px * 100}%`);
    el.style.setProperty('--glow-y', `${py * 100}%`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ transformStyle: 'preserve-3d' }}
      className={classNames(
        'tilt-card group relative rounded-2xl transition-transform duration-200 ease-out',
        '[@media(pointer:coarse)]:transform-none [@media(prefers-reduced-motion:reduce)]:transform-none',
        className,
      )}
    >
      <div
        aria-hidden
        className="tilt-glow pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      {children}
    </div>
  );
}
