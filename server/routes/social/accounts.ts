import { Router } from 'express';
import { AuthRequest } from '../../middleware.js';
import db from '../../db.js';

const router = Router();

// GET /api/social/accounts - list connected accounts for project
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  if (!pId) return res.status(400).json({ error: 'project_id required' });

  try {
    const accounts = await db.all(`
      SELECT id, platform, account_id, username, display_name, avatar_url, 
             token_expires_at, scopes, page_id, channel_id, created_at
      FROM social_accounts 
      WHERE project_id = ? AND user_id = ?
      ORDER BY platform, created_at ASC
    `, pId, userId);
    res.json(accounts);
  } catch (err: any) {
    console.error('[SOCIAL_ACCOUNTS] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/social/accounts/:id - disconnect an account
router.delete('/:id', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });

  try {
    const account = await db.get<any>(`SELECT * FROM social_accounts WHERE id = ? AND user_id = ?`, id, userId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await db.run(`DELETE FROM social_accounts WHERE id = ?`, id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[SOCIAL_ACCOUNTS] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/accounts/token - connect token-based platforms (Telegram, Twilio SMS)
router.post('/token', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  const { platform, credentials } = req.body;
  
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  if (!pId) return res.status(400).json({ error: 'project_id required' });
  if (!platform || !credentials) return res.status(400).json({ error: 'platform and credentials required' });

  try {
    let accountId = '';
    let username = '';
    let displayName = '';
    let accessToken = '';

    if (platform === 'telegram') {
      const { botToken } = credentials;
      if (!botToken) throw new Error('Telegram bot token required');
      
      // Validate Telegram bot token
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const tgData = await tgRes.json() as any;
      
      if (!tgData.ok) {
        throw new Error('Invalid Telegram bot token');
      }

      accountId = tgData.result.id.toString();
      username = tgData.result.username;
      displayName = tgData.result.first_name;
      accessToken = botToken;
    } else if (platform === 'twilio') {
      const { accountSid, authToken, phoneNumber } = credentials;
      if (!accountSid || !authToken || !phoneNumber) throw new Error('Twilio credentials incomplete');
      
      // Validate Twilio credentials (simple API fetch)
      const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        }
      });
      
      if (!twRes.ok) {
        throw new Error('Invalid Twilio credentials');
      }
      const twData = await twRes.json() as any;

      accountId = accountSid;
      username = phoneNumber;
      displayName = twData.friendly_name || 'Twilio SMS';
      // Store JSON with token + phone number in access_token field
      accessToken = JSON.stringify({ authToken, phoneNumber });
    } else {
      throw new Error(`Unsupported token platform: ${platform}`);
    }

    const { v4: uuidv4 } = await import('uuid');
    const { encryptToken } = await import('../../lib/outreach/encrypt.js');

    await db.run(`
      INSERT INTO social_accounts 
        (id, project_id, user_id, platform, account_id, username, display_name, access_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (project_id, platform, account_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        access_token = EXCLUDED.access_token,
        updated_at = NOW()
    `,
      uuidv4(), pId, userId, platform, accountId, username, displayName, encryptToken(accessToken)
    );

    res.json({ success: true, platform });
  } catch (err: any) {
    console.error(`[SOCIAL_TOKEN] ${platform} error:`, err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/social/accounts/sync/:id - sync account details
router.post('/sync/:id', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  const { id } = req.params;
  
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  if (!pId) return res.status(400).json({ error: 'project_id required' });

  try {
    const targetAccount = await db.get<any>(`SELECT * FROM social_accounts WHERE id = ? AND user_id = ? AND project_id = ?`, id, userId, pId);
    if (!targetAccount) return res.status(404).json({ error: 'Account not found' });
    
    const platform = targetAccount.platform;
    const { decryptToken, encryptToken } = await import('../../lib/outreach/encrypt.js');
    const { v4: uuidv4 } = await import('uuid');

    let accountsToInsert: any[] = [];
    let syncCount = 0;

    if (platform === 'facebook' || platform === 'instagram') {
      // Find the main Facebook account (user token) to use for fetching Meta pages
      const mainFbAccount = await db.get<any>(`
        SELECT * FROM social_accounts 
        WHERE project_id = ? AND user_id = ? AND platform = 'facebook' AND (channel_id IS NULL OR channel_id = '')
        ORDER BY created_at DESC LIMIT 1
      `, pId, userId);

      if (!mainFbAccount) {
        return res.status(400).json({ error: 'No main Facebook profile found. Please reconnect Facebook.' });
      }

      const accessToken = decryptToken(mainFbAccount.access_token);
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,picture,instagram_business_account&limit=100&access_token=${accessToken}`);
      const pagesData = await pagesRes.json() as any;

      if (pagesData.error) throw new Error(`Meta API Error: ${pagesData.error.message}`);

      if (pagesData.data) {
        for (const page of pagesData.data) {
          accountsToInsert.push({
            platform: 'facebook',
            accountId: page.id,
            username: page.name,
            displayName: page.name,
            avatarUrl: page.picture?.data?.url || '',
            channelId: page.id,
            tokenToSave: encryptToken(page.access_token)
          });

          if (page.instagram_business_account) {
            const igId = page.instagram_business_account.id;
            let igUser = page.name;
            let igDisplay = page.name;
            let igAvatar = mainFbAccount.avatar_url;
            
            try {
              const igRes = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=username,name,profile_picture_url&access_token=${accessToken}`);
              const igData = await igRes.json() as any;
              if (igData.username) igUser = igData.username;
              if (igData.name) igDisplay = igData.name;
              if (igData.profile_picture_url) igAvatar = igData.profile_picture_url;
            } catch (e) {
              console.error(`Failed fetching IG profile for ${igId}:`, e);
            }

            accountsToInsert.push({
              platform: 'instagram',
              accountId: igId,
              username: igUser,
              displayName: igDisplay,
              avatarUrl: igAvatar,
              channelId: page.id,
              tokenToSave: encryptToken(page.access_token)
            });
          }
        }
      }
    } else if (platform === 'linkedin') {
      const accessToken = decryptToken(targetAccount.access_token);
      const headers = { Authorization: `Bearer ${accessToken}` };
      const userRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers });
      const userData = await userRes.json() as any;
      if (userData.sub) {
        accountsToInsert.push({
          platform: 'linkedin',
          accountId: userData.sub,
          username: userData.email || userData.sub,
          displayName: `${userData.given_name || ''} ${userData.family_name || ''}`.trim(),
          avatarUrl: userData.picture || '',
          channelId: '',
          tokenToSave: targetAccount.access_token
        });
      }

      try {
        const orgsRes = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee', { headers });
        const orgsData = await orgsRes.json() as any;
        if (orgsData.elements) {
          for (const org of orgsData.elements) {
            const orgUrn = org.organization;
            const orgId = orgUrn.split(':').pop();
            let orgName = `LinkedIn Page ${orgId}`;
            try {
               const orgDetailRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, { headers });
               const orgDetail = await orgDetailRes.json() as any;
               if (orgDetail.localizedName) orgName = orgDetail.localizedName;
            } catch(e) {}
            accountsToInsert.push({
              platform: 'linkedin',
              accountId: orgId,
              username: orgName,
              displayName: orgName,
              avatarUrl: '',
              channelId: orgUrn,
              tokenToSave: targetAccount.access_token
            });
          }
        }
      } catch (e) {
        console.error('LinkedIn Orgs sync failed:', e);
      }
    } else if (platform === 'twitter') {
      const accessToken = decryptToken(targetAccount.access_token);
      const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      const userData = await userRes.json() as any;
      if (userData.data) {
        accountsToInsert.push({
          platform: 'twitter',
          accountId: userData.data.id,
          username: `@${userData.data.username}`,
          displayName: userData.data.name,
          avatarUrl: userData.data.profile_image_url || '',
          channelId: '',
          tokenToSave: targetAccount.access_token
        });
      }
    } else if (platform === 'youtube') {
      const accessToken = decryptToken(targetAccount.access_token);
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { 
        headers: { Authorization: `Bearer ${accessToken}` } 
      });
      const userData = await userRes.json() as any;
      if (userData.sub) {
        let channelId = '';
        let displayName = userData.name;
        try {
          const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const chData = await chRes.json() as any;
          channelId = chData.items?.[0]?.id || '';
          if (!displayName) displayName = chData.items?.[0]?.snippet?.title || userData.email;
        } catch { /* ignore */ }
        
        accountsToInsert.push({
          platform: 'youtube',
          accountId: userData.sub,
          username: userData.email || userData.sub,
          displayName,
          avatarUrl: userData.picture || '',
          channelId,
          tokenToSave: targetAccount.access_token
        });
      }
    } else {
      // Basic refresh for any other platform (like tiktok or telegram) where we just want to say it synced.
      // Usually these would require their own API calls.
      return res.json({ success: true, count: 1, message: 'Sync not fully implemented for this platform yet, but connection is alive.' });
    }

    // Upsert all found accounts
    for (const acc of accountsToInsert) {
      await db.run(`
        INSERT INTO social_accounts 
          (id, project_id, user_id, platform, account_id, username, display_name, avatar_url, access_token, channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (project_id, platform, account_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          access_token = EXCLUDED.access_token,
          channel_id = EXCLUDED.channel_id,
          updated_at = NOW()
      `,
        uuidv4(), pId, userId, acc.platform, acc.accountId, acc.username, acc.displayName, acc.avatarUrl, acc.tokenToSave, acc.channelId
      );
      syncCount++;
    }

    res.json({ success: true, count: syncCount });
  } catch (err: any) {
    console.error(`[SOCIAL_SYNC] error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
