export interface GeneratedImage {
  taskId: string;
  filename: string;
  url: string;
  prompt: string;
  status?: 'success' | 'failed';
  error?: string;
}

export interface ReferenceImage {
  id: string;
  filename: string;
  url: string;
  originalFile?: File;
  isVideo?: boolean;
  extractedFrame?: string; // For video files, store the extracted frame URL
}

export interface VideoGenerationTask {
  taskId: string | null;
  imageIndex: number;
  imageName: string;
  status: 'queued' | 'submitted' | 'failed' | 'processing' | 'completed' | 'downloading' | 'downloaded';
  error?: string;
  videoUrl?: string;
  localPath?: string;
  relativePath?: string;
  previewUrl?: string; // Preview image extracted from video
  prompt?: string;
  imageUrl?: string;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: any;
  editedContent?: string;
}

export interface PromptWithSpec {
  id: number;
  content: string;
  runwayPrompt: string; // Extracted runway prompt for editing
  chineseTranslation: string; // Extracted Chinese translation for display
  isEdited: boolean;
  specification?: string;
  generatedImages?: GeneratedImage[];
  isGeneratingImages?: boolean;
  failedCount?: number;
}

export interface SessionData {
  id: string;
  projectId: string; // Link to parent project
  name: string;
  createdAt: string;
  updatedAt: string;
  
  // Form states
  imageDataUrl: string;
  videoPrompt: string;
  folderName: string;
  aspectRatio: string;
  
  // Image generation settings
  imageAspectRatio: string; // For image generation
  imageResolution: {width: number, height: number}; // For image generation
  
  // Image states
  selectedImages: string[]; // Set converted to array for JSON
  addedImages: GeneratedImage[];
  referenceImages: ReferenceImage[]; // Reference images for prompt generation
  
  // Video states
  videoTasks: VideoGenerationTask[];
  isGeneratingVideo: boolean;
  
  // Prompt generation states
  prompts: PromptWithSpec[];
  conversation: ConversationMessage[];
  userRequirement: string;
}

export interface SessionMetadata {
  id: string;
  projectId: string; // Link to parent project
  name: string;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  videoCount: number;
} 