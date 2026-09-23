import { Router } from 'express';
import { AuthRequest } from '../../middleware.js';
import db from '../../db.js';
import { v4 as uuidv4 } from 'uuid';
import { PUBLISHABLE_PLATFORMS } from '../../lib/social/utils.js';

const router = Router();

const getProjectId = (req: AuthRequest): string | undefined =>
  (req.headers['x-project-id'] as string) || req.body?.project_id || (req.query.project_id as string) || undefined;

// Only accounts connected to THIS project by THIS user can be publish targets.
async function loadOwnedAccounts(accountIds: unknown, userId: string, pId: string) {
  if (!Array.isArray(accountIds) || accountIds.length === 0) return [];
  const ids = accountIds.filter((id): id is string => typeof id === 'string');
  const placeholders = ids.map(() => '?').join(', ');
  const platformPlaceholders = PUBLISHABLE_PLATFORMS.map(() => '?').join(', ');
  return db.all<{ id: string; platform: string }>(
    `SELECT id, platform FROM social_accounts
     WHERE id IN (${placeholders}) AND user_id = ? AND project_id = ? AND platform IN (${platformPlaceholders})`,
    ...ids, userId, pId, ...PUBLISHABLE_PLATFORMS
  );
}

async function insertTargets(postId: string, accounts: { id: string; platform: string }[], body: any) {
  const { custom_bodies, network_first_comments, network_options, network_media_urls } = body;
  for (const account of accounts) {
    const customBody = custom_bodies?.[account.id] || null;
    const targetFirstComment = network_first_comments?.[account.id] || null;

    const mergedPlatformOptions = { ...(network_options?.[account.id] || {}) };
    if (network_media_urls?.[account.id]) {
      mergedPlatformOptions.media_urls = network_media_urls[account.id];
    }

    await db.run(`
      INSERT INTO social_post_targets (id, post_id, account_id, platform, status, custom_body, first_comment, platform_options)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?::jsonb)
      ON CONFLICT (post_id, account_id) DO NOTHING
    `, uuidv4(), postId, account.id, account.platform, customBody, targetFirstComment, JSON.stringify(mergedPlatformOptions));
  }
}

// GET /api/social/posts
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = (req.headers['x-project-id'] as string) || (req.query.project_id as string);
  const { status, from, to } = req.query as Record<string, string>;
  if (!userId || !pId) return res.status(400).json({ error: 'project_id required' });

  try {
    // Auto-prune old published posts (> 1 month old) to save memory/storage
    try {
      await db.run(`
        DELETE FROM social_posts 
        WHERE project_id = ? 
          AND user_id = ? 
          AND status = 'published' 
          AND COALESCE(published_at, scheduled_at, created_at) < NOW() - INTERVAL '1 month'
      `, pId, userId);
    } catch (pruneErr) {
      console.warn('[SOCIAL_POSTS] Failed to prune old posts:', pruneErr);
    }

    let sql = `
      SELECT p.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id, 'account_id', t.account_id, 'platform', t.platform,
              'status', t.status, 'error_message', t.error_message,
              'published_at', t.published_at, 'analytics', t.analytics,
              'custom_body', t.custom_body, 'first_comment', t.first_comment,
              'platform_options', t.platform_options
            )
          ) FILTER (WHERE t.id IS NOT NULL), '[]'
        ) as targets
      FROM social_posts p
      LEFT JOIN social_post_targets t ON t.post_id = p.id
      WHERE p.project_id = ? AND p.user_id = ?
    `;
    const params: any[] = [pId, userId];

    if (status && status !== 'all') { sql += ` AND p.status = ?`; params.push(status); }
    if (from) { sql += ` AND p.scheduled_at >= ?`; params.push(from); }
    if (to) { sql += ` AND p.scheduled_at <= ?`; params.push(to); }

    sql += ` GROUP BY p.id ORDER BY COALESCE(p.scheduled_at, p.created_at) ASC`;

    const posts = await db.all(sql, ...params);
    res.json(posts);
  } catch (err: any) {
    console.error('[SOCIAL_POSTS] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/posts
router.post('/', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = getProjectId(req);
  const {
    body,
    media_urls,
    link_url,
    link_title,
    link_description,
    link_image,
    first_comment,
    scheduled_at,
    account_ids,
    status,
    custom_bodies,
    network_options,
    network_media_urls
  } = req.body;
  if (!userId || !pId) return res.status(400).json({ error: 'project_id required' });
  if (!account_ids?.length) return res.status(400).json({ error: 'Select at least one account' });

  if (!body?.trim() && !media_urls?.length) {
    const everyTargetHasContent = account_ids.every((id: string) =>
      custom_bodies?.[id]?.trim() || network_media_urls?.[id]?.length || network_options?.[id]?.media_urls?.length
    );
    if (!everyTargetHasContent) return res.status(400).json({ error: 'Body or media is required for all accounts' });
  }

  try {
    const accounts = await loadOwnedAccounts(account_ids, userId, pId);
    if (accounts.length !== new Set(account_ids).size) {
      return res.status(400).json({ error: 'One or more selected accounts are not connected to this project' });
    }

    const postId = uuidv4();
    // Without a date a post is a draft ("Post now" publishes drafts directly).
    const postStatus = scheduled_at && status !== 'draft' ? 'scheduled' : 'draft';

    await db.run(`
      INSERT INTO social_posts (id, project_id, user_id, body, media_urls, link_url, link_title, link_description, link_image, first_comment, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?)
    `, postId, pId, userId, body || '', JSON.stringify(media_urls || []), link_url || null, link_title || null, link_description || null, link_image || null, first_comment || null, postStatus, scheduled_at || null);

    await insertTargets(postId, accounts, req.body);

    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, postId);
    res.status(201).json(post);
  } catch (err: any) {
    console.error('[SOCIAL_POSTS] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/social/posts/:id
// Only the fields present in the body are updated (null clears a field).
router.patch('/:id', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const pId = getProjectId(req);
  const { id } = req.params;
  if (!userId || !pId) return res.status(400).json({ error: 'project_id required' });

  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ? AND project_id = ?`, id, userId, pId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (['published', 'publishing', 'published_partial'].includes(post.status)) {
      return res.status(400).json({ error: `Cannot edit a post that is ${post.status}` });
    }

    let accounts: { id: string; platform: string }[] | null = null;
    if (req.body.account_ids !== undefined) {
      if (!Array.isArray(req.body.account_ids) || req.body.account_ids.length === 0) {
        return res.status(400).json({ error: 'Select at least one account' });
      }
      accounts = await loadOwnedAccounts(req.body.account_ids, userId, pId);
      if (accounts.length !== new Set(req.body.account_ids).size) {
        return res.status(400).json({ error: 'One or more selected accounts are not connected to this project' });
      }
    }

    const sets: string[] = [];
    const params: any[] = [];
    const setField = (column: string, value: any, cast = '') => { sets.push(`${column} = ?${cast}`); params.push(value); };

    if ('body' in req.body) setField('body', req.body.body || '');
    if ('media_urls' in req.body) setField('media_urls', JSON.stringify(req.body.media_urls || []), '::jsonb');
    if ('link_url' in req.body) setField('link_url', req.body.link_url || null);
    if ('first_comment' in req.body) setField('first_comment', req.body.first_comment || null);
    if ('scheduled_at' in req.body) setField('scheduled_at', req.body.scheduled_at || null);

    if ('status' in req.body || 'scheduled_at' in req.body) {
      const scheduledAt = 'scheduled_at' in req.body ? req.body.scheduled_at : post.scheduled_at;
      // Picking a new date for a draft/failed post (e.g. from the queue) schedules it again.
      let nextStatus = req.body.status || (['draft', 'failed'].includes(post.status) && scheduledAt ? 'scheduled' : post.status);
      // A post can only sit in 'scheduled' if it has a date; otherwise the cron never picks it up.
      if (nextStatus === 'scheduled' && !scheduledAt) nextStatus = 'draft';
      if (!['draft', 'scheduled', 'paused'].includes(nextStatus)) nextStatus = 'draft';
      setField('status', nextStatus);
      sets.push('error_message = NULL', 'error_code = NULL');
    }

    if (sets.length) {
      await db.run(`UPDATE social_posts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, ...params, id);
    }

    if (post.status === 'failed' && !accounts) {
      // Leaving 'failed' (rescheduled or back to draft): failed targets get another attempt.
      await db.run(`UPDATE social_post_targets SET status = 'pending', error_message = NULL, error_code = NULL WHERE post_id = ? AND status = 'failed'`, id);
    }

    if (accounts) {
      // Replace every target that has not gone out yet (pending or failed).
      await db.run(`DELETE FROM social_post_targets WHERE post_id = ? AND status IN ('pending', 'failed')`, id);
      await insertTargets(id, accounts, req.body);
    }

    const updated = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, id);
    res.json(updated);
  } catch (err: any) {
    console.error('[SOCIAL_POSTS] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/social/posts/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });

  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, id, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await db.run(`DELETE FROM social_posts WHERE id = ?`, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/posts/:id/publish – immediate publish
router.post('/:id/publish', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });

  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, id, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (!['draft', 'scheduled', 'paused', 'failed'].includes(post.status)) {
      return res.status(400).json({ error: `Post is ${post.status}` });
    }

    // Failed targets get another attempt; already-published ones are left alone.
    await db.run(`UPDATE social_post_targets SET status = 'pending', error_message = NULL, error_code = NULL WHERE post_id = ? AND status = 'failed'`, id);

    const { publishPost } = await import('../../lib/social/publisher.js');
    const finalStatus = await publishPost(post.id, ['draft', 'scheduled', 'paused', 'failed']);
    if (!finalStatus) return res.status(409).json({ error: 'This post is already being published' });

    const updated = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, id);
    res.json(updated);
  } catch (err: any) {
    console.error('[SOCIAL_POSTS] Publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/posts/:id/pause
router.post('/:id/pause', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, id, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status === 'published') return res.status(400).json({ error: 'Cannot pause a published post' });
    await db.run(`UPDATE social_posts SET status = 'paused', paused_at = NOW(), updated_at = NOW() WHERE id = ?`, id);
    const updated = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/posts/:id/resume
router.post('/:id/resume', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, id, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'paused') return res.status(400).json({ error: 'Post is not paused' });
    await db.run(`UPDATE social_posts SET status = 'scheduled', paused_at = NULL, updated_at = NOW() WHERE id = ?`, id);
    const updated = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/social/posts/:id/retry
router.post('/:id/retry', async (req: AuthRequest, res) => {
  const userId = req.user?.uid;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ error: 'Auth required' });
  try {
    const post = await db.get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, id, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'failed') return res.status(400).json({ error: 'Only failed posts can be retried' });
    // Reset failed targets back to pending so publisher picks them up again
    await db.run(`UPDATE social_post_targets SET status = 'pending', error_message = NULL, error_code = NULL WHERE post_id = ? AND status = 'failed'`, id);
    // Put post back in scheduled queue
    await db.run(`UPDATE social_posts SET status = 'scheduled', error_message = NULL, error_code = NULL, updated_at = NOW() WHERE id = ?`, id);
    const updated = await db.get<any>(`SELECT * FROM social_posts WHERE id = ?`, id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
