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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isCapturing: boolean;
  ringLightOn: boolean;
}
