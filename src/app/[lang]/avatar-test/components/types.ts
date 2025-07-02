export interface AvatarTestClientProps {
  dict: any;
}

export interface GeneratedAvatar {
  id: string;
  filename: string;
  url: string;
  prompt: string;
  taskId: string;
}

export interface ExistingImage {
  id: string;
  url: string;
  filename: string;
  selected: boolean;
}

export interface AvatarPrompt {
  id: number;
  content: string;
  runwayPrompt: string;
  chineseTranslation: string;
  isEdited: boolean;
  specification?: string;
  generatedImages: GeneratedAvatar[];
  isGeneratingImages: boolean;
  failedCount: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  editedContent?: string;
}

export interface GeneratedVideo {
  id: string;
  videoId: string;
  status: string;
  videoUrl?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  assetId: string;
  voiceId: string;
  text: string;
  createdAt: string;
  videoData?: any; // Store full video data from HeyGen
} 