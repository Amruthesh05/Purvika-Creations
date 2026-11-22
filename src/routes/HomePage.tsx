import { useRef, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ArrowRight, Truck, RotateCcw, Banknote } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Logo } from '@/components/Logo';
import { ProductCard } from '@/components/ProductCard';
import { TiltCard } from '@/components/TiltCard';
import { Button } from '@/components/Button';
import { CustomPrintNotice } from '@/components/CustomPrintNotice';
import { ErrorState, EmptyState } from '@/components/States';
import { useScrollProgress } from '@/lib/useScrollProgress';
import { HERO_HEADLINE, HERO_SUBLINE, HISTORY, EXCELLENCE, RETURN_WINDOW_DAYS } from '@/lib/brand';
import { DELIVERY_MODES } from '@/lib/delivery/config';
import { COD_FEE_PAISE } from '@/lib/payments/config';
import { formatINR } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import type { Product, User } from '@/lib/types';

interface HomePageProps {
  user?: User | null;
}

export function HomePage({ user = null }: HomePageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const excellenceRef = useRef<HTMLDivElement>(null);
  const promiseRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);

  useScrollProgress(heroRef);
  useScrollProgress(historyRef);
  useScrollProgress(excellenceRef);
  useScrollProgress(promiseRef);

  useEffect(() => {
    apiFetch('/api/catalog')
      .then((d) => setProducts(d as Product[]))
      .catch(() => setError(true));
  }, []);

  // Global scroll progress bar
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    let raf: number | null = null;
    const update = () => {
      raf = null;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (progressRef.current) {
        progressRef.current.style.setProperty('--scroll-p', String(Math.max(0, Math.min(1, p))));
      }
    };
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const newestProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  }, [products]);

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-page">
      <div ref={progressRef} className="scroll-progress" aria-hidden />
      <Header user={user} />
      <CustomPrintNotice />

      {/* Hero */}
      <section ref={heroRef} className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
        {/* Parallax background layers */}
        <div className="parallax-layer absolute inset-0 flex items-center justify-center" style={{ ['--speed' as string]: '-0.15' }}>
          <Logo variant="mark" height={400} tone="light" className="opacity-10" />
        </div>
        <div className="parallax-layer absolute inset-0 flex items-center justify-center" style={{ ['--speed' as string]: '-0.08' }}>
          <span className="hero-word">STYVIO</span>
        </div>
        <div className="parallax-layer absolute -top-20 -left-20 h-72 w-72 rounded-full bg-flame-500/10 blur-3xl" style={{ ['--speed' as string]: '-0.25' }} />
        <div className="parallax-layer absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-flame-600/8 blur-3xl" style={{ ['--speed' as string]: '-0.12' }} />

        {/* Hero content */}
        <div className="hero-parallax relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text sm:text-5xl lg:text-6xl">{HERO_HEADLINE}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted sm:text-lg">{HERO_SUBLINE}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={scrollToCatalog}>Scroll to catalog</Button>
            <Link to="/products">
              <Button variant="secondary">Shop all products</Button>
            </Link>
          </div>
          <button onClick={scrollToCatalog} className="mt-12 text-text-muted hover:text-flame-400 transition-colors" aria-label="Scroll down">
            <ChevronDown className="chevron-bounce h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Our History — Timeline */}
      <section ref={historyRef} className="relative py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="reveal mb-12 text-center text-3xl font-bold text-text">Our History</h2>
          <div className="relative">
            <div className="timeline-line" />
            <div className="timeline-fill" style={{ height: 'calc(var(--p, 0) * 100%)' }} />
            <div className="space-y-12">
              {HISTORY.map((item, i) => (
                <TimelineItem key={i} index={i} title={item.title} text={item.text} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Excellence — Tilt cards */}
      <section ref={excellenceRef} className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-text">Excellence</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {EXCELLENCE.map((item, i) => (
              <div key={i}>
                <TiltCard className="surface-card h-full p-6">
                  <h3 className="mb-2 text-lg font-semibold text-text">{item.title}</h3>
                  <p className="text-sm text-text-muted">{item.text}</p>
                </TiltCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Promise — Policy cards */}
      <section ref={promiseRef} className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="reveal mb-12 text-center text-3xl font-bold text-text">Our Promise</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <PromiseCard
              icon={<RotateCcw className="h-6 w-6 text-flame-400" />}
              title="Replacements"
              text={`Replacement for manufacturing defects within ${RETURN_WINDOW_DAYS} days of delivery.`}
            />
            <PromiseCard
              icon={<Truck className="h-6 w-6 text-flame-400" />}
              title="Flexible delivery"
              text={`Courier from ${formatINR(DELIVERY_MODES.courier.feePaise)}, or delivery by the founders from ${formatINR(DELIVERY_MODES.founders.feePaise)}.`}
            />
            <PromiseCard
              icon={<Banknote className="h-6 w-6 text-flame-400" />}
              title="Cash on delivery"
              text={`Pay with cash on delivery — just a ${formatINR(COD_FEE_PAISE)} handling charge.`}
            />
          </div>
        </div>
      </section>

      {/* Catalog preview */}
      <section id="catalog" ref={catalogRef} className="py-20" style={{ scrollMarginTop: '80px' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold text-text">Latest Products</h2>
            <Link to="/products" className="inline-flex items-center gap-1 text-sm font-medium text-flame-400 hover:text-flame-300 transition-colors">
              View all products
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {error ? (
            <ErrorState message="Failed to load products. Please try again." />
          ) : products === null ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <svg className="h-8 w-8 animate-spin text-flame-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : newestProducts.length === 0 ? (
            <EmptyState message="No products are available right now. Please check back soon." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {newestProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function TimelineItem({ index, title, text }: { index: number; title: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(true);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isLeft = index % 2 === 0;

  return (
    <div ref={ref} className={`timeline-item ${active ? 'is-active' : ''} relative flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
      <div className={`w-1/2 ${isLeft ? 'pr-12 text-right' : 'pl-12'}`}>
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        <p className="mt-1 text-sm text-text-muted">{text}</p>
      </div>
      <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-flame-500 bg-ink-page" />
    </div>
  );
}

function PromiseCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="surface-card p-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-flame-500/10">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-text">{title}</h3>
      <p className="text-sm text-text-muted">{text}</p>
    </div>
  );
}
