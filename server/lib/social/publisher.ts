/**
 * Social Studio Publisher
 * Publishes a social_post to all its pending targets.
 * Called by the cron scheduler and by the "Post Now" endpoint.
 */
import db from '../../db.js';
import { decryptToken } from '../outreach/encrypt.js';
import fetch from 'node-fetch';
import FormData from 'form-data';

// ─── PLATFORM PUBLISHERS ──────────────────────────────────────────────────────

async function publishToLinkedIn(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const body: any = {
    author: `urn:li:person:${account.account_id}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: post.body },
        shareMediaCategory: post.link_url ? 'ARTICLE' : 'NONE',
        ...(post.link_url ? {
          media: [{
            status: 'READY',
            originalUrl: post.link_url,
            title: { text: post.link_title || post.link_url },
            description: { text: post.link_description || '' },
          }]
        } : {})
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data.id || 'linkedin_post';
}

async function publishToFacebook(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const pageId = account.page_id || account.account_id;

  const postType = (post.link_title || 'POST').toUpperCase();
  const mediaUrls = post.media_urls || [];
  
  if (mediaUrls.length > 1 && postType === 'POST') {
    // CAROUSEL
    const attachedMedia = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const isVideo = url.match(/\\.(mp4|mov)$/i);
      if (isVideo) throw new Error('Facebook currently does not support mixed video/image carousels via this API.');
      
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          published: false,
          access_token: token
        }),
      });
      const data = await res.json() as any;
      if (data.error) throw new Error(data.error.message);
      attachedMedia.push({ media_fbid: data.id });
    }

    const feedRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: post.body,
        attached_media: attachedMedia,
        access_token: token
      }),
    });
    const feedData = await feedRes.json() as any;
    if (feedData.error) throw new Error(feedData.error.message);
    return feedData.id;

  } else if (mediaUrls.length > 0) {
    // SINGLE MEDIA (Story, Reel, Post)
    const url = mediaUrls[0];
    const isVideo = url.match(/\\.(mp4|mov)$/i);
    
    if (postType === 'STORY') {
      const endpoint = isVideo ? `https://graph.facebook.com/v19.0/${pageId}/video_stories` : `https://graph.facebook.com/v19.0/${pageId}/photo_stories`;
      const body: any = { access_token: token };
      if (isVideo) body.video_url = url;
      else body.photo_url = url;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (data.error) throw new Error(data.error.message);
      return data.id || 'fb_story';
      
    } else {
      // POST or REEL
      const endpoint = isVideo ? `https://graph.facebook.com/v19.0/${pageId}/videos` : `https://graph.facebook.com/v19.0/${pageId}/photos`;
      const body: any = { access_token: token };
      
      if (isVideo) {
        body.file_url = url;
        body.description = post.body;
      } else {
        body.url = url;
        body.caption = post.body;
      }
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as any;
      if (data.error) throw new Error(data.error.message);
      return data.id;
    }
    
  } else {
    // TEXT / LINK ONLY
    const body: any = { message: post.body, access_token: token };
    if (post.link_url) body.link = post.link_url;

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.error.message);
    return data.id;
  }
}

async function checkIgMediaStatus(creationId: string, token: string): Promise<void> {
  let attempts = 0;
  while (attempts < 20) { // Try for ~100 seconds
    const res = await fetch(`https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token}`);
    const data = await res.json() as any;
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error('Instagram media processing failed');
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  throw new Error('Instagram media processing timed out');
}

async function publishToInstagram(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const igUserId = account.account_id; // the instagram_business_account id

  // post.media_urls usually contains an array of URLs. 
  // We'll read post.instagram_type (which might be passed in post.link_description or we infer it).
  // Wait, I should add a metadata field to social_posts, or just pass it in payload.
  // For now, let's infer or use post.link_title as the type if we don't have a dedicated column.
  // We'll use post.link_title as the "post_type" for Instagram (POST, REEL, STORY).
  const postType = (post.link_title || 'POST').toUpperCase();
  const mediaUrls = post.media_urls || [];
  
  if (mediaUrls.length === 0) {
    throw new Error('Instagram requires at least one image or video');
  }

  let creationId = '';

  if (mediaUrls.length > 1 && postType === 'POST') {
    // CAROUSEL
    const childrenIds = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const isVideo = url.match(/\\.(mp4|mov)$/i);
      const childBody: any = {
        access_token: token,
        is_carousel_item: 'true'
      };
      if (isVideo) {
        childBody.video_url = url;
        childBody.media_type = 'VIDEO';
      } else {
        childBody.image_url = url;
      }
      
      const res = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childBody),
      });
      const data = await res.json() as any;
      if (data.error) throw new Error(data.error.message);
      
      if (isVideo) {
        await checkIgMediaStatus(data.id, token);
      }
      childrenIds.push(data.id);
    }

    const carRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        caption: post.body
      }),
    });
    const carData = await carRes.json() as any;
    if (carData.error) throw new Error(carData.error.message);
    creationId = carData.id;
    
  } else {
    // SINGLE MEDIA
    const url = mediaUrls[0];
    const isVideo = url.match(/\\.(mp4|mov)$/i);
    const body: any = { access_token: token };
    
    if (postType === 'STORY') {
      body.media_type = 'STORIES';
      if (isVideo) body.video_url = url;
      else body.image_url = url;
    } else if (postType === 'REEL') {
      body.media_type = 'REELS';
      body.video_url = url;
      body.caption = post.body;
      if (!isVideo) throw new Error('Reels must be videos');
    } else {
      // STANDARD POST
      if (isVideo) {
        body.media_type = 'REELS'; // All IG videos are now technically reels, or we use VIDEO for older standard
        body.video_url = url;
        body.caption = post.body;
      } else {
        body.image_url = url;
        body.caption = post.body;
      }
    }

    const res = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.error.message);
    creationId = data.id;

    if (isVideo) {
      await checkIgMediaStatus(creationId, token);
    }
  }

  // PUBLISH
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: token,
      creation_id: creationId
    }),
  });
  const pubData = await pubRes.json() as any;
  if (pubData.error) throw new Error(pubData.error.message);
  
  return pubData.id;
}

async function publishToYouTube(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  // For community posts (text)
  const res = await fetch('https://www.googleapis.com/youtube/v3/communityPosts?part=snippet', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: { postType: 'textPost', textOriginalPost: { text: post.body } }
    }),
  });
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data.id || 'yt_post';
}

async function publishToTwitter(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: post.body.slice(0, 280) }),
  });
  const data = await res.json() as any;
  if (data.errors || data.error) throw new Error(data.errors?.[0]?.message || data.detail || 'Twitter error');
  return data.data?.id || 'tweet';
}

async function publishToTikTok(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  // TikTok requires video — for text we skip gracefully
  throw new Error('TikTok requires a video. Upload a video file to publish to TikTok.');
}

// ─── PLATFORM DISPATCH ────────────────────────────────────────────────────────
async function publishToAccount(account: any, post: any): Promise<string> {
  switch (account.platform) {
    case 'linkedin':  return publishToLinkedIn(account, post);
    case 'facebook':  return publishToFacebook(account, post);
    case 'instagram': return publishToInstagram(account, post);
    case 'youtube':   return publishToYouTube(account, post);
    case 'twitter':   return publishToTwitter(account, post);
    case 'tiktok':    return publishToTikTok(account, post);
    default:          throw new Error(`Unsupported platform: ${account.platform}`);
  }
}

// ─── MAIN PUBLISH FUNCTION ────────────────────────────────────────────────────
export async function publishPost(postId: string): Promise<void> {
  const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, postId);
  if (!post) return;

  const targets = await db.all<any>(`
    SELECT t.*, a.access_token, a.refresh_token, a.account_id, a.page_id, a.channel_id, a.username
    FROM social_post_targets t
    JOIN social_accounts a ON a.id = t.account_id
    WHERE t.post_id = ? AND t.status = 'pending'
  `, postId);

  if (!targets.length) {
    await db.run(`UPDATE social_posts SET status = 'published', published_at = NOW() WHERE id = ?`, postId);
    return;
  }

  await db.run(`UPDATE social_posts SET status = 'publishing' WHERE id = ?`, postId);

  let allPublished = true;
  for (const target of targets) {
    try {
      const platformPostId = await publishToAccount(target, post);
      await db.run(`
        UPDATE social_post_targets SET status = 'published', platform_post_id = ?, published_at = NOW() WHERE id = ?
      `, platformPostId, target.id);
    } catch (err: any) {
      console.error(`[SOCIAL_PUBLISHER] ${target.platform} failed:`, err.message);
      await db.run(`UPDATE social_post_targets SET status = 'failed', error_message = ? WHERE id = ?`, err.message, target.id);
      allPublished = false;
    }
  }

  const newStatus = allPublished ? 'published' : 'failed';
  await db.run(`
    UPDATE social_posts SET status = ?, published_at = ${allPublished ? 'NOW()' : 'NULL'} WHERE id = ?
  `, newStatus, postId);
}

// ─── CRON SCHEDULER ───────────────────────────────────────────────────────────
export async function runSocialPublisherCron(): Promise<void> {
  try {
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
  }
}
