export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

export type SendResult = { ok: true } | { ok: false; error: 'email_not_configured' | 'email_failed' };

const RESEND_URL = 'https://api.resend.com/emails';

export async function sendLoginCodeEmail(env: EmailEnv, to: string, code: string): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return { ok: false, error: 'email_not_configured' };

  const text = `Your Styvio login code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this email.`;
  const html = `<p>Your Styvio login code is <strong>${code}</strong>. It expires in 10 minutes.</p><p>If you did not ask for it, ignore this email.</p>`;

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject: 'Your Styvio login code', text, html }),
    });
    if (!res.ok) {
      console.error(`login email rejected: ${res.status}`);
      return { ok: false, error: 'email_failed' };
    }
    return { ok: true };
  } catch {
    console.error('login email request failed');
    return { ok: false, error: 'email_failed' };
  }
}
