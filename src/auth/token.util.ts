import { JWTPayload, SignJWT } from 'jose';

export type AppJwtPayload = JWTPayload & {
  sub: string;
  email: string;
  name?: string;
};

export async function signAccessToken(payload: AppJwtPayload): Promise<string> {
  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error('Missing AUTH_JWT_SECRET');
  }

  const issuer = process.env.AUTH_JWT_ISSUER || undefined;
  const audience = process.env.AUTH_JWT_AUDIENCE || undefined;
  const expiresIn = process.env.AUTH_JWT_EXPIRES_IN || '7d';

  let tokenBuilder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(expiresIn);

  if (issuer) {
    tokenBuilder = tokenBuilder.setIssuer(issuer);
  }

  if (audience) {
    tokenBuilder = tokenBuilder.setAudience(audience);
  }

  return tokenBuilder.sign(new TextEncoder().encode(secret));
}
