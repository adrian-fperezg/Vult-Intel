import { db as sqlDb } from '../../db.js';
import admin from 'firebase-admin';
import { decryptToken } from '../outreach/encrypt.js';

interface WebhookEvent {
  pageId: string;
  senderId: string;
  messageText: string;
  platform: 'facebook' | 'instagram';
}

export async function runPulseEngine(event: WebhookEvent) {
  const { pageId, senderId, messageText, platform } = event;

  // 1. Get the Social Account to retrieve the access token and the User ID
  const account = await sqlDb.get<any>(
    `SELECT * FROM social_accounts WHERE account_id = ? AND platform = ?`,
    pageId, platform
  );

  if (!account) {
    console.warn(`[Pulse Engine] No matching account found for pageId ${pageId} (${platform})`);
    return;
  }

  const userId = account.user_id;
  const accessToken = decryptToken(account.access_token);

  // 2. Fetch Active Flows for this user from Firestore
  const flowsRef = admin.firestore().collection(`customers/${userId}/pulse_flows`);
  const activeFlowsSnap = await flowsRef.where('status', '==', 'active').get();

  if (activeFlowsSnap.empty) {
    return; // No active flows, nothing to do
  }

  // 3. Find a matching flow based on Keyword Trigger
  let matchedFlow: any = null;
  for (const doc of activeFlowsSnap.docs) {
    const flow = doc.data();
    // Assuming TriggerNode data contains the keyword (e.g. triggerKeyword)
    if (flow.triggerType === 'Keyword' && flow.triggerKeyword) {
      if (messageText.toLowerCase().includes(flow.triggerKeyword.toLowerCase())) {
        matchedFlow = flow;
        break;
      }
    }
  }

  if (!matchedFlow) {
    return; // No keyword match
  }

  console.log(`[Pulse Engine] Flow triggered: "${matchedFlow.name}" for user ${userId}`);

  // 4. Parse the ReactFlow Nodes/Edges to find the first Message
  const { nodes = [], edges = [] } = matchedFlow.canvas || {};
  
  const triggerNode = nodes.find((n: any) => n.type === 'trigger');
  if (!triggerNode) return;

  // Find the edge connecting from the trigger
  const nextEdge = edges.find((e: any) => e.source === triggerNode.id);
  if (!nextEdge) return;

  // Find the target node
  const firstActionNode = nodes.find((n: any) => n.id === nextEdge.target);
  if (!firstActionNode || firstActionNode.type !== 'message') {
    console.warn(`[Pulse Engine] First node after trigger is not a message for flow ${matchedFlow.id}`);
    return;
  }

  const messageToSend = firstActionNode.data?.label;
  if (!messageToSend) return;

  // 5. Send the reply via Meta Graph API
  await sendMetaMessage(pageId, senderId, messageToSend, accessToken, platform);

  // 6. Save Interaction to Firestore (Contacts & Conversations)
  await saveInteraction(userId, senderId, pageId, messageText, messageToSend, platform);
}

async function sendMetaMessage(pageId: string, recipientId: string, text: string, accessToken: string, platform: string) {
  const endpoint = platform === 'instagram'
    ? `https://graph.facebook.com/v19.0/${pageId}/messages`
    : `https://graph.facebook.com/v19.0/me/messages`;

  const payload = {
    recipient: { id: recipientId },
    message: { text }
  };

  const response = await fetch(`${endpoint}?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[Pulse Engine] Error sending message via Meta API:`, errorBody);
    throw new Error('Failed to send Meta message');
  }

  console.log(`[Pulse Engine] Successfully sent reply to ${recipientId}`);
}

async function saveInteraction(
  userId: string, senderId: string, pageId: string,
  userMessage: string, botReply: string, platform: string
) {
  const timestamp = new Date();
  const contactRef = admin.firestore().collection(`customers/${userId}/pulse_contacts`).doc(senderId);
  
  // Upsert Contact
  await contactRef.set({
    platformId: senderId,
    platform,
    pageId,
    lastInteraction: timestamp,
    // (We would fetch the name via Graph API if requested, but setting a placeholder for now)
    name: `User ${senderId.slice(-4)}`,
  }, { merge: true });

  // Append Conversation
  const convoRef = admin.firestore().collection(`customers/${userId}/pulse_conversations`).doc(`${pageId}_${senderId}`);
  const contactName = `User ${senderId.slice(-4)}`;
  
  await convoRef.set({
    contactId: senderId,
    name: contactName,
    pageId,
    platform,
    updatedAt: timestamp,
    lastMessage: userMessage,
  }, { merge: true });

  // Add messages to subcollection
  const messagesCol = convoRef.collection('messages');
  
  // User's message
  await messagesCol.add({
    text: userMessage,
    sender: 'user',
    timestamp: new Date(timestamp.getTime() - 1000) // 1 second before
  });

  // Bot's reply
  await messagesCol.add({
    text: botReply,
    sender: 'bot',
    timestamp
  });
}
