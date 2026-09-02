import express, { Router } from 'express';
import { AuthRequest } from '../../middleware.js';
import db from '../../db.js';
import { encryptToken } from '../../lib/outreach/encrypt.js';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import redis from '../../redis.js';
import { TwitterApi } from 'twitter-api-v2';

const router = Router();

// ─── PLATFORM CONFIGS ─────────────────────────────────────────────────────────
const getBackendUrl = () => {
  let url = process.env.APP_URL;
  if (!url && process.env.RAILWAY_PUBLIC_DOMAIN) {
    url = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (!url) {
    url = process.env.NODE_ENV === 'production' 
      ? 'https://vult-intel-backend-production.up.railway.app' 
      : 'http://localhost:3001';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
};

const getFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VITE_APP_URL;
  if (!url) {
    url = process.env.NODE_ENV === 'production' ? 'https://vultintel.com' : 'http://localhost:5173';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, '');
};

const PLATFORMS: Record<string, {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  userInfoUrl?: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}> = {
  linkedin: {
    name: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scopes: 'openid profile email w_member_social',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
  },
  facebook: {
    name: 'Facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,picture',
    scopes: 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_read_user_content,pages_manage_ads,pages_messaging,pages_manage_posts,public_profile',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  youtube: {
    name: 'YouTube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile openid',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  twitter: {
    name: 'Twitter/X',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scopes: 'tweet.read tweet.write users.read offline.access',
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
  },
  tiktok: {
    name: 'TikTok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
    scopes: 'user.info.basic,video.publish,video.upload',
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
  },
  instagram_dm: {
    name: 'Instagram DM',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,picture',
    scopes: 'instagram_manage_messages,pages_manage_metadata,pages_read_engagement,pages_show_list,public_profile',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  whatsapp: {
    name: 'WhatsApp Business',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,picture',
    scopes: 'whatsapp_business_management,whatsapp_business_messaging',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  instagram: {
    name: 'Instagram',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,picture',
    scopes: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
  },
  threads: {
    name: 'Threads',
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    userInfoUrl: 'https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url',
    scopes: 'threads_basic,threads_content_publish',
    clientIdEnv: 'THREADS_APP_ID',
    clientSecretEnv: 'THREADS_APP_SECRET',
  }
};

// ─── PROVIDERS STATUS ──────────────────────────────────────────────────────────
// GET /api/social/auth/providers/status
router.get('/providers/status', (req, res) => {
  const status: Record<string, boolean> = {};
  for (const [key, config] of Object.entries(PLATFORMS)) {
    status[key] = !!(process.env[config.clientIdEnv] && process.env[config.clientSecretEnv]);
  }
  res.json(status);
});

// ─── OAUTH INITIATION ─────────────────────────────────────────────────────────
// GET /api/social/auth/:platform?project_id=...&user_id=...
router.get('/:platform', async (req: AuthRequest, res) => {
  const { platform } = req.params;
  const userId = req.user?.uid || (req.query.user_id as string);
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  const source = req.query.source as string || 'social-studio';

  const config = PLATFORMS[platform];
  if (!config) return res.status(400).json({ error: `Unknown platform: ${platform}` });
  if (!userId) return res.status(401).json({ error: 'Auth required' });

  const clientId = process.env[config.clientIdEnv]?.trim();
  if (!clientId) {
    return res.status(503).json({ 
      error: `${config.name} OAuth not configured yet.`,
      setup_required: true,
      env_var: config.clientIdEnv
    });
  }

  const authSessionId = uuidv4();
  let codeChallenge: string | undefined;
  let codeChallengeMethod: string | undefined;

  const redirectUri = `${getBackendUrl()}/api/social/auth/${platform}/callback`;

  if (platform === 'twitter') {
    const client = new TwitterApi({ appKey: clientId, appSecret: process.env[config.clientSecretEnv]! });
    const authLink = await client.generateAuthLink(redirectUri, { linkMode: 'authorize' });
    await redis.setex(`oauth:twitter:${authLink.oauth_token}`, 600, JSON.stringify({
      oauth_token_secret: authLink.oauth_token_secret,
      pId, userId, source
    }));
    return res.redirect(authLink.url);
  }

  const state = Buffer.from(JSON.stringify({ pId, userId, platform, source, authSessionId })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: config.scopes,
    state,
    ...(platform === 'youtube' ? { access_type: 'offline', prompt: 'consent' } : {}),
  });

  if (platform === 'tiktok') {
    params.set('client_key', clientId);
  }

  res.redirect(`${config.authUrl}?${params.toString()}`);
});

// ─── OAUTH CALLBACK ───────────────────────────────────────────────────────────
router.get('/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query as Record<string, string>;

  // Intercept Meta Webhook verification if hub.mode is present
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  
  if (mode === 'subscribe') {
    const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'vult_intel_meta_webhook_secret';
    if (token === VERIFY_TOKEN) {
      console.log(`✅ Meta Webhook Verified on callback URL for ${platform}`);
      return res.status(200).send(challenge); // Return challenge in plain text
    } else {
      console.error(`❌ Meta Webhook Verification Failed. Expected token:`, VERIFY_TOKEN, 'Received:', token);
      return res.sendStatus(403);
    }
  }

  // Otherwise proceed with normal OAuth callback
  const { oauth_token, oauth_verifier } = req.query as Record<string, string>;

  if (platform === 'twitter') {
    const getTwitterRedirect = (src: string, err?: string) => {
      const base = src === 'vult-pulse' ? `https://vultintel.com/vult-pulse?tab=settings` : `https://vultintel.com/social-studio?tab=accounts`;
      return err ? `${base}&error=${encodeURIComponent(err)}` : `${base}&success=twitter`;
    };
    if (error) return res.redirect(getTwitterRedirect('social-studio', error));
    if (!oauth_token || !oauth_verifier) return res.redirect(getTwitterRedirect('social-studio', 'twitter_missing_tokens'));
    
    const sessionStr = await redis.get(`oauth:twitter:${oauth_token}`);
    if (!sessionStr) return res.redirect(getTwitterRedirect('social-studio', 'twitter_session_expired'));
    
    const session = JSON.parse(sessionStr);
    const config = PLATFORMS.twitter;
    const clientId = process.env[config.clientIdEnv]?.trim();
    const clientSecret = process.env[config.clientSecretEnv]?.trim();
    
    try {
      const client = new TwitterApi({
        appKey: clientId!,
        appSecret: clientSecret!,
        accessToken: oauth_token,
        accessSecret: session.oauth_token_secret,
      });
      const { client: loggedClient, accessToken, accessSecret, screenName, userId: twitterUserId } = await client.login(oauth_verifier);
      const finalToken = encryptToken(`${accessToken}:${accessSecret}`);
      await db.run(`
        INSERT INTO social_accounts (id, project_id, user_id, platform, account_id, username, display_name, access_token)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (project_id, platform, account_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          access_token = EXCLUDED.access_token,
          updated_at = NOW()
      `, uuidv4(), session.pId, session.userId, 'twitter', twitterUserId, screenName, screenName, finalToken);
      return res.redirect(getTwitterRedirect(session.source));
    } catch (err: any) {
      console.error('[TWITTER_OAUTH_ERROR]', err);
      return res.redirect(getTwitterRedirect(session.source, err.message));
    }
  }

  let stateData: { pId: string; userId: string; platform: string; source?: string; authSessionId?: string } = { pId: '', userId: '', platform: '', source: 'social-studio' };
  try {
    if (state) {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    }
  } catch {
    return res.status(400).send('Invalid state');
  }

  const getRedirectBaseUrl = () => {
    const frontend = 'https://vultintel.com';
    return stateData.source === 'vult-pulse' 
      ? `${frontend}/vult-pulse?tab=settings`
      : `${frontend}/social-studio?tab=accounts`;
  };

  if (error) {
    return res.redirect(`${getRedirectBaseUrl()}&error=${encodeURIComponent(error)}`);
  }

  const config = PLATFORMS[platform];
  if (!config) return res.status(400).send(`Unknown platform: ${platform}`);

  const clientId = process.env[config.clientIdEnv]?.trim();
  const clientSecret = process.env[config.clientSecretEnv]?.trim();
  if (!clientId || !clientSecret) {
    return res.redirect(`${getRedirectBaseUrl()}&error=not_configured`);
  }

  try {
    const redirectUri = `${getBackendUrl()}/api/social/auth/${platform}/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(platform === 'twitter' ? { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` } : {}),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        ...(platform === 'linkedin' ? {} : { code_verifier: (await redis.get(`oauth:${platform}:${stateData.authSessionId}`)) || '' }),
      }).toString(),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) {
      console.error(`[SOCIAL_OAUTH] ${platform} token exchange failed. Status: ${tokenRes.status}, Body:`, JSON.stringify(tokenData, null, 2));
      throw new Error(tokenData.error_message || tokenData.error_description || tokenData.error?.message || tokenData.error || 'Failed to get access token');
    }


    // Exchange short-lived token for long-lived token (Meta platforms)
    if (platform === 'facebook' || platform === 'instagram' || platform === 'instagram_dm' || platform === 'whatsapp') {
      try {
        const exchangeRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`);
        const exchangeData = await exchangeRes.json() as any;
        if (exchangeData.access_token) {
          tokenData.access_token = exchangeData.access_token;
          tokenData.expires_in = exchangeData.expires_in || (60 * 60 * 24 * 60);
        }
      } catch (e) {
        console.error(`[SOCIAL_OAUTH] Failed to exchange for long-lived Meta token for ${platform}`, e);
      }
    } else if (platform === 'threads') {
      try {
        const exchangeRes = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${clientSecret}&access_token=${tokenData.access_token}`);
        const exchangeData = await exchangeRes.json() as any;
        if (exchangeData.access_token) {
          tokenData.access_token = exchangeData.access_token;
          tokenData.expires_in = exchangeData.expires_in || (60 * 60 * 24 * 60);
        }
      } catch (e) {
        console.error('[SOCIAL_OAUTH] Failed to exchange for long-lived Threads token', e);
      }
    }

    // Get user info
    let accountsToInsert: any[] = [];
    
    if (config.userInfoUrl) {
      const accToken = tokenData.access_token;
      const headers: Record<string, string> = { Authorization: `Bearer ${accToken}` };
      const userRes = await fetch(config.userInfoUrl, { headers });
      const userData = await userRes.json() as any;
      if (!userRes.ok || userData.error) {
        console.error(`[SOCIAL_OAUTH] ${platform} userInfo failed. Status: ${userRes.status}, Body:`, JSON.stringify(userData, null, 2));
      }

      if (platform === 'linkedin') {
        
        accountsToInsert.push({
          accountId: userData.sub,
          username: userData.email || userData.sub,
          displayName: `${userData.given_name || ''} ${userData.family_name || ''}`.trim(),
          avatarUrl: userData.picture || '',
          channelId: ''
        });

        // Fetch LinkedIn Organizations (Pages)
        try {
          const orgsRes = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee', { headers });
          const orgsData = await orgsRes.json() as any;
          if (orgsData.elements) {
            for (const org of orgsData.elements) {
              const orgUrn = org.organization;
              const orgId = orgUrn.split(':').pop();
              
              let orgName = `LinkedIn Page ${orgId}`;
              let orgAvatar = '';
              try {
                 const orgDetailRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, { headers });
                 const orgDetail = await orgDetailRes.json() as any;
                 if (orgDetail.localizedName) orgName = orgDetail.localizedName;
                 // Note: avatar might require a more complex query, skipping for now
              } catch(e) {}

              accountsToInsert.push({
                accountId: orgId,
                username: orgName,
                displayName: orgName,
                avatarUrl: orgAvatar,
                channelId: orgUrn
              });
            }
          }
        } catch (e) {
          console.error('LinkedIn Orgs fetch failed:', e);
        }

      } else if (platform === 'facebook' || platform === 'instagram_dm' || platform === 'whatsapp' || platform === 'instagram') {
        const mainId = userData.id;
        const mainUsername = userData.name;
        const mainDisplayName = userData.name;
        const mainAvatarUrl = userData.picture?.data?.url || '';

        if (platform === 'facebook') {
          // Push personal profile
          accountsToInsert.push({ accountId: mainId, username: mainUsername, displayName: mainDisplayName, avatarUrl: mainAvatarUrl, channelId: '' });
          
          try {
            const pagesRes = await fetch('https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,picture', { headers });
            const pagesData = await pagesRes.json() as any;
            if (pagesData.data) {
              for (const page of pagesData.data) {
                accountsToInsert.push({
                  accountId: page.id,
                  username: page.name,
                  displayName: page.name,
                  avatarUrl: page.picture?.data?.url || '',
                  channelId: page.id,
                  customToken: page.access_token
                });
              }
            }
          } catch (e) {
             console.error('Facebook Pages fetch failed:', e);
          }
        } else if (platform === 'instagram') {
          try {
            const pagesRes = await fetch('https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account,name,access_token', { headers });
            const pagesData = await pagesRes.json() as any;
            
            console.log('[IG_DEBUG] Pages returned from FB:', JSON.stringify(pagesData, null, 2));

            const validPages = pagesData.data?.filter((p: any) => p.instagram_business_account) || [];
            
            if (validPages.length > 0) {
              for (const validPage of validPages) {
                const igId = validPage.instagram_business_account.id;
                let igUser = validPage.name || mainUsername; // Fallback to page name
                let igDisplay = validPage.name || mainDisplayName;
                let igAvatar = mainAvatarUrl;
                
                try {
                  const igRes = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=username,name,profile_picture_url&access_token=${tokenData.access_token}`);
                  const igData = await igRes.json() as any;
                  if (igData.username) igUser = igData.username;
                  if (igData.name) igDisplay = igData.name;
                  if (igData.profile_picture_url) igAvatar = igData.profile_picture_url;
                } catch (e) {
                  console.error(`Failed fetching IG profile for ${igId}:`, e);
                }
                
                accountsToInsert.push({ 
                  accountId: igId, 
                  username: igUser, 
                  displayName: igDisplay, 
                  avatarUrl: igAvatar, 
                  channelId: validPage.id,
                  customToken: validPage.access_token // Optional, but useful if token is page-specific
                });
              }
            } else {
              throw new Error('No Instagram Business account found linked to your Facebook pages.');
            }
          } catch (e: any) {
            console.error('Instagram Linking Error:', e.message);
            throw new Error('Failed to find linked Instagram Business Account. Ensure it is connected to a Facebook Page.');
          }
        } else {
           accountsToInsert.push({ accountId: mainId, username: mainUsername, displayName: mainDisplayName, avatarUrl: mainAvatarUrl, channelId: '' });
        }
      } else if (platform === 'youtube') {
        let channelId = '';
        let displayName = userData.name;
        try {
          const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
          });
          const chData = await chRes.json() as any;
          channelId = chData.items?.[0]?.id || '';
          if (!displayName) displayName = chData.items?.[0]?.snippet?.title || userData.email;
        } catch { /* channel lookup non-critical */ }
        const finalUsername = userData.email || displayName || 'YouTube Account';
        accountsToInsert.push({ accountId: userData.sub, username: finalUsername, displayName, avatarUrl: userData.picture || '', channelId });
      } else if (platform === 'tiktok') {
        const username = userData.data?.user?.display_name || 'TikTok User';
        accountsToInsert.push({
          accountId: userData.data?.user?.open_id || uuidv4(),
          username: username,
          displayName: username,
          avatarUrl: userData.data?.user?.avatar_url || '',
          channelId: ''
        });
      } else if (platform === 'threads') {
        const tId = userData.id || userData.data?.id || tokenData.user_id;
        if (!tId) throw new Error('Could not resolve Threads account ID');
        accountsToInsert.push({
          accountId: tId,
          username: `@${userData.username || userData.data?.username || 'unknown'}`,
          displayName: userData.name || userData.data?.name || userData.username || 'Threads User',
          avatarUrl: userData.threads_profile_picture_url || userData.data?.threads_profile_picture_url || '',
          channelId: ''
        });
      }
    }

    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
    const expiresStr = expiresAt?.toISOString() || null;
    const defaultAccessEnc = encryptToken(tokenData.access_token);
    const refreshEnc = tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null;

    // Upsert accounts
    for (const acc of accountsToInsert) {
      const tokenToSave = acc.customToken ? encryptToken(acc.customToken) : defaultAccessEnc;
      await db.run(`
        INSERT INTO social_accounts 
          (id, project_id, user_id, platform, account_id, username, display_name, avatar_url, 
           access_token, refresh_token, token_expires_at, scopes, channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (project_id, platform, account_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
          token_expires_at = EXCLUDED.token_expires_at,
          scopes = EXCLUDED.scopes,
          channel_id = EXCLUDED.channel_id,
          updated_at = NOW()
      `,
        uuidv4(),
        stateData.pId,
        stateData.userId,
        platform,
        acc.accountId,
        acc.username,
        acc.displayName,
        acc.avatarUrl,
        tokenToSave,
        refreshEnc,
        expiresStr,
        config.scopes,
        acc.channelId || null
      );
    }

    // Redirect exactly to the requested URL for success
    const finalUrl = `https://vultintel.com/social-studio?tab=accounts&success=true&connected=${platform}`;
    res.redirect(finalUrl);
  } catch (err: any) {
    console.error(`[SOCIAL_OAUTH] ${platform} error:`, err.message);
    res.redirect(`${getRedirectBaseUrl()}&error=${encodeURIComponent(err.message)}`);
  }
});

// ─── OAUTH/WEBHOOK EVENT CALLBACK ─────────────────────────────────────────────
router.post('/:platform/callback', express.json(), (req, res) => {
  const { platform } = req.params;
  console.log(`📩 Meta/${platform} Webhook Event Received on Callback URL:`, JSON.stringify(req.body, null, 2));
  // Acknowledge receipt of the event immediately as required by Meta
  res.status(200).send('EVENT_RECEIVED');
});

export default router;
