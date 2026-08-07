import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import admin from '../../lib/firebase.js';
import { AuthRequest, verifyFirebaseToken } from '../../middleware.js';

const router = Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for videos
});

router.post('/', verifyFirebaseToken, upload.array('files', 10), async (req: AuthRequest, res) => {
  try {
    const files = req.files as any[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const bucket = admin.storage().bucket();
    const urls: string[] = [];

    for (const file of files) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const filename = `media/social_${uniqueSuffix}${ext}`;
      const fileUpload = bucket.file(filename);

      await fileUpload.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
        public: true // Try making it public
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      urls.push(publicUrl);
    }

    res.json({ urls });
  } catch (error: any) {
    console.error('[SOCIAL_MEDIA_UPLOAD]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
