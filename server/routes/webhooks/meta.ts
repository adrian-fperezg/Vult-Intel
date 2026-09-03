import express from 'express';
import { db } from '../../db.js';
import { runPulseEngine } from '../../lib/pulse/engine.js';

const router = express.Router();

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'vult_intel_meta_webhook_secret';

// ─── VERIFICATION ENDPOINT ──────────────────────────────────────────────────
// Meta sends a GET request here when you setup the webhook in the Developer Dashboard
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Meta Webhook Verified successfully');
      return res.status(200).send(challenge);
    } else {
      console.error('❌ Meta Webhook Verification failed. Invalid token.');
      return res.sendStatus(403);
    }
  }

  res.status(400).send('Missing mode or token');
});

// ─── EVENT RECEIVER ─────────────────────────────────────────────────────────
// Meta sends POST requests here for incoming messages and events
router.post('/', async (req, res) => {
  const body = req.body;

  // Check if this is a page/instagram subscription
  if (body.object === 'page' || body.object === 'instagram') {
    // Acknowledge receipt immediately to avoid Meta retries (they expect a 200 OK within 20 seconds)
    res.status(200).send('EVENT_RECEIVED');

    try {
      // Iterate over each entry (there may be multiple if batched)
      for (const entry of body.entry) {
        const pageId = entry.id; // The ID of the Facebook Page receiving the message
        
        // Handle Instagram messaging events
        const events = entry.messaging || [];
        
        for (const webhookEvent of events) {
          const senderId = webhookEvent.sender?.id;
          const recipientId = webhookEvent.recipient?.id;

          if (!senderId) continue;

          // If the message is a text message
          if (webhookEvent.message && webhookEvent.message.text) {
            const messageText = webhookEvent.message.text;
            console.log(`[Vult Pulse] Received message from ${senderId}: "${messageText}" to page ${pageId}`);

            // Pass to the Vult Pulse Engine for processing
            // (Fire and forget, since we already responded 200)
            runPulseEngine({
              pageId,
              senderId,
              messageText,
              platform: body.object === 'instagram' ? 'instagram' : 'facebook'
            }).catch(err => {
              console.error('[Vult Pulse Engine Error]', err);
            });
          }
        }
      }
    } catch (error) {
      console.error('[Vult Pulse Webhook Error]', error);
    }
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

export default router;
