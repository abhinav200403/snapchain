import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { query } from '../config/db';
import { JwtPayload, AppRole } from '../types';
import { sendVerificationEmail } from '../services/mailer';

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  } as jwt.SignOptions);
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

async function hashRefreshToken(token: string): Promise<string> {
  return bcrypt.hash(token, 8);
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const { companyName, companyEmail, name, email, password } = req.body;

  if (!companyName || !companyEmail || !name || !email || !password) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const companyRes = await client.query(
      `INSERT INTO companies (name, email) VALUES ($1, $2) RETURNING id`,
      [companyName, companyEmail.toLowerCase()]
    );
    const companyId = companyRes.rows[0].id;

    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
    const userRes = await client.query(
      `INSERT INTO users (company_id, email, name, password_hash, role, email_verified)
       VALUES ($1, $2, $3, $4, 'admin', false) RETURNING id, email, name, role`,
      [companyId, email.toLowerCase(), name, passwordHash]
    );
    const user = userRes.rows[0];

    await client.query('COMMIT');

    const accessToken = generateAccessToken({ userId: user.id, companyId, role: user.role as AppRole, email: user.email });
    const refreshToken = generateRefreshToken();
    const refreshHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshHash, expiresAt]
    );

    // Send verification email (non-blocking)
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyHash = await bcrypt.hash(verifyToken, 8);
    await query(
      `INSERT INTO verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [user.id, verifyHash]
    );
    sendVerificationEmail({ to: email.toLowerCase(), name, token: verifyToken }).catch(err => {
      console.error('Verification email failed:', err.message);
    });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId, emailVerified: false },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/auth/verify-email?token=xxx
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.query as { token: string };
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  const tokens = await query(
    `SELECT vt.id, vt.user_id, vt.token_hash FROM verification_tokens vt
     WHERE vt.expires_at > NOW()`,
    []
  );

  let matched: (typeof tokens.rows)[0] | null = null;
  for (const row of tokens.rows) {
    const isMatch = await bcrypt.compare(token, row.token_hash);
    if (isMatch) { matched = row; break; }
  }

  if (!matched) {
    res.status(400).json({ error: 'Invalid or expired verification link' });
    return;
  }

  await query(`UPDATE users SET email_verified = true WHERE id = $1`, [matched.user_id]);
  await query(`DELETE FROM verification_tokens WHERE id = $1`, [matched.id]);

  res.json({ message: 'Email verified successfully' });
}

// POST /api/auth/resend-verification
export async function resendVerification(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const userRes = await query(
    `SELECT id, email, name, email_verified FROM users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0 || userRes.rows[0].email_verified) {
    res.json({ message: 'Already verified' });
    return;
  }

  const user = userRes.rows[0];
  await query(`DELETE FROM verification_tokens WHERE user_id = $1`, [userId]);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const verifyHash = await bcrypt.hash(verifyToken, 8);
  await query(
    `INSERT INTO verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
    [userId, verifyHash]
  );

  sendVerificationEmail({ to: user.email, name: user.name, token: verifyToken }).catch(err => {
    console.error('Resend verification failed:', err.message);
  });

  res.json({ message: 'Verification email sent' });
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = await query(
    `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.is_active, u.company_id
     FROM users u WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    companyId: user.company_id,
    role: user.role as AppRole,
    email: user.email,
  });

  const refreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, refreshHash, expiresAt]
  );

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.company_id },
  });
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  const tokens = await query(
    `SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at,
            u.email, u.role, u.company_id, u.is_active, u.name
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.expires_at > NOW()`,
    []
  );

  let matched: (typeof tokens.rows)[0] | null = null;
  for (const row of tokens.rows) {
    const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
    if (isMatch) { matched = row; break; }
  }

  if (!matched || !matched.is_active) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // Rotate: delete old, issue new
  await query('DELETE FROM refresh_tokens WHERE id = $1', [matched.id]);

  const newAccessToken = generateAccessToken({
    userId: matched.user_id,
    companyId: matched.company_id,
    role: matched.role as AppRole,
    email: matched.email,
  });
  const newRefreshToken = generateRefreshToken();
  const newRefreshHash = await hashRefreshToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [matched.user_id, newRefreshHash, expiresAt]
  );

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  if (refreshToken && req.user) {
    // Best-effort delete matching token
    const tokens = await query(
      `SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND expires_at > NOW()`,
      [req.user.userId]
    );
    for (const row of tokens.rows) {
      const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
      if (isMatch) {
        await query('DELETE FROM refresh_tokens WHERE id = $1', [row.id]);
        break;
      }
    }
  }
  res.json({ message: 'Logged out' });
}

// PATCH /api/auth/password
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
  if (result.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }
  const newHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS) || 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.userId]);
  res.json({ message: 'Password updated successfully' });
}

// GET /api/auth/me
export async function me(req: Request, res: Response): Promise<void> {
  const result = await query(
    `SELECT u.id, u.email, u.name, u.role, u.is_active, u.company_id, u.email_verified, c.name AS company_name
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1`,
    [req.user!.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const u = result.rows[0];
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, companyId: u.company_id, companyName: u.company_name, isActive: u.is_active, emailVerified: u.email_verified ?? true });
}
