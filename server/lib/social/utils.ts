/**
 * Social Studio shared helpers (pure functions — covered by utils.test.ts).
 */

// Platforms Social Studio can publish to. Other rows in social_accounts
// (instagram_dm, whatsapp, telegram, twilio) belong to Vult Pulse.
export const PUBLISHABLE_PLATFORMS = ['linkedin', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok', 'threads'] as const;

// Graph API versions are retired ~2 years after release; keep it in one place.
export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const VIDEO_EXT =/\.(mp4|mov|m4v|webm)$/i;

// Media URLs are usually signed storage URLs (…/file.mp4?GoogleAccessId=…),
// so the extension must be checked on the path, not the full URL.
export function isVideoUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const path = url.split(/[?#]/)[0];
  return VIDEO_EXT.test(path);
}

export function mimeTypeFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.mp4') || path.endsWith('.m4v')) return 'video/mp4';
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.webm')) return 'video/webm';
  return 'image/jpeg';
}

export function parseJsonObject(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

// UI content type ('Post', 'Reel', 'Story', 'Carousel', …) → normalized upper-case type.
export function normalizeContentType(contentType: unknown): string {
  const t = typeof contentType === 'string' ? contentType.trim().toUpperCase() : '';
  if (!t || t === 'CAROUSEL' || t === 'TWEET' || t === 'VIDEO POST' || t === 'VIDEO') return 'POST';
  return t;
}

// LinkedIn versions are YYYYMM and each is supported for ~1 year, so a fixed
// value eventually stops working. Default to the version from 2 months ago.
export function getLinkedInVersion(now: Date = new Date()): string {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// LinkedIn organization pages are stored with channel_id = 'urn:li:organization:<id>'.
export function getLinkedInAuthorUrn(account: { account_id: string; channel_id?: string | null }): string {
  if (account.channel_id && account.channel_id.startsWith('urn:li:organization:')) return account.channel_id;
  return `urn:li:person:${account.account_id}`;
}

// UI → X API v2 reply_settings (undefined means "everyone").
export function mapTwitterReplySettings(value: unknown): 'following' | 'mentionedUsers' | undefined {
  if (value === 'followers' || value === 'following') return 'following';
  if (value === 'mentioned') return 'mentionedUsers';
  return undefined;
}

// UI → Threads reply_control.
export function mapThreadsReplyControl(value: unknown): 'everyone' | 'accounts_you_follow' | 'mentioned_only' {
  if (value === 'following') return 'accounts_you_follow';
  if (value === 'mentioned') return 'mentioned_only';
  return 'everyone';
}

export function youtubeTitleFrom(body: string, explicitTitle?: string): string {
  const source = (explicitTitle || '').trim() || (body || '').split('\n').find(l => l.trim())?.trim() || 'Untitled video';
  // YouTube rejects titles over 100 chars or containing angle brackets.
  return source.replace(/[<>]/g, '').slice(0, 100);
}

export function linkedInPollDuration(days: unknown): 'ONE_DAY' | 'THREE_DAYS' | 'SEVEN_DAYS' | 'FOURTEEN_DAYS' {
  const n = Number(days);
  if (n <= 1) return 'ONE_DAY';
  if (n <= 3) return 'THREE_DAYS';
  if (n <= 7) return 'SEVEN_DAYS';
  return 'FOURTEEN_DAYS';
}

// TikTok FILE_UPLOAD chunking rules: chunks of 5–64MB, last chunk may absorb the
// remainder (up to 128MB); files ≤ 64MB go in a single chunk.
export function tiktokChunkPlan(size: number): { chunkSize: number; totalChunks: number } {
  const MAX_SINGLE = 64 * 1024 * 1024;
  if (size <= MAX_SINGLE) return { chunkSize: size, totalChunks: 1 };
  const chunkSize = 10 * 1024 * 1024;
  return { chunkSize, totalChunks: Math.floor(size / chunkSize) };
}
