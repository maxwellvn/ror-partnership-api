import jwt from 'jsonwebtoken';
import { config } from '../config';
import { IUser } from '../models';

export const generateTokens = (user: IUser) => {
  const accessToken = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiry }
  );

  const refreshToken = jwt.sign(
    {
      sub: user._id.toString(),
      jti: crypto.randomUUID(),
    },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
  };
};

export const verifyRefreshToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      jti: string;
    };
    return decoded;
  } catch {
    return null;
  }
};
