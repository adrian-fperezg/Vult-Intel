/**
 * Project ownership checks.
 *
 * Projects live in Firestore under customers/{uid}/projects/{projectId}. Most
 * Postgres tables are scoped only by project_id, so every request that names a
 * project must prove the caller owns it.
 */
import type { Response, NextFunction } from 'express';
import admin from './firebase.js';
import type { AuthRequest } from '../middleware.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const ownershipCache = new Map<string, number>(); // `${uid}:${projectId}` → expiresAt

export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const key = `${userId}:${projectId}`;
  const cachedUntil = ownershipCache.get(key);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  const snap = await admin.firestore().doc(`customers/${userId}/projects/${projectId}`).get();
  if (snap.exists) ownershipCache.set(key, Date.now() + CACHE_TTL_MS);
  return snap.exists;
}

// Every place a client can name a project. All of them must be owned by the caller.
export function collectProjectIds(req: AuthRequest): string[] {
  const candidates = [
    req.headers['x-project-id'],
    req.query?.project_id,
    req.query?.projectId,
    req.body?.project_id,
    req.body?.projectId,
    // Routes shaped like /projects/:projectId/... (req.params is not populated in app.use)
    (req.path.match(/^\/projects\/([^/]+)/) || [])[1],
  ];
  const ids = new Set<string>();
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) ids.add(c.trim());
  }
  return [...ids];
}

/**
 * Express middleware: rejects the request if it names a project the user does
 * not own, or names two different projects. Sets req.projectId.
 */
export async function requireProjectAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: 'Auth required' });

  const ids = collectProjectIds(req);
  if (ids.length > 1) {
    return res.status(400).json({ error: 'Conflicting project ids in request' });
  }
  if (ids.length === 0) return next();

  try {
    if (!(await userOwnsProject(userId, ids[0]))) {
      return res.status(403).json({ error: 'Project not found for this user' });
    }
    req.projectId = ids[0];
    next();
  } catch (err: any) {
    console.error('[ProjectAccess] Ownership check failed:', err.message);
    res.status(503).json({ error: 'Could not verify project access. Please retry.' });
  }
}
