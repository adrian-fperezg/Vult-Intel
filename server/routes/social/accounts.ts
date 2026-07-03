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

export default router;
