import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import type { Repository } from '@/lib/db/repository';
import {
  generateLoginCode,
  hashLoginCode,
  constantTimeEqual,
  normalizeEmail,
  checkCodeRequestLimits,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  MAX_CODES_PER_EMAIL_HOUR,
  MAX_CODES_PER_IP_HOUR,
} from '@/lib/auth/otp';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth/email-login';
import type { SendResult } from '@/lib/email/send';

const PEPPER = 'test-pepper';
const SUPERADMIN = 'boss@example.com';
const T0 = new Date('2026-11-05T10:00:00Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

describe('otp helpers', () => {
  it('generates 6-digit numeric codes', () => {
    for (let i = 0; i < 200; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });

  it('hashes deterministically and depends on the pepper', async () => {
    const hash = await hashLoginCode('123456', PEPPER);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashLoginCode('123456', PEPPER)).toBe(hash);
    expect(await hashLoginCode('123456', 'other-pepper')).not.toBe(hash);
  });

  it('compares codes in constant-time style', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('normalizes and validates emails', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it('enforces the cooldown and hourly limits', () => {
    const base = { now: T0, lastSentAt: null, emailCodesLastHour: 0, ipCodesLastHour: 0 };
    expect(checkCodeRequestLimits(base).ok).toBe(true);
    expect(checkCodeRequestLimits({ ...base, lastSentAt: at(-10).toISOString() })).toEqual({
      ok: false,
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS - 10,
    });
    expect(checkCodeRequestLimits({ ...base, emailCodesLastHour: MAX_CODES_PER_EMAIL_HOUR }).ok).toBe(false);
    expect(checkCodeRequestLimits({ ...base, ipCodesLastHour: MAX_CODES_PER_IP_HOUR }).ok).toBe(false);
  });
});

describe('email login flow', () => {
  let repo: Repository;
  let sent: string[];

  const sendCode = async (_email: string, code: string): Promise<SendResult> => {
    sent.push(code);
    return { ok: true };
  };
  const requestAt = (email: string, seconds: number, ip = '203.0.113.1') =>
    requestLoginCode({ repo, pepper: PEPPER, now: at(seconds), sendCode }, { email, ip });
  const verifyAt = (email: string, code: string, seconds: number) =>
    verifyLoginCode({ repo, pepper: PEPPER, now: at(seconds), superadminEmail: SUPERADMIN }, { email, code });
  const wrongCode = (correct: string) => (correct === '000000' ? '111111' : '000000');

  beforeEach(() => {
    repo = new MockRepository();
    sent = [];
  });

  it('gives the same response for unknown and existing emails', async () => {
    expect(await requestAt('new-person@example.com', 0)).toEqual({ kind: 'sent' });
    expect(await requestAt('amrutheshkn3@gmail.com', 0)).toEqual({ kind: 'sent' });
  });

  it('blocks resends during the cooldown', async () => {
    await requestAt('a@example.com', 0);
    expect((await requestAt('a@example.com', 30)).kind).toBe('rate_limited');
  });

  it('caps codes per email per hour', async () => {
    for (let i = 0; i < MAX_CODES_PER_EMAIL_HOUR; i++) {
      expect((await requestAt('a@example.com', i * 61)).kind).toBe('sent');
    }
    expect((await requestAt('a@example.com', MAX_CODES_PER_EMAIL_HOUR * 61)).kind).toBe('rate_limited');
  });

  it('caps codes per IP per hour', async () => {
    for (let i = 0; i < MAX_CODES_PER_IP_HOUR; i++) {
      expect((await requestAt(`user${i}@example.com`, i, '198.51.100.7')).kind).toBe('sent');
    }
    expect((await requestAt('last@example.com', 20, '198.51.100.7')).kind).toBe('rate_limited');
  });

  it('reports a provider failure', async () => {
    const failing = async (): Promise<SendResult> => ({ ok: false, error: 'email_failed' });
    const outcome = await requestLoginCode(
      { repo, pepper: PEPPER, now: at(0), sendCode: failing },
      { email: 'a@example.com', ip: '203.0.113.1' },
    );
    expect(outcome).toEqual({ kind: 'email_failed' });
  });

  it('accepts the emailed code and starts a session', async () => {
    await requestAt('buyer@example.com', 0);
    const result = await verifyAt('buyer@example.com', sent[0], 5);
    expect(result).toMatchObject({ kind: 'ok', user: { role: 'buyer', approval_status: 'approved' } });
    if (result.kind === 'ok') expect(result.setCookie).toContain('sid=');
  });

  it('rejects a wrong code without a hint', async () => {
    await requestAt('buyer@example.com', 0);
    expect(await verifyAt('buyer@example.com', wrongCode(sent[0]), 5)).toEqual({ kind: 'invalid' });
  });

  it('kills the code after 5 wrong attempts', async () => {
    await requestAt('c@example.com', 0);
    const correct = sent[0];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(await verifyAt('c@example.com', wrongCode(correct), 5 + i)).toEqual({ kind: 'invalid' });
    }
    expect(await verifyAt('c@example.com', correct, 20)).toEqual({ kind: 'invalid' });
  });

  it('expires codes after 10 minutes', async () => {
    await requestAt('d@example.com', 0);
    expect(await verifyAt('d@example.com', sent[0], 10 * 60 + 1)).toEqual({ kind: 'invalid' });
  });

  it('cannot reuse a consumed code', async () => {
    await requestAt('e@example.com', 0);
    expect((await verifyAt('e@example.com', sent[0], 5)).kind).toBe('ok');
    expect(await verifyAt('e@example.com', sent[0], 6)).toEqual({ kind: 'invalid' });
  });

  it('promotes the superadmin email only after a valid code', async () => {
    await requestAt(SUPERADMIN, 0);
    await verifyAt(SUPERADMIN, wrongCode(sent[0]), 5);
    expect(await repo.getUserByEmail(SUPERADMIN)).toBeNull();

    expect((await verifyAt(SUPERADMIN, sent[0], 6)).kind).toBe('ok');
    expect(await repo.getUserByEmail(SUPERADMIN)).toMatchObject({ role: 'superadmin', approval_status: 'approved' });
  });
});
