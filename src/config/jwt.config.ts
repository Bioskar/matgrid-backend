export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  expiresIn: (process.env.JWT_EXPIRE || '7d') as string,
};
