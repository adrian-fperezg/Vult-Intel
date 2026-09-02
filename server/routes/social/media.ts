import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { AuthRequest, verifyFirebaseToken } from '../../middleware.js';
import admin from '../../lib/firebase.js';

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
    
    const urls = await Promise.all(files.map(async (file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      let ext = path.extname(file.originalname);
      if (!ext) {
        if (file.mimetype === 'image/jpeg') ext = '.jpg';
        else if (file.mimetype === 'image/png') ext = '.png';
        else if (file.mimetype === 'image/gif') ext = '.gif';
        else if (file.mimetype === 'video/mp4') ext = '.mp4';
        else ext = '.jpg';
      }
      
      const filename = `social_media/social_${uniqueSuffix}${ext}`;
      const fileRef = bucket.file(filename);
      
      await fileRef.save(file.buffer, {
        metadata: { contentType: file.mimetype }
      });
      
      // Get signed URL that expires far in the future
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '01-01-2100'
      });
      
      return url;
    }));

    res.json({ urls });
  } catch (error: any) {
    console.error('[SOCIAL_MEDIA_UPLOAD]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
