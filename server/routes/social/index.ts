import { Router } from 'express';
import accountsRouter from './accounts.js';
import oauthRouter from './oauth.js';
import postsRouter from './posts.js';
import mediaRouter from './media.js';

const router = Router();

router.use('/auth', oauthRouter);
router.use('/accounts', accountsRouter);
router.use('/posts', postsRouter);
router.use('/media', mediaRouter);

export default router;
