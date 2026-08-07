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
  const authorUrn = `urn:li:person:${account.account_id}`;
  const mediaUrls = post.media_urls || [];
  
  const headers = { 
    Authorization: `Bearer ${token}`, 
    'Content-Type': 'application/json',
    'LinkedIn-Version': '2024-01'
  };

  let content: any = undefined;

  if (mediaUrls.length > 0) {
    const isVideo = mediaUrls[0].match(/\\.(mp4|mov)$/i);
    const mediaUrns = [];

    for (const url of mediaUrls.slice(0, 9)) {
      // 1. Download file
      const fileRes = await fetch(url);
      const arrayBuffer = await fileRes.arrayBuffer();
      
      let initUrl = 'https://api.linkedin.com/rest/images?action=initializeUpload';
      let initBody: any = { initializeUploadRequest: { owner: authorUrn } };
      
      if (isVideo) {
        initUrl = 'https://api.linkedin.com/rest/videos?action=initializeUpload';
        initBody.initializeUploadRequest.fileSizeBytes = arrayBuffer.byteLength;
      }

      // 2. Initialize Upload
      const initReq = await fetch(initUrl, { method: 'POST', headers, body: JSON.stringify(initBody) });
      const initData = await initReq.json() as any;
      if (!initReq.ok) throw new Error(`LinkedIn init error: ${initData.message || JSON.stringify(initData)}`);
      
      const uploadUrl = initData.value.uploadUrl;
      const mediaUrn = isVideo ? initData.value.video : initData.value.image;

      // 3. Upload Binary
      const uploadReq = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'Authorization': `Bearer ${token}` },
        body: arrayBuffer
      });
      if (!uploadReq.ok) throw new Error('Failed to upload media to LinkedIn S3 bucket');
      
      mediaUrns.push(mediaUrn);
    }

    if (isVideo) {
      content = { media: { id: mediaUrns[0] } };
    } else if (mediaUrns.length > 1) {
      content = { multiImage: { images: mediaUrns.map(id => ({ id })) } };
    } else {
      content = { media: { id: mediaUrns[0] } };
    }
  } else if (post.link_url) {
    content = {
      article: {
        source: post.link_url,
        title: post.link_title || post.link_url,
        description: post.link_description || ''
      }
    };
  }

  const body: any = {
    author: authorUrn,
    commentary: post.body,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
  };
  
  if (content) {
    body.content = content;
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  
  const urn = res.headers.get('x-restli-id') || (data && data.id) || 'linkedin_post';

  if (post.first_comment && urn && urn !== 'linkedin_post') {
    try {
      await fetch(`https://api.linkedin.com/rest/socialActions/${urn}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actor: authorUrn,
          object: urn,
          message: { text: post.first_comment }
        }),
      });
    } catch (e: any) {
      console.error('[PUBLISHER] LinkedIn first comment failed', e.message);
    }
  }

  return urn;
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
    
    if (post.first_comment && feedData.id) {
      try {
        await fetch(`https://graph.facebook.com/v19.0/${feedData.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: post.first_comment, access_token: token }),
        });
      } catch (e: any) {
        console.error('[PUBLISHER] Facebook first comment failed', e.message);
      }
    }
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

      if (post.first_comment && data.id) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${data.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: post.first_comment, access_token: token }),
          });
        } catch (e: any) {
          console.error('[PUBLISHER] Facebook first comment failed', e.message);
        }
      }

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

    if (post.first_comment && data.id) {
      try {
        await fetch(`https://graph.facebook.com/v19.0/${data.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: post.first_comment, access_token: token }),
        });
      } catch (e: any) {
        console.error('[PUBLISHER] Facebook first comment failed', e.message);
      }
    }

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
  
  if (post.first_comment && pubData.id) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${pubData.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: post.first_comment, access_token: token }),
      });
    } catch (e: any) {
      console.error('[PUBLISHER] Instagram first comment failed', e.message);
    }
  }

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
  
  const tweetId = data.data?.id || 'tweet';

  if (post.first_comment && data.data?.id) {
    try {
      await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: post.first_comment.slice(0, 280),
          reply: { in_reply_to_tweet_id: data.data.id }
        }),
      });
    } catch (e: any) {
      console.error('[PUBLISHER] Twitter first comment failed', e.message);
    }
  }

  return tweetId;
}

async function publishToTikTok(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  // TikTok requires video — for text we skip gracefully
  throw new Error('TikTok requires a video. Upload a video file to publish to TikTok.');
}

async function publishToThreads(account: any, post: any): Promise<string> {
  const token = decryptToken(account.access_token);
  const mediaUrls = post.media_urls || [];
  
  let creationId: string;
  let isVideo = false;

  if (mediaUrls.length > 1) {
    const itemIds = [];
    for (const url of mediaUrls.slice(0, 10)) {
      const isItemVideo = url.match(/\\.(mp4|mov)$/i);
      if (isItemVideo) isVideo = true;
      const res = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: isItemVideo ? 'VIDEO' : 'IMAGE',
          [isItemVideo ? 'video_url' : 'image_url']: url,
          is_carousel_item: true,
          access_token: token
        })
      });
      const data = await res.json() as any;
      if (data.error || !res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      itemIds.push(data.id);
    }
    
    const carouselRes = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: itemIds.join(','),
        text: post.body,
        access_token: token
      })
    });
    const carouselData = await carouselRes.json() as any;
    if (carouselData.error || !carouselRes.ok) throw new Error(carouselData.error?.message || JSON.stringify(carouselData));
    creationId = carouselData.id;

  } else if (mediaUrls.length === 1) {
    const url = mediaUrls[0];
    isVideo = !!url.match(/\\.(mp4|mov)$/i);
    const res = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: isVideo ? 'VIDEO' : 'IMAGE',
        [isVideo ? 'video_url' : 'image_url']: url,
        text: post.body,
        access_token: token
      })
    });
    const data = await res.json() as any;
    if (data.error || !res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    creationId = data.id;

  } else {
    const res = await fetch(`https://graph.threads.net/v1.0/me/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: post.body,
        access_token: token
      })
    });
    const data = await res.json() as any;
    if (data.error || !res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    creationId = data.id;
  }

  if (isVideo) {
    let attempts = 0;
    while (attempts < 15) {
      const statusRes = await fetch(`https://graph.threads.net/v1.0/${creationId}?fields=status,error_message&access_token=${token}`);
      const statusData = await statusRes.json() as any;
      if (statusData.status === 'FINISHED') break;
      if (statusData.status === 'ERROR') throw new Error(`Threads video processing failed: ${statusData.error_message || JSON.stringify(statusData)}`);
      attempts++;
      await new Promise(r => setTimeout(r, 5000));
    }
    if (attempts >= 15) throw new Error('Timeout waiting for Threads video processing');
  }

  const pubRes = await fetch(`https://graph.threads.net/v1.0/me/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: token
    })
  });
  const pubData = await pubRes.json() as any;
  if (pubData.error || !pubRes.ok) throw new Error(pubData.error?.message || JSON.stringify(pubData));
  return pubData.id;
}

// ─── PLATFORM DISPATCH ────────────────────────────────────────────────────────
async function publishToAccount(account: any, post: any): Promise<string> {
  const postForAccount = {
    ...post,
    body: account.custom_body || post.body
  };
  
  switch (account.platform) {
    case 'linkedin':  return publishToLinkedIn(account, postForAccount);
    case 'facebook':  return publishToFacebook(account, postForAccount);
    case 'instagram': return publishToInstagram(account, postForAccount);
    case 'youtube':   return publishToYouTube(account, postForAccount);
    case 'twitter':   return publishToTwitter(account, postForAccount);
    case 'tiktok':    return publishToTikTok(account, postForAccount);
    case 'threads':   return publishToThreads(account, postForAccount);
    default:          throw new Error(`Unsupported platform: ${account.platform}`);
  }
}

// ─── MAIN PUBLISH FUNCTION ────────────────────────────────────────────────────
export async function publishPost(postId: string): Promise<void> {
  const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, postId);
  if (!post) return;

  if (!Array.isArray(post.media_urls)) {
    try {
      post.media_urls = post.media_urls ? JSON.parse(post.media_urls) : [];
      if (!Array.isArray(post.media_urls)) post.media_urls = [];
    } catch(e) {
      post.media_urls = [];
    }
  }

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
  let firstError: { message: string; code: string } | null = null;
  for (const target of targets) {
    try {
      const platformPostId = await publishToAccount(target, post);
      await db.run(`
        UPDATE social_post_targets SET status = 'published', platform_post_id = ?, published_at = NOW() WHERE id = ?
      `, platformPostId, target.id);
    } catch (err: any) {
      console.error(`[SOCIAL_PUBLISHER] ${target.platform} failed:`, err.message);
      const errCode = JSON.stringify({ message: err.message, stack: err.stack?.slice(0, 600), response: err.response?.data ?? null });
      await db.run(`UPDATE social_post_targets SET status = 'failed', error_message = ?, error_code = ? WHERE id = ?`, err.message, errCode, target.id);
      if (!firstError) firstError = { message: err.message, code: errCode };
      allPublished = false;
    }
  }

  const newStatus = allPublished ? 'published' : 'failed';
  if (allPublished) {
    await db.run(`UPDATE social_posts SET status = 'published', published_at = NOW(), error_message = NULL, error_code = NULL WHERE id = ?`, postId);
  } else {
    await db.run(`
      UPDATE social_posts SET status = ?, error_message = ?, error_code = ? WHERE id = ?
    `, newStatus, firstError?.message ?? null, firstError?.code ?? null, postId);
  }
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
