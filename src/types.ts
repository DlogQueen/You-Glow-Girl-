export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: number;
}

export interface FacialMetrics {
  faceShape: string;
  eyeType: string;
  skinUndertone: string;
}

// Ada's persistent memory: raw conversation turns (Message[], already held in
// React state) get periodically consolidated into these compact long-term
// summaries, which travel with the user's profile and get folded back into
// every future chat's system prompt - so Ada actually remembers past
// conversations instead of starting fresh every session.
export interface LongTermMemoryEntry {
  id: string;
  summary: string;
  importance: number; // 1-5, higher = more likely to be surfaced when the list is trimmed
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  undertone?: string;
  confidenceScore: number;
  facialMetrics?: FacialMetrics | null;
  privacySettings?: {
    localProcessing: boolean;
  };
  lastScanAt?: any;
  createdAt: any;
  beautyGoal?: string;
  tier?: 'free' | 'elite';
  longTermMemories?: LongTermMemoryEntry[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isCapturing: boolean;
  ringLightOn: boolean;
}
