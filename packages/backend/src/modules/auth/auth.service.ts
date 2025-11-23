import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/errors';
import type { AuthContext } from '../../types';

interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  tenantName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult extends Tokens {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    tenantId: string;
    createdAt: Date;
  };
  tenant: {
    id: string;
    name: string;
  };
}

function parseDuration(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? 'ms';

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

function buildAuthPayload(userId: string, tenantId: string, email: string): AuthContext {
  return { userId, tenantId, email };
}

function signAccessToken(payload: AuthContext): string {
  return jwt.sign(payload as jwt.JwtPayload, env.JWT_SECRET as jwt.Secret, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as jwt.SignOptions);
}

async function signAndStoreRefreshToken(payload: AuthContext): Promise<string> {
  const token = jwt.sign(payload as jwt.JwtPayload, env.JWT_REFRESH_SECRET as jwt.Secret, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as jwt.SignOptions);
  const hashed = await bcrypt.hash(token, 10);
  const ttlMs = parseDuration(env.JWT_REFRESH_TTL) || 1000 * 60 * 60 * 24 * 30;
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.refreshToken.create({
    data: {
      token: hashed,
      userId: payload.userId,
      tenantId: payload.tenantId,
      expiresAt,
    },
  });

  return token;
}

async function issueTokens(payload: AuthContext): Promise<Tokens> {
  const accessToken = signAccessToken(payload);
  const refreshToken = await signAndStoreRefreshToken(payload);
  return { accessToken, refreshToken };
}

function safeUser(user: { id: string; email: string; name: string | null; role: string; tenantId: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(409, 'User already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const tenant = await prisma.tenant.create({
    data: {
      name: input.tenantName ?? input.name ?? input.email.split('@')[0] ?? 'New Tenant',
      users: {
        create: {
          email: input.email,
          passwordHash,
          name: input.name,
          role: 'owner',
        },
      },
    },
    include: { users: true },
  });

  const user = tenant.users[0];
  const payload = buildAuthPayload(user.id, tenant.id, user.email);
  const tokens = await issueTokens(payload);

  return {
    ...tokens,
    user: safeUser(user),
    tenant: { id: tenant.id, name: tenant.name },
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { tenant: true },
  });

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const payload = buildAuthPayload(user.id, user.tenantId, user.email);
  const tokens = await issueTokens(payload);

  return {
    ...tokens,
    user: safeUser(user),
    tenant: { id: user.tenant.id, name: user.tenant.name },
  };
}

export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  let payload: AuthContext & jwt.JwtPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as AuthContext & jwt.JwtPayload;
  } catch (_err) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const tokens = await prisma.refreshToken.findMany({
    where: { userId: payload.userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  let matchedToken: { id: string; expiresAt: Date } | null = null;
  // Intentionally sync loop to keep bcrypt comparisons sequential.
  for (const token of tokens) {
    const ok = await bcrypt.compare(refreshToken, token.token);
    if (ok) {
      matchedToken = { id: token.id, expiresAt: token.expiresAt };
      break;
    }
  }

  if (!matchedToken || matchedToken.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token expired');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { tenant: true },
  });

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  await prisma.refreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: new Date() },
  });

  const authPayload = buildAuthPayload(user.id, user.tenantId, user.email);
  const newTokens = await issueTokens(authPayload);

  return {
    ...newTokens,
    user: safeUser(user),
    tenant: { id: user.tenant.id, name: user.tenant.name },
  };
}

export async function getProfile(userId: string): Promise<AuthResult['user']> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return safeUser(user);
}
