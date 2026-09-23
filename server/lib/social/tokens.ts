/**
 * Access-token refresh for platforms with short-lived tokens.
 * YouTube (Google) tokens last 1h and TikTok tokens 24h, so they must be
 * refreshed with the stored refresh_token before every publish.
 */
import db from '../../db.js';
import { decryptToken, encryptToken } from '../outreach/encrypt.js';
import fetch from 'node-fetch';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface TokenAccount {
  social_account_id: string;
  platform: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | Date | null;
}

function isExpiring(expiresAt: TokenAccount['token_expires_at']): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() < REFRESH_MARGIN_MS;
}

async function saveTokens(accountId: string, accessToken: string, expiresIn: number | undefined, refreshToken?: string) {
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  await db.run(
    `UPDATE social_accounts
       SET access_token = ?, token_expires_at = ?, refresh_token = COALESCE(?, refresh_token), updated_at = NOW()
     WHERE id = ?`,
    encryptToken(accessToken), expiresAt, refreshToken ? encryptToken(refreshToken) : null, accountId
  );
}

async function refreshGoogle(account: TokenAccount): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(account.refresh_token!),
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
    }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error(`YouTube token refresh failed (${data.error_description || data.error || res.status}). Reconnect the account.`);
  }
  await saveTokens(account.social_account_id, data.access_token, data.expires_in, data.refresh_token);
  return data.access_token;
}

async function refreshTikTok(account: TokenAccount): Promise<string> {
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptToken(account.refresh_token!),
      client_key: process.env.TIKTOK_CLIENT_KEY?.trim() || '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET?.trim() || '',
    }).toString(),
  });
  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error(`TikTok token refresh failed (${data.error_description || data.error || res.status}). Reconnect the account.`);
  }
  await saveTokens(account.social_account_id, data.access_token, data.expires_in, data.refresh_token);
  return data.access_token;
}

/** Returns a usable (decrypted) access token, refreshing it first when needed. */
export async function getFreshAccessToken(account: TokenAccount): Promise<string> {
  if (isExpiring(account.token_expires_at) && account.refresh_token) {
    if (account.platform === 'youtube') return refreshGoogle(account);
    if (account.platform === 'tiktok') return refreshTikTok(account);
  }
  return decryptToken(account.access_token);
}
