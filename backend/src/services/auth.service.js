import bcrypt from 'bcrypt';
import { hashPassword, comparePassword } from '../utils/hash.util';
import { signAccessToken, generateRefreshToken, hashToken } from '../utils/jwt.util';
import { User, RefreshToken } from '../prisma/client';
import { AppError } from '../utils/response.util';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

async function register(email: string, password: string): Promise<User> {
  const hashedPassword = await hashPassword(password);
  return await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'USER',
    },
  });
}

async function login(email: string, password: string): Promise<{ accessToken: string, refreshToken: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const { token, tokenHash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token,
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  return {
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken: token,
  };
}

async function refresh(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
  const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!storedToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
  }

  const isTokenValid = await comparePassword(refreshToken, storedToken.tokenHash);
  if (!isTokenValid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid refresh token');
  }

  const { token, tokenHash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      token,
      tokenHash,
      expiresAt,
    },
  });

  return {
    accessToken: signAccessToken({ id: storedToken.userId, role: 'USER' }),
    refreshToken: token,
  };
}

async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.delete({ where: { token: refreshToken } });
}

async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const isPasswordValid = await comparePassword(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid old password');
  }

  const hashedNewPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedNewPassword,
    },
  });
}

function toPublicUser(user: User): { id: number, email: string, role: string } {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export { register, login, refresh, logout, changePassword, toPublicUser };
