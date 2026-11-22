import { useEffect, useState, type FormEvent } from 'react';
import { RESEND_COOLDOWN_SECONDS } from '@/lib/auth/otp';
import { TurnstileWidget } from '@/components/TurnstileWidget';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const CODE_LENGTH = 6;

type Step = 'email' | 'code';

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Please enter a valid email address.',
  401: 'That code is invalid or has expired. Request a new code and try again.',
  403: 'The security check failed. Please try again.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  502: "We couldn't send the email. Please try again in a moment.",
  503: 'Email sign-in is not configured yet.',
};
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = 'Network error. Check your connection and try again.';

const inputClass =
  'w-full rounded-lg border border-ink-border bg-ink-surface px-4 py-3 text-sm text-text placeholder:text-text-muted transition-colors focus:border-flame-500 focus:outline-none disabled:opacity-60';

function postJson(path: string, payload: object): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function EmailLoginForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const turnstileMissing = !!TURNSTILE_SITE_KEY && !turnstileToken;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson('/api/auth/email/request', {
        email: target,
        turnstileToken: turnstileToken ?? undefined,
      });
      if (!res.ok) {
        setError(ERROR_MESSAGES[res.status] ?? FALLBACK_MESSAGE);
        return;
      }
      setEmail(target);
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
      setTurnstileToken(null);
      setWidgetKey((k) => k + 1);
    }
  };

  const verifyCode = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson('/api/auth/email/verify', { email, code: value });
      if (res.ok) {
        onSignedIn();
        return;
      }
      setError(ERROR_MESSAGES[res.status] ?? FALLBACK_MESSAGE);
      setCode('');
    } catch {
      setError(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void sendCode(email.trim().toLowerCase());
  };

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && !busy) void verifyCode(digits);
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setCooldown(0);
  };

  return (
    <div className="space-y-4">
      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-text">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>
          {TURNSTILE_SITE_KEY && (
            <TurnstileWidget key={widgetKey} siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} />
          )}
          <button type="submit" disabled={busy || turnstileMissing} className="btn-primary w-full">
            {busy ? 'Sending...' : 'Send code'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Enter the 6-digit code we sent to <span className="font-medium text-text">{email}</span>.
          </p>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={CODE_LENGTH}
            autoFocus
            value={code}
            disabled={busy}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="000000"
            aria-label="6-digit login code"
            className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
          />
          {TURNSTILE_SITE_KEY && (
            <TurnstileWidget key={widgetKey} siteKey={TURNSTILE_SITE_KEY} onToken={setTurnstileToken} />
          )}
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => void sendCode(email)}
              disabled={busy || cooldown > 0 || turnstileMissing}
              className="font-medium text-flame-300 transition-colors hover:text-flame-200 disabled:cursor-not-allowed disabled:text-text-muted"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" onClick={changeEmail} className="text-text-muted transition-colors hover:text-text">
              Use a different email
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
