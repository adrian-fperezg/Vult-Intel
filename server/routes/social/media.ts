import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, verifyFirebaseToken } from '../../middleware.js';

const router = Router();

const mediaUploadDir = path.join(process.cwd(), 'uploads', 'media');
if (!fs.existsSync(mediaUploadDir)) {
  fs.mkdirSync(mediaUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'media-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for videos
});

router.post('/', verifyFirebaseToken, upload.array('files', 10), (req: AuthRequest, res) => {
  try {
    const files = req.files as any[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    
    const urls = files.map(file => {
      // Return public URL mapping to the static file server
      return `${appUrl}/uploads/media/${file.filename}`;
    });

    res.json({ urls });
  } catch (error: any) {
    console.error('[SOCIAL_MEDIA_UPLOAD]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
