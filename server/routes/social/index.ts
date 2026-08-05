import { Router } from 'express';
import accountsRouter from './accounts.js';
import postsRouter from './posts.js';
import mediaRouter from './media.js';
import analyticsRouter from './analytics.js';

const router = Router();

router.use('/accounts', accountsRouter);
router.use('/posts', postsRouter);
router.use('/media', mediaRouter);
router.use('/analytics', analyticsRouter);

export default router;
