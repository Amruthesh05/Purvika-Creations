import { describe, it, expect, beforeEach } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { verifyGoogleToken } from '@/lib/auth/google-token';

describe('verifyGoogleToken', () => {
  let keyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeEach(async () => {
    keyPair = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(keyPair.publicKey);
    jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-kid', use: 'sig', alg: 'RS256' }] });
  });

  it('returns verified claims for a valid token', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience('my-client-id')
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).not.toBeNull();
    expect(result!.email).toBe('user@example.com');
    expect(result!.email_verified).toBe(true);
  });

  it('returns null for wrong audience', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience('wrong-audience')
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).toBeNull();
  });

  it('returns null for wrong issuer', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('https://evil.com')
      .setAudience('my-client-id')
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).toBeNull();
  });

  it('returns null for expired token', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience('my-client-id')
      .setExpirationTime('0s')
      .sign(keyPair.privateKey);

    await new Promise((r) => setTimeout(r, 100));
    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).toBeNull();
  });

  it('returns null when email_verified is false', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: false })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('https://accounts.google.com')
      .setAudience('my-client-id')
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).toBeNull();
  });

  it('returns null for a garbage token', async () => {
    const result = await verifyGoogleToken('not.a.valid.token', 'my-client-id', jwks);
    expect(result).toBeNull();
  });

  it('accepts accounts.google.com issuer (no https)', async () => {
    const token = await new SignJWT({ email: 'user@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setIssuer('accounts.google.com')
      .setAudience('my-client-id')
      .setExpirationTime('1h')
      .sign(keyPair.privateKey);

    const result = await verifyGoogleToken(token, 'my-client-id', jwks);
    expect(result).not.toBeNull();
    expect(result!.email).toBe('user@example.com');
  });
});
