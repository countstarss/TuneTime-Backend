import type { JWTPayload } from 'jose';

type VerifyOptions = {
  issuer?: string;
  audience?: string;
};

type JoseModule = typeof import('jose');
let joseModulePromise: Promise<JoseModule> | null = null;
let cachedJwks: unknown = undefined;

async function loadJose() {
  if (!joseModulePromise) {
    joseModulePromise = import('jose');
  }

  return joseModulePromise;
}

function getSecretKey() {
  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Missing AUTH_JWT_SECRET');
  }
  return new TextEncoder().encode(jwtSecret);
}

async function getJwksKeyset(jwksUrl: string) {
  if (!cachedJwks) {
    const { createRemoteJWKSet } = await loadJose();
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return cachedJwks;
}

async function getVerifierFromEnv() {
  const jwksUrl = process.env.AUTH_JWKS_URL;

  if (jwksUrl) {
    return { type: 'jwks' as const, key: await getJwksKeyset(jwksUrl) };
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
    const { jwtVerify } = await loadJose();
    const verifier = await getVerifierFromEnv();
    const verifyOptions = getVerifyOptions();
    const { payload } = await jwtVerify(
      token,
      verifier.key as Parameters<typeof jwtVerify>[1],
      verifyOptions,
    );
    return payload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
