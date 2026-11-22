import type { Repository } from '../db/repository';
import type { User } from '../types';
import type { SendResult } from '../email/send';
import { generateId } from '../utils';
import { findOrCreateUser } from './session';
import { generateSessionId, hashSessionId, getSessionExpiry, buildSessionCookieHeader } from './cookie';
import {
  generateLoginCode,
  hashLoginCode,
  hashClientIp,
  constantTimeEqual,
  isValidCodeFormat,
  checkCodeRequestLimits,
  codeExpiresAt,
  MAX_ATTEMPTS,
} from './otp';

const HOUR_MS = 60 * 60 * 1000;

export type RequestOutcome =
  | { kind: 'sent' }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'email_not_configured' }
  | { kind: 'email_failed' };

export type VerifyOutcome = { kind: 'ok'; user: User; setCookie: string } | { kind: 'invalid' };

export async function requestLoginCode(
  deps: { repo: Repository; pepper: string; now?: Date; sendCode: (email: string, code: string) => Promise<SendResult> },
  input: { email: string; ip: string },
): Promise<RequestOutcome> {
  const { repo, pepper } = deps;
  const now = deps.now ?? new Date();
  const sinceHour = new Date(now.getTime() - HOUR_MS).toISOString();
  const ipHash = await hashClientIp(input.ip, pepper);

  const limit = checkCodeRequestLimits({
    now,
    lastSentAt: await repo.getLastCodeTime(input.email),
    emailCodesLastHour: await repo.countCodesSince('email', input.email, sinceHour),
    ipCodesLastHour: await repo.countCodesSince('ip_hash', ipHash, sinceHour),
  });
  if (!limit.ok) return { kind: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds };

  const code = generateLoginCode();
  await repo.createLoginCode({
    id: generateId(),
    email: input.email,
    code_hash: await hashLoginCode(code, pepper),
    expires_at: codeExpiresAt(now),
    attempts: 0,
    consumed_at: null,
    ip_hash: ipHash,
    created_at: now.toISOString(),
  });

  const sent = await deps.sendCode(input.email, code);
  if (!sent.ok) return { kind: sent.error };
  return { kind: 'sent' };
}

export async function verifyLoginCode(
  deps: { repo: Repository; pepper: string; now?: Date; superadminEmail: string },
  input: { email: string; code: string },
): Promise<VerifyOutcome> {
  const { repo, pepper } = deps;
  const now = deps.now ?? new Date();
  if (!isValidCodeFormat(input.code)) return { kind: 'invalid' };

  const latest = await repo.getLatestOpenCode(input.email, now.toISOString());
  if (!latest || latest.attempts >= MAX_ATTEMPTS) return { kind: 'invalid' };

  const submittedHash = await hashLoginCode(input.code, pepper);
  if (!constantTimeEqual(submittedHash, latest.code_hash)) {
    await repo.incrementCodeAttempts(latest.id);
    return { kind: 'invalid' };
  }

  const consumed = await repo.consumeCode(latest.id, now.toISOString());
  if (!consumed) return { kind: 'invalid' };

  const user = await findOrCreateUser(repo, input.email, deps.superadminEmail);
  const rawSessionId = generateSessionId();
  const expiresAt = getSessionExpiry();
  await repo.createSession(await hashSessionId(rawSessionId), user.id, expiresAt);
  return { kind: 'ok', user, setCookie: buildSessionCookieHeader(rawSessionId, new Date(expiresAt)) };
}
