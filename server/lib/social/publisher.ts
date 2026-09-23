/**
 * Social Studio Publisher
 * Publishes a social_post to all its pending targets.
 * Called by the cron scheduler and by the "Post Now" endpoint.
 */
import db from '../../db.js';
import { decryptToken, encryptToken } from '../outreach/encrypt.js';
import fetch from 'node-fetch';
import { TwitterApi } from 'twitter-api-v2';
import { getFreshAccessToken } from './tokens.js';
import {
  isVideoUrl, mimeTypeFromUrl, parseJsonObject, normalizeContentType,
  getLinkedInVersion, getLinkedInAuthorUrn, mapTwitterReplySettings, mapThreadsReplyControl,
  youtubeTitleFrom, linkedInPollDuration, tiktokChunkPlan, META_GRAPH_URL,
} from './utils.js';

export class PartialPublishError extends Error {
  constructor(message: string, public platformPostId: string) {
    super(message);
    this.name = 'PartialPublishError';
  }
}

// Small utility – waits ms milliseconds before resolving
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Delay before posting a first comment so the platform has time to index the post
const COMMENT_DELAY_MS = 20_000;

async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download media (${res.status}): ${url.split('?')[0]}`);
  return Buffer.from(await res.arrayBuffer());
}

// Some endpoints (LinkedIn /rest/posts) answer 201 with an empty body.
async function readJson(res: { text(): Promise<string> }): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function graphPost(path: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${META_GRAPH_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// ─── LINKEDIN ─────────────────────────────────────────────────────────────────

async function publishToLinkedIn(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const authorUrn = getLinkedInAuthorUrn(account);
  const isOrg = authorUrn.startsWith('urn:li:organization:');
  const opts = post.platform_options;
  const mediaUrls: string[] = post.media_urls || [];

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': getLinkedInVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };

  let content: any = undefined;

  if (mediaUrls.length > 0) {
    if (isVideoUrl(mediaUrls[0])) {
      // Video: multipart upload driven by uploadInstructions, then finalize.
      const buffer = await downloadMedia(mediaUrls[0]);
      const initReq = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
        method: 'POST', headers,
        body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn, fileSizeBytes: buffer.length, uploadCaptions: false, uploadThumbnail: false } }),
      });
      const initData = await readJson(initReq);
      if (!initReq.ok) throw new Error(`LinkedIn video init error: ${initData.message || JSON.stringify(initData)}`);

      const { video, uploadInstructions = [], uploadToken = '' } = initData.value;
      const uploadedPartIds: string[] = [];
      for (const part of uploadInstructions) {
        const partRes = await fetch(part.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: buffer.subarray(part.firstByte, part.lastByte + 1),
        });
        if (!partRes.ok) throw new Error(`LinkedIn video upload failed (${partRes.status})`);
        uploadedPartIds.push(partRes.headers.get('etag') || '');
      }

      const finalizeReq = await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
        method: 'POST', headers,
        body: JSON.stringify({ finalizeUploadRequest: { video, uploadToken, uploadedPartIds } }),
      });
      if (!finalizeReq.ok) {
        const err = await readJson(finalizeReq);
        throw new Error(`LinkedIn video finalize error: ${err.message || JSON.stringify(err)}`);
      }
      content = { media: { id: video } };
    } else {
      const imageUrns: string[] = [];
      for (const url of mediaUrls.filter(u => !isVideoUrl(u)).slice(0, 9)) {
        const buffer = await downloadMedia(url);
        const initReq = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
          method: 'POST', headers,
          body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
        });
        const initData = await readJson(initReq);
        if (!initReq.ok) throw new Error(`LinkedIn image init error: ${initData.message || JSON.stringify(initData)}`);

        const uploadReq = await fetch(initData.value.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${token}` },
          body: buffer,
        });
        if (!uploadReq.ok) throw new Error(`LinkedIn image upload failed (${uploadReq.status})`);
        imageUrns.push(initData.value.image);
      }
      content = imageUrns.length > 1
        ? { multiImage: { images: imageUrns.map(id => ({ id })) } }
        : { media: { id: imageUrns[0] } };
    }
  } else if (post.link_url) {
    content = {
      article: {
        source: post.link_url,
        title: post.link_title || post.link_url,
        description: post.link_description || ''
      }
    };
  } else {
    const pollOptions = (opts.poll?.options || []).map((o: string) => (o || '').trim()).filter(Boolean);
    if (pollOptions.length >= 2) {
      content = {
        poll: {
          question: (post.body.split('\n').find((l: string) => l.trim()) || 'Poll').trim().slice(0, 140),
          options: pollOptions.map((text: string) => ({ text: text.slice(0, 30) })),
          settings: { duration: linkedInPollDuration(opts.poll.duration) },
        }
      };
    }
  }

  const body: any = {
    author: authorUrn,
    commentary: post.body,
    // Organization posts must be PUBLIC; members can restrict to connections.
    visibility: !isOrg && opts.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (content) body.content = content;

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));

  const urn = res.headers.get('x-restli-id') || data.id;
  if (!urn) throw new Error('LinkedIn did not return a post id');

  if (post.first_comment) {
    await sleep(COMMENT_DELAY_MS);
    const commentRes = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(urn)}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actor: authorUrn,
        object: urn,
        message: { text: post.first_comment }
      }),
    });
    if (!commentRes.ok) {
      const commentData = await readJson(commentRes);
      throw new PartialPublishError('First comment failed: ' + (commentData.message || JSON.stringify(commentData)), urn);
    }
  }

  return urn;
}

// ─── FACEBOOK ─────────────────────────────────────────────────────────────────

async function facebookFirstComment(objectId: string, message: string, token: string) {
  await sleep(COMMENT_DELAY_MS);
  try {
    await graphPost(`${objectId}/comments`, { message, access_token: token });
  } catch (e: any) {
    throw new PartialPublishError('First comment failed: ' + e.message, objectId);
  }
}

// Reels and video stories use Meta's resumable upload: start → upload by URL → finish.
async function facebookResumableVideo(pageId: string, edge: 'video_reels' | 'video_stories', url: string, token: string, finishExtra: Record<string, any>): Promise<any> {
  const start = await graphPost(`${pageId}/${edge}`, { upload_phase: 'start', access_token: token });
  const uploadRes = await fetch(start.upload_url, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, file_url: url },
  });
  const uploadData = await readJson(uploadRes);
  if (!uploadRes.ok || uploadData.success === false) {
    throw new Error(`Facebook video upload failed: ${uploadData.debug_info?.message || JSON.stringify(uploadData)}`);
  }
  const finish = await graphPost(`${pageId}/${edge}`, { upload_phase: 'finish', video_id: start.video_id, access_token: token, ...finishExtra });
  return { ...finish, video_id: start.video_id };
}

async function publishToFacebook(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  // Pages are stored with channel_id = page id. The personal-profile row (no channel_id)
  // only holds the user token used to list pages — Meta does not allow posting to profiles.
  const pageId = account.channel_id || account.page_id;
  if (!pageId) {
    throw new Error('Facebook only allows publishing to Pages, not personal profiles. Select one of your Facebook Pages instead.');
  }

  const postType = normalizeContentType(post.platform_options.contentType);
  const mediaUrls: string[] = post.media_urls || [];

  if (postType === 'STORY') {
    if (!mediaUrls.length) throw new Error('Facebook Stories require an image or video');
    const url = mediaUrls[0];
    if (isVideoUrl(url)) {
      const data = await facebookResumableVideo(pageId, 'video_stories', url, token, {});
      return data.post_id || data.video_id;
    }
    const photo = await graphPost(`${pageId}/photos`, { url, published: false, access_token: token });
    const story = await graphPost(`${pageId}/photo_stories`, { photo_id: photo.id, access_token: token });
    return story.post_id || photo.id;
  }

  if (postType === 'REEL') {
    if (!mediaUrls.length || !isVideoUrl(mediaUrls[0])) throw new Error('Facebook Reels require a video');
    const data = await facebookResumableVideo(pageId, 'video_reels', mediaUrls[0], token, {
      video_state: 'PUBLISHED',
      description: post.body,
    });
    if (post.first_comment) await facebookFirstComment(data.video_id, post.first_comment, token);
    return data.video_id;
  }

  let postId: string;
  if (mediaUrls.length > 1) {
    // Multi-photo post
    if (mediaUrls.some(isVideoUrl)) throw new Error('Facebook multi-media posts only support images. Post the video on its own or as a Reel.');
    const attachedMedia = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const photo = await graphPost(`${pageId}/photos`, { url, published: false, access_token: token });
      attachedMedia.push({ media_fbid: photo.id });
    }
    const feed = await graphPost(`${pageId}/feed`, { message: post.body, attached_media: attachedMedia, access_token: token });
    postId = feed.id;
  } else if (mediaUrls.length === 1) {
    const url = mediaUrls[0];
    const data = isVideoUrl(url)
      ? await graphPost(`${pageId}/videos`, { file_url: url, description: post.body, access_token: token })
      : await graphPost(`${pageId}/photos`, { url, message: post.body, access_token: token });
    postId = data.post_id || data.id;
  } else {
    const body: any = { message: post.body, access_token: token };
    if (post.link_url) body.link = post.link_url;
    const data = await graphPost(`${pageId}/feed`, body);
    postId = data.id;
  }

  if (post.first_comment && postId) await facebookFirstComment(postId, post.first_comment, token);
  return postId;
}

// ─── INSTAGRAM ────────────────────────────────────────────────────────────────

async function waitForIgContainer(creationId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 36; attempt++) { // ~3 minutes
    const res = await fetch(`${META_GRAPH_URL}/${creationId}?fields=status_code,status&access_token=${token}`);
    const data = await res.json() as any;
    if (data.status_code === 'FINISHED' || data.status_code === 'PUBLISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram media processing failed: ${data.status || data.status_code}`);
    }
    await sleep(5000);
  }
  throw new Error('Instagram media processing timed out');
}

async function publishToInstagram(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const igUserId = account.account_id; // the instagram_business_account id
  const opts = post.platform_options;
  const postType = normalizeContentType(opts.contentType);
  const mediaUrls: string[] = post.media_urls || [];

  if (mediaUrls.length === 0) {
    throw new Error('Instagram requires at least one image or video');
  }

  const collaborators = typeof opts.collabAccount === 'string'
    ? opts.collabAccount.split(/[\s,]+/).map((u: string) => u.replace(/^@/, '').trim()).filter(Boolean).slice(0, 3)
    : [];
  const altText = typeof opts.altText === 'string' ? opts.altText.trim() : '';

  let creationId: string;

  if (postType === 'STORY') {
    const url = mediaUrls[0];
    const data = await graphPost(`${igUserId}/media`, {
      media_type: 'STORIES',
      [isVideoUrl(url) ? 'video_url' : 'image_url']: url,
      access_token: token,
    });
    creationId = data.id;
  } else if (postType === 'REEL') {
    if (!isVideoUrl(mediaUrls[0])) throw new Error('Instagram Reels require a video');
    const data = await graphPost(`${igUserId}/media`, {
      media_type: 'REELS',
      video_url: mediaUrls[0],
      caption: post.body,
      share_to_feed: true,
      ...(collaborators.length ? { collaborators } : {}),
      access_token: token,
    });
    creationId = data.id;
  } else if (mediaUrls.length > 1) {
    // CAROUSEL
    const childrenIds: string[] = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const video = isVideoUrl(url);
      const child = await graphPost(`${igUserId}/media`, {
        is_carousel_item: true,
        ...(video ? { media_type: 'VIDEO', video_url: url } : { image_url: url, ...(altText ? { alt_text: altText } : {}) }),
        access_token: token,
      });
      await waitForIgContainer(child.id, token);
      childrenIds.push(child.id);
    }
    const carousel = await graphPost(`${igUserId}/media`, {
      media_type: 'CAROUSEL',
      children: childrenIds.join(','),
      caption: post.body,
      ...(collaborators.length ? { collaborators } : {}),
      access_token: token,
    });
    creationId = carousel.id;
  } else {
    // Single image, or single video (feed videos are published as Reels)
    const url = mediaUrls[0];
    const data = await graphPost(`${igUserId}/media`, {
      ...(isVideoUrl(url)
        ? { media_type: 'REELS', video_url: url, share_to_feed: true }
        : { image_url: url, ...(altText ? { alt_text: altText } : {}) }),
      caption: post.body,
      ...(collaborators.length ? { collaborators } : {}),
      access_token: token,
    });
    creationId = data.id;
  }

  await waitForIgContainer(creationId, token);

  const pubData = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId, access_token: token });

  if (post.first_comment && pubData.id && postType !== 'STORY') {
    await sleep(COMMENT_DELAY_MS);
    try {
      await graphPost(`${pubData.id}/comments`, { message: post.first_comment, access_token: token });
    } catch (e: any) {
      throw new PartialPublishError('First comment failed: ' + e.message, pubData.id);
    }
  }

  return pubData.id;
}

// ─── YOUTUBE ──────────────────────────────────────────────────────────────────
// The YouTube Data API has no endpoint for community (text) posts, so YouTube
// targets publish a video via resumable upload.

async function publishToYouTube(account: any, post: any): Promise<string> {
  const mediaUrls: string[] = post.media_urls || [];
  const videoUrl = mediaUrls.find(isVideoUrl);
  if (!videoUrl) throw new Error('YouTube requires a video. The YouTube API does not support text-only community posts.');

  const token = await getFreshAccessToken(account);
  const buffer = await downloadMedia(videoUrl);
  const opts = post.platform_options;
  const privacyStatus = ['PUBLIC', 'UNLISTED', 'PRIVATE'].includes(opts.visibility) ? opts.visibility.toLowerCase() : 'public';

  const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeTypeFromUrl(videoUrl),
      'X-Upload-Content-Length': String(buffer.length),
    },
    body: JSON.stringify({
      snippet: { title: youtubeTitleFrom(post.body, opts.title), description: post.body.slice(0, 5000), categoryId: '22' },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    }),
  });
  if (!initRes.ok) {
    const err = await readJson(initRes);
    throw new Error(err.error?.message || `YouTube upload init failed (${initRes.status})`);
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube did not return an upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeTypeFromUrl(videoUrl), 'Content-Length': String(buffer.length) },
    body: buffer,
  });
  const data = await readJson(uploadRes);
  if (!uploadRes.ok || !data.id) throw new Error(data.error?.message || `YouTube upload failed (${uploadRes.status})`);
  return data.id;
}

// ─── TWITTER / X ──────────────────────────────────────────────────────────────

async function publishToTwitter(account: any, post: any): Promise<string> {
  const [accToken, accSecret] = decryptToken(account.access_token).split(':');
  const opts = post.platform_options;
  const mediaUrls: string[] = post.media_urls || [];

  const twitterClient = new TwitterApi({
    appKey: (process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID || '').trim(),
    appSecret: (process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim(),
    accessToken: accToken,
    accessSecret: accSecret,
  });

  // X allows up to 4 images, or a single video/GIF.
  const firstIsVideo = mediaUrls.length > 0 && isVideoUrl(mediaUrls[0]);
  const toUpload = firstIsVideo ? mediaUrls.slice(0, 1) : mediaUrls.filter(u => !isVideoUrl(u)).slice(0, 4);
  const mediaIds: string[] = [];
  for (const url of toUpload) {
    try {
      const buffer = await downloadMedia(url);
      const mediaType = mimeTypeFromUrl(url);
      const category = mediaType.startsWith('video/') ? 'tweet_video' : mediaType === 'image/gif' ? 'tweet_gif' : 'tweet_image';
      const mediaId = await twitterClient.v2.uploadMedia(buffer, { media_type: mediaType as any, media_category: category });
      mediaIds.push(mediaId);
    } catch (err: any) {
      const errorDetails = err.data ? JSON.stringify(err.data) : (err.message || err);
      console.error('[PUBLISHER] Failed to upload media to Twitter:', errorDetails);
      throw new Error('Twitter API rejected media upload: ' + errorDetails);
    }
  }

  const tweetBody: any = { text: post.body.slice(0, 280) };
  if (mediaIds.length > 0) tweetBody.media = { media_ids: mediaIds };

  const pollOptions = (opts.poll?.options || []).map((o: string) => (o || '').trim()).filter(Boolean);
  if (pollOptions.length >= 2) {
    if (mediaIds.length > 0) throw new Error('X does not allow polls together with media. Remove the media or the poll.');
    tweetBody.poll = { options: pollOptions.slice(0, 4), duration_minutes: Math.min(Math.max(Number(opts.poll.duration) || 1, 1), 7) * 24 * 60 };
  }

  const replySettings = mapTwitterReplySettings(opts.replySettings);
  if (replySettings) tweetBody.reply_settings = replySettings;

  let tweetId: string;
  try {
    const { data } = await twitterClient.v2.tweet(tweetBody);
    tweetId = data.id;
  } catch (err: any) {
    const errorDetails = err.data ? JSON.stringify(err.data) : (err.message || err);
    console.error('[PUBLISHER] Failed to post tweet:', errorDetails);
    throw new Error('Twitter API rejected tweet: ' + errorDetails);
  }

  // Thread continuation: each extra tweet replies to the previous one.
  const threadTweets: string[] = opts.contentType === 'Thread' && Array.isArray(opts.thread)
    ? opts.thread.map((t: string) => (t || '').trim()).filter(Boolean)
    : [];
  let lastId = tweetId;
  for (const text of threadTweets) {
    try {
      const { data } = await twitterClient.v2.tweet({ text: text.slice(0, 280), reply: { in_reply_to_tweet_id: lastId } });
      lastId = data.id;
    } catch (e: any) {
      throw new PartialPublishError('Thread continuation failed: ' + (e.data ? JSON.stringify(e.data) : e.message), tweetId);
    }
  }

  if (post.first_comment) {
    await sleep(COMMENT_DELAY_MS);
    try {
      await twitterClient.v2.tweet({
        text: post.first_comment.slice(0, 280),
        reply: { in_reply_to_tweet_id: lastId }
      });
    } catch (e: any) {
      throw new PartialPublishError('First comment failed: ' + (e.message || JSON.stringify(e)), tweetId);
    }
  }

  return tweetId;
}

// ─── TIKTOK ───────────────────────────────────────────────────────────────────
// Content Posting API (Direct Post) with FILE_UPLOAD. Unaudited TikTok apps can
// only post with privacy SELF_ONLY; creator_info tells us what is allowed.

async function publishToTikTok(account: any, post: any): Promise<string> {
  const mediaUrls: string[] = post.media_urls || [];
  const videoUrl = mediaUrls.find(isVideoUrl);
  if (!videoUrl) throw new Error('TikTok requires a video. Upload a video file to publish to TikTok.');

  const token = await getFreshAccessToken(account);
  const opts = post.platform_options;
  const apiHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };

  const creatorRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', { method: 'POST', headers: apiHeaders });
  const creator = await readJson(creatorRes);
  if (creator.error?.code && creator.error.code !== 'ok') throw new Error(`TikTok: ${creator.error.message || creator.error.code}`);

  const allowedPrivacy: string[] = creator.data?.privacy_level_options || [];
  const privacy = opts.privacy || 'PUBLIC_TO_EVERYONE';
  if (allowedPrivacy.length && !allowedPrivacy.includes(privacy)) {
    throw new Error(`TikTok does not allow privacy "${privacy}" for this account/app. Allowed: ${allowedPrivacy.join(', ')}`);
  }

  const buffer = await downloadMedia(videoUrl);
  const { chunkSize, totalChunks } = tiktokChunkPlan(buffer.length);

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify({
      post_info: {
        title: post.body.slice(0, 2200),
        privacy_level: privacy,
        disable_comment: opts.allowComments === false,
        disable_duet: opts.allowDuet === false,
        disable_stitch: opts.allowStitch === false,
      },
      source_info: { source: 'FILE_UPLOAD', video_size: buffer.length, chunk_size: chunkSize, total_chunk_count: totalChunks },
    }),
  });
  const init = await readJson(initRes);
  if (!initRes.ok || (init.error?.code && init.error.code !== 'ok')) {
    throw new Error(`TikTok init failed: ${init.error?.message || init.error?.code || initRes.status}`);
  }
  const { publish_id: publishId, upload_url: uploadUrl } = init.data;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = i === totalChunks - 1 ? buffer.length : start + chunkSize;
    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeTypeFromUrl(videoUrl),
        'Content-Length': String(end - start),
        'Content-Range': `bytes ${start}-${end - 1}/${buffer.length}`,
      },
      body: buffer.subarray(start, end),
    });
    if (!chunkRes.ok) throw new Error(`TikTok upload failed on chunk ${i + 1}/${totalChunks} (${chunkRes.status})`);
  }

  // Processing is async; wait up to ~2 minutes for a final status.
  for (let attempt = 0; attempt < 24; attempt++) {
    await sleep(5000);
    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST', headers: apiHeaders, body: JSON.stringify({ publish_id: publishId }),
    });
    const status = await readJson(statusRes);
    const state = status.data?.status;
    if (state === 'PUBLISH_COMPLETE') return String(status.data?.publicaly_available_post_id?.[0] || publishId);
    if (state === 'FAILED') throw new Error(`TikTok publish failed: ${status.data?.fail_reason || 'unknown reason'}`);
  }
  // Still processing — TikTok will finish it on its side.
  return publishId;
}

// ─── THREADS ──────────────────────────────────────────────────────────────────

async function threadsPost(path: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`https://graph.threads.net/v1.0/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (data.error || !res.ok || !data.id) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

async function waitForThreadsContainer(creationId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`https://graph.threads.net/v1.0/${creationId}?fields=status,error_message&access_token=${token}`);
    const data = await res.json() as any;
    if (data.status === 'FINISHED' || data.status === 'PUBLISHED') return;
    if (data.status === 'ERROR' || data.status === 'EXPIRED') {
      throw new Error(`Threads media processing failed: ${data.error_message || data.status}`);
    }
    await sleep(5000);
  }
  throw new Error('Timeout waiting for Threads media processing');
}

async function publishToThreads(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const threadsUserId = account.account_id;
  const mediaUrls: string[] = post.media_urls || [];
  const replyControl = mapThreadsReplyControl(post.platform_options.replySettings);

  let creationId: string;
  if (mediaUrls.length > 1) {
    const itemIds: string[] = [];
    for (const url of mediaUrls.slice(0, 20)) {
      const video = isVideoUrl(url);
      const item = await threadsPost(`${threadsUserId}/threads`, {
        media_type: video ? 'VIDEO' : 'IMAGE',
        [video ? 'video_url' : 'image_url']: url,
        is_carousel_item: true,
        access_token: token,
      });
      await waitForThreadsContainer(item.id, token);
      itemIds.push(item.id);
    }
    const carousel = await threadsPost(`${threadsUserId}/threads`, {
      media_type: 'CAROUSEL', children: itemIds.join(','), text: post.body, reply_control: replyControl, access_token: token,
    });
    creationId = carousel.id;
  } else if (mediaUrls.length === 1) {
    const video = isVideoUrl(mediaUrls[0]);
    const data = await threadsPost(`${threadsUserId}/threads`, {
      media_type: video ? 'VIDEO' : 'IMAGE',
      [video ? 'video_url' : 'image_url']: mediaUrls[0],
      text: post.body, reply_control: replyControl, access_token: token,
    });
    creationId = data.id;
  } else {
    const data = await threadsPost(`${threadsUserId}/threads`, {
      media_type: 'TEXT', text: post.body, reply_control: replyControl, access_token: token,
    });
    creationId = data.id;
  }

  await waitForThreadsContainer(creationId, token);
  const pubData = await threadsPost(`${threadsUserId}/threads_publish`, { creation_id: creationId, access_token: token });

  // First comment: post a reply thread after a delay so the main post is indexed
  if (post.first_comment) {
    await sleep(COMMENT_DELAY_MS);
    try {
      const reply = await threadsPost(`${threadsUserId}/threads`, {
        media_type: 'TEXT', text: post.first_comment, reply_to_id: pubData.id, access_token: token,
      });
      await waitForThreadsContainer(reply.id, token);
      await threadsPost(`${threadsUserId}/threads_publish`, { creation_id: reply.id, access_token: token });
    } catch (e: any) {
      throw new PartialPublishError('First comment failed: ' + e.message, pubData.id);
    }
  }

  return pubData.id;
}

// ─── PLATFORM DISPATCH ────────────────────────────────────────────────────────
async function publishToAccount(target: any, post: any): Promise<string> {
  const platformOptions = parseJsonObject(target.platform_options);

  const postForAccount = {
    ...post,
    body: target.custom_body || post.body || '',
    first_comment: target.first_comment || post.first_comment || null,
    media_urls: platformOptions.media_urls?.length ? platformOptions.media_urls : post.media_urls,
    platform_options: platformOptions,
  };

  switch (target.platform) {
    case 'linkedin':  return publishToLinkedIn(target, postForAccount);
    case 'facebook':  return publishToFacebook(target, postForAccount);
    case 'instagram': return publishToInstagram(target, postForAccount);
    case 'youtube':   return publishToYouTube(target, postForAccount);
    case 'twitter':   return publishToTwitter(target, postForAccount);
    case 'tiktok':    return publishToTikTok(target, postForAccount);
    case 'threads':   return publishToThreads(target, postForAccount);
    default:          throw new Error(`Unsupported platform: ${target.platform}`);
  }
}

// ─── MAIN PUBLISH FUNCTION ────────────────────────────────────────────────────
/**
 * Atomically claims the post (status → 'publishing') so the cron and "Post Now"
 * can never publish the same post twice, then publishes every pending target.
 * Returns the final post status, or null if the post could not be claimed.
 */
export async function publishPost(postId: string, claimableStatuses: string[] = ['scheduled']): Promise<string | null> {
  const placeholders = claimableStatuses.map(() => '?').join(', ');
  const post = await db.get<any>(
    `UPDATE social_posts SET status = 'publishing', updated_at = NOW()
     WHERE id = ? AND status IN (${placeholders})
     RETURNING *`,
    postId, ...claimableStatuses
  );
  if (!post) return null;

  if (!Array.isArray(post.media_urls)) {
    try {
      post.media_urls = post.media_urls ? JSON.parse(post.media_urls) : [];
      if (!Array.isArray(post.media_urls)) post.media_urls = [];
    } catch {
      post.media_urls = [];
    }
  }

  const targets = await db.all<any>(`
    SELECT t.id, t.platform, t.status, t.custom_body, t.first_comment, t.platform_options,
           a.id AS social_account_id, a.account_id, a.access_token, a.refresh_token,
           a.token_expires_at, a.page_id, a.channel_id, a.username
    FROM social_post_targets t
    JOIN social_accounts a ON a.id = t.account_id
    WHERE t.post_id = ?
  `, postId);

  if (!targets.length) {
    await db.run(
      `UPDATE social_posts SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
      'No connected accounts selected for this post (they may have been disconnected).', postId
    );
    return 'failed';
  }

  const pending = targets.filter(t => t.status === 'pending');

  // Targets are independent, so publish them in parallel.
  const results = await Promise.all(pending.map(async (target) => {
    try {
      const platformPostId = await publishToAccount(target, post);
      await db.run(`
        UPDATE social_post_targets SET status = 'published', platform_post_id = ?, published_at = NOW(), error_message = NULL, error_code = NULL WHERE id = ?
      `, platformPostId, target.id);
      return { ok: true as const };
    } catch (err: any) {
      if (err.name === 'PartialPublishError') {
        const pErr = err as PartialPublishError;
        console.warn(`[SOCIAL_PUBLISHER] ${target.platform} partial success:`, err.message);
        await db.run(`UPDATE social_post_targets SET status = 'published_partial', platform_post_id = ?, published_at = NOW(), error_message = ? WHERE id = ?`, pErr.platformPostId, pErr.message, target.id);
        return { ok: false as const, partial: true, message: pErr.message };
      }
      console.error(`[SOCIAL_PUBLISHER] ${target.platform} failed:`, err.message);
      const errCode = JSON.stringify({ message: err.message, stack: err.stack?.slice(0, 600), response: err.response?.data ?? null });
      await db.run(`UPDATE social_post_targets SET status = 'failed', error_message = ?, error_code = ? WHERE id = ?`, err.message, errCode, target.id);
      return { ok: false as const, partial: false, message: `${target.platform}: ${err.message}`, code: errCode };
    }
  }));

  const hardFailure = results.find(r => !r.ok && !r.partial);
  const partialFailure = results.find(r => !r.ok && r.partial);

  let newStatus: string;
  if (hardFailure) {
    newStatus = 'failed';
    await db.run(`UPDATE social_posts SET status = ?, error_message = ?, error_code = ?, updated_at = NOW() WHERE id = ?`,
      newStatus, (hardFailure as any).message, (hardFailure as any).code ?? null, postId);
  } else if (partialFailure) {
    newStatus = 'published_partial';
    await db.run(`UPDATE social_posts SET status = ?, published_at = NOW(), error_message = ?, error_code = 'PARTIAL_PUBLISH', updated_at = NOW() WHERE id = ?`,
      newStatus, (partialFailure as any).message, postId);
  } else {
    newStatus = 'published';
    await db.run(`UPDATE social_posts SET status = 'published', published_at = NOW(), error_message = NULL, error_code = NULL, updated_at = NOW() WHERE id = ?`, postId);
  }
  return newStatus;
}

// ─── CRON SCHEDULER ───────────────────────────────────────────────────────────
let cronRunning = false;

export async function runSocialPublisherCron(): Promise<void> {
  // A publish can take minutes (video processing); never overlap runs.
  if (cronRunning) return;
  cronRunning = true;
  try {
    // 1. Refresh expiring Threads tokens (within 15 days)
    try {
      const expiringThreads = await db.all<any>(`
        SELECT id, access_token
        FROM social_accounts
        WHERE platform = 'threads'
          AND token_expires_at IS NOT NULL
          AND token_expires_at < NOW() + INTERVAL '15 days'
      `);

      for (const account of expiringThreads) {
        try {
          const token = decryptToken(account.access_token);
          const res = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`);
          const data = await res.json() as any;
          if (data.access_token) {
            const newExpires = new Date(Date.now() + (data.expires_in || 60 * 60 * 24 * 60) * 1000).toISOString();
            const encryptedNewToken = encryptToken(data.access_token);
            await db.run(`
              UPDATE social_accounts
              SET access_token = ?, token_expires_at = ?, updated_at = NOW()
              WHERE id = ?
            `, encryptedNewToken, newExpires, account.id);
            console.log(`[SOCIAL_CRON] Refreshed Threads token for account ${account.id}`);
          }
        } catch (e: any) {
          console.warn(`[SOCIAL_CRON] Failed to refresh Threads token for account ${account.id}:`, e.message);
        }
      }
    } catch (err: any) {
      console.error('[SOCIAL_CRON] Threads token refresh error:', err.message);
    }

    // 2. Posts left in 'publishing' by a crash/redeploy. They are not retried
    // automatically because a target may have gone out before the crash.
    try {
      await db.run(`
        UPDATE social_posts
        SET status = 'failed', updated_at = NOW(),
            error_message = 'Publishing was interrupted. Check the platforms before retrying to avoid duplicates.'
        WHERE status = 'publishing' AND updated_at < NOW() - INTERVAL '30 minutes'
      `);
      await db.run(`
        UPDATE social_post_targets t SET status = 'failed', error_message = 'Publishing was interrupted'
        FROM social_posts p
        WHERE t.post_id = p.id AND p.status = 'failed' AND t.status = 'pending'
          AND p.error_message LIKE 'Publishing was interrupted%'
      `);
    } catch (err: any) {
      console.error('[SOCIAL_CRON] Stuck post recovery error:', err.message);
    }

    // 3. Publish due posts
    const duePosts = await db.all<any>(`
      SELECT id FROM social_posts
      WHERE status = 'scheduled' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 20
    `);

    for (const post of duePosts) {
      await publishPost(post.id).catch(err =>
        console.error('[SOCIAL_CRON] publish error for post', post.id, err.message)
      );
    }
  } catch (err: any) {
    console.error('[SOCIAL_CRON] error:', err.message);
  } finally {
    cronRunning = false;
  }
}
