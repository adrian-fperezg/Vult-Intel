/**
 * Social Studio Analytics
 * GET /api/social/analytics
 *
 * Fetches real metrics from each platform API for the accounts connected to the
 * selected project. Nothing is estimated: a metric the platform does not expose
 * (or that the connection lacks permission for) is returned as null and the
 * account carries an explanatory `error`.
 */
import { Router } from 'express';
import { AuthRequest } from '../../middleware.js';
import db from '../../db.js';
import redis from '../../redis.js';
import { decryptToken } from '../../lib/outreach/encrypt.js';
import { getFreshAccessToken } from '../../lib/social/tokens.js';
import { TwitterApi } from 'twitter-api-v2';
import {
  META_GRAPH_URL, PUBLISHABLE_PLATFORMS, getLinkedInVersion, getLinkedInAuthorUrn,
} from '../../lib/social/utils.js';
import {
  DayMetric, AnalyticsRange, buildDateRange, splitRange, fillDailySeries, growth,
  sumNullable, metaDayKey, rate, dayKey,
} from '../../lib/social/analyticsUtils.js';
import fetch from 'node-fetch';

const router = Router();

// Platform APIs are rate-limited (YouTube quota, X caps), so results are cached briefly.
const CACHE_TTL_SECONDS = 15 * 60;

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface PlatformPost {
  id: string;
  text: string;
  imageUrl: string | null;
  date: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagementRate: number;
}

interface AccountAnalytics {
  accountId: string;
  platform: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  followers: number | null;
  prevFollowers: number | null;
  impressions: number | null;
  prevImpressions: number | null;
  engagements: number | null;
  prevEngagements: number | null;
  reach: number | null;
  engagementRate: number;
  dailySeries: DayMetric[];
  topPosts: PlatformPost[];
  error: string | null;
}

type PlatformResult = Partial<AccountAnalytics> & { posts?: PlatformPost[]; warnings?: string[] };

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string | number) {
    super(message);
  }
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

async function getJson(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  const err = data.error;
  if (!res.ok || (err && (typeof err !== 'object' || err.code !== 'ok'))) {
    const message = err?.message || err?.error_user_msg || data.message || data.detail || (typeof err === 'string' ? err : '') || `HTTP ${res.status}`;
    throw new ApiError(message, res.status, err?.code ?? data.serviceErrorCode ?? data.status);
  }
  return data;
}

function isPermissionError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  return err?.status === 401 || err?.status === 403 || [10, 190, 200].includes(Number(err?.code))
    || /permission|scope|not authorized|insufficient|access_denied|forbidden|unauthorized/.test(msg);
}

const warn = (warnings: string[], text: string) => { if (!warnings.includes(text)) warnings.push(text); };

// ─── META (Instagram / Facebook) ──────────────────────────────────────────────

// Daily time-series insight, fetched in ≤30-day windows (Meta's limit).
async function metaDailySeries(objectId: string, metric: string, token: string, range: AnalyticsRange, useCurrent = true): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const [from, to] = useCurrent ? [range.from, range.to] : [range.prevFrom, range.prevTo];
  for (const w of splitRange(from, to, 30)) {
    const data = await getJson(`${META_GRAPH_URL}/${objectId}/insights?metric=${metric}&period=day&since=${w.since}&until=${w.until}&access_token=${token}`);
    for (const series of data.data || []) {
      for (const v of series.values || []) {
        const key = metaDayKey(v.end_time);
        out[key] = (out[key] || 0) + (Number(v.value) || 0);
      }
    }
  }
  return out;
}

// Period total for metrics only available as metric_type=total_value.
async function metaTotal(objectId: string, metric: string, token: string, from: Date, to: Date): Promise<number> {
  let total = 0;
  for (const w of splitRange(from, to, 30)) {
    const data = await getJson(`${META_GRAPH_URL}/${objectId}/insights?metric=${metric}&metric_type=total_value&period=day&since=${w.since}&until=${w.until}&access_token=${token}`);
    for (const m of data.data || []) total += Number(m.total_value?.value) || 0;
  }
  return total;
}

// Meta renames/retires page metrics over time; use the first one this API version accepts.
async function metaFirstAvailableSeries(objectId: string, metrics: string[], token: string, range: AnalyticsRange, useCurrent = true) {
  let lastErr: any;
  for (const metric of metrics) {
    try {
      return await metaDailySeries(objectId, metric, token, range, useCurrent);
    } catch (err) {
      lastErr = err;
      if (isPermissionError(err)) throw err;
    }
  }
  throw lastErr;
}

const sumValues = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);

async function fetchInstagramAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const token = decryptToken(account.access_token);
  const igId = account.account_id;
  const warnings: string[] = [];

  const profile = await getJson(`${META_GRAPH_URL}/${igId}?fields=followers_count,username&access_token=${token}`);
  const followers: number = profile.followers_count ?? null;

  const dailyMap: Record<string, DayMetric> = {};
  const day = (key: string) => (dailyMap[key] ||= { date: key, impressions: 0, engagements: 0, reach: 0 });

  let impressions: number | null = null, prevImpressions: number | null = null;
  let engagements: number | null = null, prevEngagements: number | null = null;
  let reach: number | null = null, prevFollowers: number | null = null;

  try {
    const reachSeries = await metaDailySeries(igId, 'reach', token, range);
    for (const [k, v] of Object.entries(reachSeries)) day(k).reach += v;
    reach = sumValues(reachSeries);

    impressions = await metaTotal(igId, 'views', token, range.from, range.to);
    prevImpressions = await metaTotal(igId, 'views', token, range.prevFrom, range.prevTo);
    engagements = await metaTotal(igId, 'total_interactions', token, range.from, range.to);
    prevEngagements = await metaTotal(igId, 'total_interactions', token, range.prevFrom, range.prevTo);

    // follower_count = new followers per day, only for the last 30 days (unfollows are not reported).
    if (range.days <= 30 && followers !== null) {
      try {
        const gains = await metaDailySeries(igId, 'follower_count', token, range);
        prevFollowers = Math.max(0, followers - sumValues(gains));
      } catch { /* follower history is optional */ }
    }
  } catch (err: any) {
    console.warn(`[ANALYTICS] instagram insights ${igId}:`, err.message);
    warn(warnings, isPermissionError(err)
      ? 'Reconnect Instagram to grant the insights permission (instagram_manage_insights).'
      : `Instagram insights unavailable: ${err.message}`);
  }

  // Recent media with engagement counts; view counts for the best ones.
  const posts: PlatformPost[] = [];
  const media = await getJson(
    `${META_GRAPH_URL}/${igId}/media?fields=id,caption,timestamp,media_url,thumbnail_url,like_count,comments_count,media_type&limit=50&access_token=${token}`
  );
  for (const m of media.data || []) {
    const ts = new Date(m.timestamp);
    if (ts < range.from || ts > range.to) continue;
    const likes = m.like_count || 0;
    const comments = m.comments_count || 0;
    posts.push({
      id: m.id, text: m.caption || '', imageUrl: m.thumbnail_url || m.media_url || null, date: m.timestamp,
      likes, comments, shares: 0, impressions: 0, reach: 0, engagementRate: 0,
    });
  }
  posts.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
  for (const p of posts.slice(0, 10)) {
    try {
      const ins = await getJson(`${META_GRAPH_URL}/${p.id}/insights?metric=views,reach,shares&access_token=${token}`);
      for (const m of ins.data || []) {
        const v = Number(m.values?.[0]?.value ?? m.total_value?.value) || 0;
        if (m.name === 'views') p.impressions = v;
        if (m.name === 'reach') p.reach = v;
        if (m.name === 'shares') p.shares = v;
      }
      p.engagementRate = rate(p.likes + p.comments + p.shares, p.reach || followers || 0);
    } catch { /* per-media insights are optional */ }
  }
  for (const p of posts) day(dayKey(new Date(p.date))).engagements += p.likes + p.comments;

  return {
    followers, prevFollowers, impressions, prevImpressions, engagements, prevEngagements, reach,
    engagementRate: rate(engagements ?? 0, reach || followers || 0),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings,
  };
}

async function fetchFacebookAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const token = decryptToken(account.access_token);
  const pageId = account.channel_id || account.page_id;
  const warnings: string[] = [];

  const page = await getJson(`${META_GRAPH_URL}/${pageId}?fields=followers_count,fan_count,name&access_token=${token}`);
  const followers: number | null = page.followers_count ?? page.fan_count ?? null;

  const dailyMap: Record<string, DayMetric> = {};
  const day = (key: string) => (dailyMap[key] ||= { date: key, impressions: 0, engagements: 0, reach: 0 });

  let impressions: number | null = null, prevImpressions: number | null = null;
  let engagements: number | null = null, prevEngagements: number | null = null;
  let reach: number | null = null, prevFollowers: number | null = null;

  const VIEWS = ['page_media_view', 'page_impressions'];
  const UNIQUE_VIEWS = ['page_total_media_view_unique', 'page_impressions_unique'];

  try {
    const views = await metaFirstAvailableSeries(pageId, VIEWS, token, range);
    for (const [k, v] of Object.entries(views)) day(k).impressions += v;
    impressions = sumValues(views);
    prevImpressions = sumValues(await metaFirstAvailableSeries(pageId, VIEWS, token, range, false));

    const eng = await metaDailySeries(pageId, 'page_post_engagements', token, range);
    for (const [k, v] of Object.entries(eng)) day(k).engagements += v;
    engagements = sumValues(eng);
    prevEngagements = sumValues(await metaDailySeries(pageId, 'page_post_engagements', token, range, false));

    try {
      const uniq = await metaFirstAvailableSeries(pageId, UNIQUE_VIEWS, token, range);
      for (const [k, v] of Object.entries(uniq)) day(k).reach += v;
      reach = sumValues(uniq);
    } catch { /* reach is optional */ }

    try {
      const follows = sumValues(await metaDailySeries(pageId, 'page_daily_follows_unique', token, range));
      const unfollows = sumValues(await metaDailySeries(pageId, 'page_daily_unfollows_unique', token, range));
      if (followers !== null) prevFollowers = Math.max(0, followers - (follows - unfollows));
    } catch { /* follower history is optional */ }
  } catch (err: any) {
    console.warn(`[ANALYTICS] facebook insights ${pageId}:`, err.message);
    warn(warnings, isPermissionError(err)
      ? 'Reconnect Facebook to grant the Page insights permission (read_insights).'
      : `Facebook insights unavailable: ${err.message}`);
  }

  const posts: PlatformPost[] = [];
  try {
    const data = await getJson(
      `${META_GRAPH_URL}/${pageId}/posts?fields=message,story,full_picture,created_time,` +
      `reactions.summary(true).limit(0),comments.summary(true).limit(0),shares` +
      `&since=${range.sinceTs}&until=${range.untilTs}&limit=50&access_token=${token}`
    );
    for (const p of data.data || []) {
      const likes = p.reactions?.summary?.total_count || 0;
      const comments = p.comments?.summary?.total_count || 0;
      const shares = p.shares?.count || 0;
      posts.push({
        id: p.id, text: p.message || p.story || '', imageUrl: p.full_picture || null, date: p.created_time,
        likes, comments, shares, impressions: 0, reach: 0,
        engagementRate: rate(likes + comments + shares, followers || 0),
      });
    }
  } catch (err: any) {
    warn(warnings, `Could not load Facebook posts: ${err.message}`);
  }
  posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));

  return {
    followers, prevFollowers, impressions, prevImpressions, engagements, prevEngagements, reach,
    engagementRate: rate(engagements ?? 0, impressions || followers || 0),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings,
  };
}

// ─── THREADS ──────────────────────────────────────────────────────────────────

async function fetchThreadsAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const token = decryptToken(account.access_token);
  const userId = account.account_id;
  const base = 'https://graph.threads.net/v1.0';
  const warnings: string[] = [];

  const dailyMap: Record<string, DayMetric> = {};
  const day = (key: string) => (dailyMap[key] ||= { date: key, impressions: 0, engagements: 0, reach: 0 });

  // views: daily series; likes/replies/reposts/quotes/followers_count: totals.
  const periodTotals = async (from: Date, to: Date) => {
    const since = Math.floor(from.getTime() / 1000), until = Math.floor(to.getTime() / 1000);
    const data = await getJson(`${base}/${userId}/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count&since=${since}&until=${until}&access_token=${token}`);
    let views = 0, interactions = 0, followers: number | null = null;
    const series: Record<string, number> = {};
    for (const m of data.data || []) {
      if (m.name === 'views') {
        for (const v of m.values || []) { views += Number(v.value) || 0; const k = metaDayKey(v.end_time); series[k] = (series[k] || 0) + (Number(v.value) || 0); }
      } else if (m.name === 'followers_count') {
        followers = Number(m.total_value?.value) || 0;
      } else {
        interactions += Number(m.total_value?.value) || 0;
      }
    }
    return { views, interactions, followers, series };
  };

  let followers: number | null = null, impressions: number | null = null, prevImpressions: number | null = null;
  let engagements: number | null = null, prevEngagements: number | null = null;
  try {
    const cur = await periodTotals(range.from, range.to);
    const prev = await periodTotals(range.prevFrom, range.prevTo);
    followers = cur.followers;
    impressions = cur.views; engagements = cur.interactions;
    prevImpressions = prev.views; prevEngagements = prev.interactions;
    for (const [k, v] of Object.entries(cur.series)) day(k).impressions += v;
  } catch (err: any) {
    console.warn(`[ANALYTICS] threads insights ${userId}:`, err.message);
    warn(warnings, isPermissionError(err)
      ? 'Reconnect Threads to grant the insights permission (threads_manage_insights).'
      : `Threads insights unavailable: ${err.message}`);
  }

  const posts: PlatformPost[] = [];
  try {
    const list = await getJson(`${base}/${userId}/threads?fields=id,text,timestamp,media_url,thumbnail_url&since=${range.sinceTs}&until=${range.untilTs}&limit=25&access_token=${token}`);
    for (const t of (list.data || []).slice(0, 15)) {
      const p: PlatformPost = {
        id: t.id, text: t.text || '', imageUrl: t.thumbnail_url || t.media_url || null, date: t.timestamp,
        likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0, engagementRate: 0,
      };
      try {
        const ins = await getJson(`${base}/${t.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${token}`);
        for (const m of ins.data || []) {
          const v = Number(m.values?.[0]?.value ?? m.total_value?.value) || 0;
          if (m.name === 'views') p.impressions = v;
          if (m.name === 'likes') p.likes = v;
          if (m.name === 'replies') p.comments = v;
          if (m.name === 'reposts' || m.name === 'quotes') p.shares += v;
        }
        p.engagementRate = rate(p.likes + p.comments + p.shares, p.impressions);
      } catch { /* per-post insights are optional */ }
      day(dayKey(new Date(p.date))).engagements += p.likes + p.comments + p.shares;
      posts.push(p);
    }
  } catch (err: any) {
    warn(warnings, `Could not load Threads posts: ${err.message}`);
  }
  posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));

  return {
    followers, prevFollowers: null, impressions, prevImpressions, engagements, prevEngagements, reach: null,
    engagementRate: rate(engagements ?? 0, impressions ?? 0),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings,
  };
}

// ─── LINKEDIN ─────────────────────────────────────────────────────────────────
// LinkedIn exposes analytics only for Company Pages (Community Management API,
// r_organization_admin). Member profiles have no analytics with our permissions.

async function fetchLinkedInAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const authorUrn = getLinkedInAuthorUrn(account);
  if (!authorUrn.startsWith('urn:li:organization:')) {
    throw new ApiError('LinkedIn only provides analytics for Company Pages. Personal profile metrics are not available through the API.', 0, 'NO_MEMBER_ANALYTICS');
  }

  const token = decryptToken(account.access_token);
  const base = 'https://api.linkedin.com/rest';
  const headers = {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': getLinkedInVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };
  const org = encodeURIComponent(authorUrn);
  const interval = (from: Date, to: Date, daily: boolean) =>
    `(timeRange:(start:${from.getTime()},end:${to.getTime()})${daily ? ',timeGranularityType:DAY' : ''})`;

  const network = await getJson(`${base}/networkSizes/${org}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`, { headers });
  const followers: number | null = network.firstDegreeSize ?? null;

  const dailyMap: Record<string, DayMetric> = {};
  let impressions = 0, engagements = 0, reach = 0;
  const cur = await getJson(`${base}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${org}&timeIntervals=${interval(range.from, range.to, true)}`, { headers });
  for (const el of cur.elements || []) {
    const s = el.totalShareStatistics || {};
    const key = dayKey(new Date(el.timeRange?.start || Date.now()));
    const eng = (s.likeCount || 0) + (s.commentCount || 0) + (s.shareCount || 0) + (s.clickCount || 0);
    impressions += s.impressionCount || 0;
    engagements += eng;
    reach += s.uniqueImpressionsCount || 0;
    dailyMap[key] = { date: key, impressions: s.impressionCount || 0, engagements: eng, reach: s.uniqueImpressionsCount || 0 };
  }

  const prev = await getJson(`${base}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${org}&timeIntervals=${interval(range.prevFrom, range.prevTo, false)}`, { headers });
  const ps = prev.elements?.[0]?.totalShareStatistics || {};
  const prevImpressions = ps.impressionCount || 0;
  const prevEngagements = (ps.likeCount || 0) + (ps.commentCount || 0) + (ps.shareCount || 0) + (ps.clickCount || 0);

  let prevFollowers: number | null = null;
  try {
    const fs = await getJson(`${base}/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${org}&timeIntervals=${interval(range.from, range.to, true)}`, { headers });
    const gained = (fs.elements || []).reduce((s: number, el: any) =>
      s + (el.followerGains?.organicFollowerGain || 0) + (el.followerGains?.paidFollowerGain || 0), 0);
    if (followers !== null) prevFollowers = Math.max(0, followers - gained);
  } catch { /* follower history is optional */ }

  // Recent posts + their statistics
  const posts: PlatformPost[] = [];
  const list = await getJson(`${base}/posts?author=${org}&q=author&count=20&sortBy=LAST_MODIFIED`, { headers });
  const recent = (list.elements || []).filter((p: any) => {
    const ts = new Date(p.publishedAt || p.createdAt || 0);
    return ts >= range.from && ts <= range.to;
  });
  const statsById: Record<string, any> = {};
  if (recent.length) {
    const shares = recent.filter((p: any) => p.id.startsWith('urn:li:share:')).map((p: any) => encodeURIComponent(p.id));
    const ugc = recent.filter((p: any) => p.id.startsWith('urn:li:ugcPost:')).map((p: any) => encodeURIComponent(p.id));
    const params = [shares.length ? `shares=List(${shares.join(',')})` : '', ugc.length ? `ugcPosts=List(${ugc.join(',')})` : ''].filter(Boolean).join('&');
    try {
      const st = await getJson(`${base}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${org}&${params}`, { headers });
      for (const el of st.elements || []) statsById[el.share || el.ugcPost] = el.totalShareStatistics || {};
    } catch { /* per-post stats are optional */ }
  }
  for (const p of recent) {
    const s = statsById[p.id] || {};
    const likes = s.likeCount || 0, comments = s.commentCount || 0, sharesCount = s.shareCount || 0;
    posts.push({
      id: p.id, text: p.commentary || '', imageUrl: null,
      date: new Date(p.publishedAt || p.createdAt).toISOString(),
      likes, comments, shares: sharesCount, impressions: s.impressionCount || 0, reach: s.uniqueImpressionsCount || 0,
      engagementRate: rate(likes + comments + sharesCount, s.impressionCount || 0),
    });
  }
  posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));

  return {
    followers, prevFollowers, impressions, prevImpressions, engagements, prevEngagements, reach,
    engagementRate: rate(engagements, impressions),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings: [],
  };
}

// ─── YOUTUBE ──────────────────────────────────────────────────────────────────

async function fetchYouTubeAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const token = await getFreshAccessToken({ ...account, social_account_id: account.id });
  const headers = { Authorization: `Bearer ${token}` };
  const warnings: string[] = [];

  const channels = await getJson('https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true', { headers });
  const channel = channels.items?.[0];
  if (!channel) throw new ApiError('No YouTube channel found for this account', 404);
  const followers = parseInt(channel.statistics?.subscriberCount || '0', 10);

  const dailyMap: Record<string, DayMetric> = {};
  let impressions: number | null = null, prevImpressions: number | null = null;
  let engagements: number | null = null, prevEngagements: number | null = null, prevFollowers: number | null = null;

  const d = (x: Date) => dayKey(x);
  const report = (from: Date, to: Date, daily: boolean) => getJson(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${dayKey(from)}&endDate=${dayKey(to)}` +
    `&metrics=views,likes,comments,shares,subscribersGained,subscribersLost${daily ? '&dimensions=day&sort=day' : ''}`,
    { headers }
  );

  try {
    const cur = await report(range.from, range.to, true);
    let views = 0, eng = 0, netSubs = 0;
    for (const [date, v, likes, comments, shares, gained, lost] of cur.rows || []) {
      views += v; eng += likes + comments + shares; netSubs += gained - lost;
      dailyMap[date] = { date, impressions: v, engagements: likes + comments + shares, reach: 0 };
    }
    impressions = views; engagements = eng;
    prevFollowers = Math.max(0, followers - netSubs);

    const prev = await report(range.prevFrom, range.prevTo, false);
    const [pv = 0, pl = 0, pc = 0, psh = 0] = prev.rows?.[0] || [];
    prevImpressions = pv; prevEngagements = pl + pc + psh;
  } catch (err: any) {
    console.warn('[ANALYTICS] youtube reports:', err.message);
    warn(warnings, isPermissionError(err)
      ? 'Reconnect YouTube to grant the YouTube Analytics permission.'
      : `YouTube Analytics unavailable: ${err.message}`);
  }

  // Recent uploads (playlistItems + videos cost 1 quota unit each, unlike search)
  const posts: PlatformPost[] = [];
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (uploads) {
    const items = await getJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=25`, { headers });
    const ids = (items.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
    if (ids.length) {
      const videos = await getJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids.join(',')}`, { headers });
      for (const v of videos.items || []) {
        const published = new Date(v.snippet?.publishedAt);
        if (published < range.from || published > range.to) continue;
        const likes = parseInt(v.statistics?.likeCount || '0', 10);
        const comments = parseInt(v.statistics?.commentCount || '0', 10);
        const views = parseInt(v.statistics?.viewCount || '0', 10);
        posts.push({
          id: v.id, text: v.snippet?.title || '', imageUrl: v.snippet?.thumbnails?.medium?.url || null,
          date: v.snippet?.publishedAt, likes, comments, shares: 0, impressions: views, reach: 0,
          engagementRate: rate(likes + comments, views),
        });
      }
    }
  }
  posts.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));

  return {
    followers, prevFollowers, impressions, prevImpressions, engagements, prevEngagements, reach: null,
    engagementRate: rate(engagements ?? 0, impressions ?? 0),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings,
  };
}

// ─── X / TWITTER ──────────────────────────────────────────────────────────────
// Reading posts requires a paid X API plan (Basic or higher).

async function fetchTwitterAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const [accessToken, accessSecret] = decryptToken(account.access_token).split(':');
  const client = new TwitterApi({
    appKey: (process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID || '').trim(),
    appSecret: (process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim(),
    accessToken, accessSecret,
  });

  try {
    const me = await client.v2.me({ 'user.fields': ['public_metrics'] });
    const followers = me.data.public_metrics?.followers_count ?? null;

    const timeline = async (from: Date, to: Date) => {
      const res = await client.v2.userTimeline(me.data.id, {
        start_time: from.toISOString(), end_time: to.toISOString(), max_results: 100,
        exclude: ['retweets', 'replies'], 'tweet.fields': ['public_metrics', 'created_at', 'text'],
      });
      return res.tweets;
    };

    const dailyMap: Record<string, DayMetric> = {};
    const posts: PlatformPost[] = [];
    let impressions = 0, engagements = 0;
    for (const t of await timeline(range.from, range.to)) {
      const m: any = t.public_metrics || {};
      const likes = m.like_count || 0, comments = m.reply_count || 0, shares = (m.retweet_count || 0) + (m.quote_count || 0);
      const views = m.impression_count || 0;
      impressions += views; engagements += likes + comments + shares;
      const key = dayKey(new Date(t.created_at!));
      const dm = (dailyMap[key] ||= { date: key, impressions: 0, engagements: 0, reach: 0 });
      dm.impressions += views; dm.engagements += likes + comments + shares;
      posts.push({ id: t.id, text: t.text, imageUrl: null, date: t.created_at!, likes, comments, shares, impressions: views, reach: 0, engagementRate: rate(likes + comments + shares, views) });
    }
    let prevImpressions = 0, prevEngagements = 0;
    for (const t of await timeline(range.prevFrom, range.prevTo)) {
      const m: any = t.public_metrics || {};
      prevImpressions += m.impression_count || 0;
      prevEngagements += (m.like_count || 0) + (m.reply_count || 0) + (m.retweet_count || 0) + (m.quote_count || 0);
    }
    posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));

    return {
      followers, prevFollowers: null, impressions, prevImpressions, engagements, prevEngagements, reach: null,
      engagementRate: rate(engagements, impressions),
      dailySeries: fillDailySeries(range.from, range.to, dailyMap),
      posts, warnings: [],
    };
  } catch (err: any) {
    const code = err.code || err.data?.status;
    if (code === 403 || code === 429 || /client-not-enrolled|UsageCapExceeded/i.test(JSON.stringify(err.data || ''))) {
      throw new ApiError('Your X API plan does not allow reading posts (Basic plan or higher is required for analytics).', 403, 'X_PLAN');
    }
    throw new ApiError(err.data?.detail || err.message, code || 500);
  }
}

// ─── TIKTOK ───────────────────────────────────────────────────────────────────
// Needs the user.info.stats and video.list scopes (enable them in the TikTok
// developer portal, then add them to TIKTOK_SCOPES and reconnect).

async function fetchTikTokAnalytics(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  const scopes = String(account.scopes || '');
  if (!scopes.includes('user.info.stats') || !scopes.includes('video.list')) {
    throw new ApiError('TikTok analytics needs the user.info.stats and video.list permissions. Enable them in the TikTok developer portal and reconnect.', 403, 'TIKTOK_SCOPES');
  }
  const token = await getFreshAccessToken({ ...account, social_account_id: account.id });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const user = await getJson('https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count', { headers });
  const followers = user.data?.user?.follower_count ?? null;

  const posts: PlatformPost[] = [];
  const dailyMap: Record<string, DayMetric> = {};
  let impressions = 0, engagements = 0, cursor: number | undefined;
  for (let page = 0; page < 5; page++) {
    const list = await getJson('https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,cover_image_url,create_time,like_count,comment_count,share_count,view_count', {
      method: 'POST', headers, body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
    });
    let reachedOlder = false;
    for (const v of list.data?.videos || []) {
      const created = new Date(v.create_time * 1000);
      if (created < range.from) { reachedOlder = true; continue; }
      if (created > range.to) continue;
      const likes = v.like_count || 0, comments = v.comment_count || 0, shares = v.share_count || 0, views = v.view_count || 0;
      impressions += views; engagements += likes + comments + shares;
      const key = dayKey(created);
      const dm = (dailyMap[key] ||= { date: key, impressions: 0, engagements: 0, reach: 0 });
      dm.impressions += views; dm.engagements += likes + comments + shares;
      posts.push({ id: v.id, text: v.title || v.video_description || '', imageUrl: v.cover_image_url || null, date: created.toISOString(), likes, comments, shares, impressions: views, reach: 0, engagementRate: rate(likes + comments + shares, views) });
    }
    if (reachedOlder || !list.data?.has_more) break;
    cursor = list.data.cursor;
  }
  posts.sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares));

  return {
    followers, prevFollowers: null, impressions, prevImpressions: null, engagements, prevEngagements: null, reach: null,
    engagementRate: rate(engagements, impressions),
    dailySeries: fillDailySeries(range.from, range.to, dailyMap),
    posts, warnings: [],
  };
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────

async function fetchPlatform(account: any, range: AnalyticsRange): Promise<PlatformResult> {
  switch (account.platform) {
    case 'instagram': return fetchInstagramAnalytics(account, range);
    case 'facebook':  return fetchFacebookAnalytics(account, range);
    case 'threads':   return fetchThreadsAnalytics(account, range);
    case 'linkedin':  return fetchLinkedInAnalytics(account, range);
    case 'youtube':   return fetchYouTubeAnalytics(account, range);
    case 'twitter':   return fetchTwitterAnalytics(account, range);
    case 'tiktok':    return fetchTikTokAnalytics(account, range);
    default:          throw new ApiError(`Analytics not supported for ${account.platform}`, 400);
  }
}

async function fetchAccountAnalytics(account: any, range: AnalyticsRange): Promise<AccountAnalytics & { posts: PlatformPost[] }> {
  const base: AccountAnalytics & { posts: PlatformPost[] } = {
    accountId: account.id,
    platform: account.platform,
    displayName: account.display_name || account.username,
    username: account.username,
    avatarUrl: account.avatar_url || null,
    followers: null, prevFollowers: null,
    impressions: null, prevImpressions: null,
    engagements: null, prevEngagements: null,
    reach: null, engagementRate: 0,
    dailySeries: fillDailySeries(range.from, range.to, {}),
    topPosts: [], posts: [], error: null,
  };

  const cacheKey = `social:analytics:${account.id}:${range.days}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache is best-effort */ }

  let result: AccountAnalytics & { posts: PlatformPost[] };
  try {
    const { warnings = [], posts = [], ...data } = await fetchPlatform(account, range);
    result = { ...base, ...data, posts, topPosts: posts.slice(0, 5), error: warnings.length ? warnings.join(' ') : null };
  } catch (err: any) {
    console.error(`[ANALYTICS] ${account.platform} ${account.username}:`, err.message);
    const known = ['NO_MEMBER_ANALYTICS', 'X_PLAN', 'TIKTOK_SCOPES'].includes(err.code);
    result = {
      ...base,
      error: known ? err.message
        : isPermissionError(err) ? `Reconnect this ${account.platform} account to grant analytics permissions.`
        : err.message,
    };
    // Errors are cached for a shorter time so a reconnect shows up quickly.
    try { await redis.setex(cacheKey, 60, JSON.stringify(result)); } catch { /* ignore */ }
    return result;
  }
  try { await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result)); } catch { /* ignore */ }
  return result;
}

// ─── MAIN ENDPOINT ────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  if (!pId) return res.status(400).json({ error: 'project_id required' });

  const days = Math.max(7, Math.min(parseInt((req.query.days as string) || '30', 10) || 30, 365));
  const accountIds = req.query.account_ids
    ? (req.query.account_ids as string).split(',').filter(Boolean)
    : null;

  try {
    const range = buildDateRange(days);

    // Publishing accounts of this project (the Facebook profile row only holds the login token).
    const platformPlaceholders = PUBLISHABLE_PLATFORMS.map(() => '?').join(', ');
    let accounts = await db.all<any>(`
      SELECT id, platform, account_id, username, display_name, avatar_url,
             access_token, refresh_token, token_expires_at, scopes, page_id, channel_id
      FROM social_accounts
      WHERE project_id = ? AND user_id = ? AND platform IN (${platformPlaceholders})
        AND NOT (platform = 'facebook' AND COALESCE(channel_id, '') = '')
      ORDER BY platform, created_at ASC
    `, pId, userId, ...PUBLISHABLE_PLATFORMS);

    if (accountIds?.length) {
      accounts = accounts.filter(a => accountIds.includes(a.id));
    }

    const results = await Promise.all(accounts.map(a => fetchAccountAnalytics(a, range)));

    // Metrics of the posts published from Vult, matched by the platform's post id.
    const metricsByPlatformPost = new Map<string, PlatformPost>();
    for (const r of results) for (const p of r.posts) metricsByPlatformPost.set(`${r.accountId}:${p.id}`, p);

    const postsHistory = await db.all<any>(`
      SELECT p.id, p.body, p.media_urls, p.created_at, p.scheduled_at, p.published_at,
             t.platform, t.account_id, t.platform_post_id, t.custom_body, t.published_at AS target_published_at,
             a.display_name AS account_name, a.username
      FROM social_posts p
      JOIN social_post_targets t ON t.post_id = p.id
      JOIN social_accounts a ON a.id = t.account_id
      WHERE p.project_id = ? AND p.user_id = ?
        AND t.status IN ('published', 'published_partial')
        AND COALESCE(t.published_at, p.published_at, p.created_at) BETWEEN ? AND ?
      ORDER BY COALESCE(t.published_at, p.published_at, p.created_at) DESC
      LIMIT 200
    `, pId, userId, range.from.toISOString(), range.to.toISOString());

    const postsHistoryFormatted = postsHistory
      .filter((p: any) => !accountIds?.length || accountIds.includes(p.account_id))
      .map((p: any) => {
        let mediaUrls: string[] = [];
        try { mediaUrls = Array.isArray(p.media_urls) ? p.media_urls : JSON.parse(p.media_urls || '[]'); } catch { /* ignore */ }
        const m = metricsByPlatformPost.get(`${p.account_id}:${p.platform_post_id}`);
        const engagements = m ? m.likes + m.comments + m.shares : 0;
        return {
          id: `${p.id}:${p.account_id}`,
          body: p.custom_body || p.body,
          platform: p.platform,
          accountName: p.account_name || p.username,
          scheduledAt: p.scheduled_at || p.created_at,
          publishedAt: p.target_published_at || p.published_at,
          impressions: m?.impressions || 0,
          engagements,
          engagementRate: m?.impressions ? rate(engagements, m.impressions) : 0,
          mediaUrl: mediaUrls[0] || null,
        };
      });

    // Daily series across accounts
    const dailyAggMap: Record<string, DayMetric> = {};
    for (const r of results) {
      for (const d of r.dailySeries) {
        const agg = (dailyAggMap[d.date] ||= { date: d.date, impressions: 0, engagements: 0, reach: 0 });
        agg.impressions += d.impressions; agg.engagements += d.engagements; agg.reach += d.reach;
      }
    }
    const dailyAggregated = Object.values(dailyAggMap).sort((a, b) => a.date.localeCompare(b.date));

    const totalFollowers = sumNullable(results.map(r => r.followers));
    const totalImpressions = sumNullable(results.map(r => r.impressions));
    const totalEngagements = sumNullable(results.map(r => r.engagements));
    const totalReach = sumNullable(results.map(r => r.reach));

    const byAccount = results.map(({ posts, ...rest }) => rest);

    res.json({
      summary: {
        totalPosts: new Set(postsHistoryFormatted.map(p => p.id.split(':')[0])).size,
        totalFollowers: totalFollowers ?? 0,
        totalImpressions: totalImpressions ?? 0,
        totalEngagements: totalEngagements ?? 0,
        totalReach: totalReach ?? 0,
        engagementRate: rate(totalEngagements ?? 0, totalImpressions || totalFollowers || 0),
        // Growth only compares accounts that report both periods (null = unknown).
        followerGrowth: growth(results.map(r => [r.followers, r.prevFollowers])),
        impressionsGrowth: growth(results.map(r => [r.impressions, r.prevImpressions])),
        engagementsGrowth: growth(results.map(r => [r.engagements, r.prevEngagements])),
      },
      byAccount,
      postsHistory: postsHistoryFormatted,
      dailyAggregated,
      range: { from: range.from.toISOString(), to: range.to.toISOString(), days },
    });
  } catch (err: any) {
    console.error('[ANALYTICS] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
