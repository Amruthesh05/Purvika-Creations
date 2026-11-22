import { createRemoteJWKSet, jwtVerify, type JWTVerifyOptions, type KeyInput, type JWTVerifyGetKey } from 'jose';

const GOOGLE_JWKS_URI = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface VerifiedToken {
  email: string;
  email_verified: boolean;
}

export async function verifyGoogleToken(
  token: string,
  expectedAudience: string,
  jwks?: KeyInput | JWTVerifyGetKey<CryptoKey>,
): Promise<VerifiedToken | null> {
  try {
    const keySet: KeyInput | JWTVerifyGetKey<CryptoKey> = jwks ?? createRemoteJWKSet(GOOGLE_JWKS_URI);
    const verifyOptions: JWTVerifyOptions = {
      issuer: GOOGLE_ISSUERS,
      audience: expectedAudience,
    };
    const { payload } = await jwtVerify(token, keySet, verifyOptions);

    const email = payload.email as string | undefined;
    const email_verified = payload.email_verified as boolean | undefined;

    if (!email || email_verified !== true) {
      return null;
    }

    return { email, email_verified: true };
  } catch {
    return null;
  }
}
