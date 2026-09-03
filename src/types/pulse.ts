export type PulseFlowStatus = 'active' | 'draft' | 'paused';

export interface PulseFlow {
  id: string;
  name: string;
  triggerType: string;
  triggerKeyword?: string;
  status: PulseFlowStatus;
  subscribers: number;
  completionRate: number;
  conversionRate: number;
  messages: number;
  lastEdited: string;
  canvas: {
    nodes: any[];
    edges: any[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface PulseContact {
  platformId: string;
  platform: 'facebook' | 'instagram' | 'threads';
  pageId: string;
  name: string;
  lastInteraction: any; // Firestore Timestamp
}

export interface PulseConversation {
  id: string; // pageId_senderId
  contactId: string;
  pageId: string;
  platform: 'facebook' | 'instagram' | 'threads';
  updatedAt: any; // Firestore Timestamp
}

export interface PulseMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: any; // Firestore Timestamp
}
