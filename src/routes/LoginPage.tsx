import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { EmailLoginForm } from '@/components/EmailLoginForm';
import { useMedianAuth } from '@/lib/auth';
import { useToasts, ToastContainer } from '@/components/Toast';
import { sanitizeReturnPath } from '@/lib/payments/config';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: { theme: string; size: string; width: number; text: string },
          ): void;
          cancel(): void;
        };
      };
    };
  }
}

const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleGsi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google GSI')));
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google GSI'));
    document.head.appendChild(script);
  });
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = sanitizeReturnPath(searchParams.get('return'));
  const { isMedian, signInWithGoogle } = useMedianAuth();
  const { toasts, addToast, dismissToast } = useToasts();
  const [loading, setLoading] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        if (res.ok) {
          addToast('Signed in successfully');
          navigate(returnPath);
        } else {
          addToast('Sign-in failed. Please try again.', 'error');
        }
      } catch {
        addToast('An error occurred during sign-in', 'error');
      } finally {
        setLoading(false);
      }
    },
    [navigate, addToast],
  );

  useEffect(() => {
    if (isMedian || !clientId) return;
    let cancelled = false;
    loadGoogleGsi()
      .then(() => {
        if (cancelled || !buttonContainerRef.current) return;
        window.google!.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            handleCredential(response.credential);
          },
        });
        window.google!.accounts.id.renderButton(buttonContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => {
        if (!cancelled) addToast('Failed to load Google sign-in.', 'error');
      });
    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // noop
      }
    };
  }, [clientId, isMedian, handleCredential, addToast]);

  const handleEmailSignedIn = () => {
    addToast('Signed in successfully');
    navigate(returnPath);
  };

  const handleMedianGoogleSignIn = async () => {
    if (!isMedian) return;
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.idToken) {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: result.idToken }),
        });
        if (res.ok) {
          addToast('Signed in successfully');
          navigate(returnPath);
          return;
        }
      }
      addToast('Sign-in failed. Please try again.', 'error');
    } catch {
      addToast('An error occurred during sign-in', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-page p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <Logo height={36} tone="light" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-text">Welcome to Styvio</h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to track orders, save addresses, and check out faster.</p>
        </div>

        <div className="rounded-2xl border border-ink-border bg-ink-raised p-6 shadow-xl">
          <EmailLoginForm onSignedIn={handleEmailSignedIn} />

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-text-muted">
            <span className="h-px flex-1 bg-ink-border" />
            or
            <span className="h-px flex-1 bg-ink-border" />
          </div>

          {isMedian ? (
            <button
              onClick={handleMedianGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-border bg-ink-surface px-4 py-3 text-sm font-medium text-text transition-colors hover:border-flame-500 disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          ) : clientId ? (
            <div className="flex flex-col items-center gap-3">
              <div ref={buttonContainerRef} className="min-h-[40px]" />
              {loading && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <svg className="h-4 w-4 animate-spin text-flame-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 px-3 py-3 text-center text-sm text-amber-300">
              Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID to your environment.
            </div>
          )}

          {isMedian && (
            <p className="mt-4 rounded-lg bg-ink-surface px-3 py-2 text-xs text-text-muted">
              Median.co native sign-in bridge detected
            </p>
          )}
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-4 block w-full text-center text-sm text-text-muted hover:text-flame-300 transition-colors"
        >
          Browse products without signing in
        </button>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
