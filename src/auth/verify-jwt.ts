import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

type VerifyOptions = {
  issuer?: string;
  audience?: string;
};

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined = undefined;

function getSecretKey() {
  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Missing AUTH_JWT_SECRET');
  }
  return new TextEncoder().encode(jwtSecret);
}

function getJwksKeyset(jwksUrl: string) {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return cachedJwks;
}

function getVerifierFromEnv() {
  const jwksUrl = process.env.AUTH_JWKS_URL;

  if (jwksUrl) {
    return { type: 'jwks' as const, key: getJwksKeyset(jwksUrl) };
  }

  return { type: 'secret' as const, key: getSecretKey() };
}

function getVerifyOptions(): VerifyOptions {
  const issuer = process.env.AUTH_JWT_ISSUER;
  const audience = process.env.AUTH_JWT_AUDIENCE;
  return {
    issuer: issuer || undefined,
    audience: audience || undefined,
  };
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const verifier = getVerifierFromEnv();
    const verifyOptions = getVerifyOptions();
    const { payload } =
      verifier.type === 'jwks'
        ? await jwtVerify(token, verifier.key, verifyOptions)
        : await jwtVerify(token, verifier.key, verifyOptions);
    return payload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
