import AvatarPromptSection from './AvatarPromptSection';
import GeneratedAvatarsGrid from './GeneratedAvatarsGrid';
import { AvatarPrompt, ConversationMessage, GeneratedAvatar, ExistingImage } from './types';

interface GenerateAvatarTabProps {
  avatarDescription: string;
  setAvatarDescription: (value: string) => void;
  isOptimizing: boolean;
  onGeneratePrompt: () => void;
  avatarPrompts: AvatarPrompt[];
  onPromptEdit: (id: number, newRunwayPrompt: string) => void;
  onGenerateAvatars: (promptId: number, imageCount: number) => void;
  onSelectGeneratedAvatar: (avatar: GeneratedAvatar) => void;
  onSelectAllGenerated: () => void;
  selectedAvatars: (ExistingImage | GeneratedAvatar)[];
  conversation: ConversationMessage[];
  error: string | null;
}

export default function GenerateAvatarTab({
  avatarDescription,
  setAvatarDescription,
  isOptimizing,
  onGeneratePrompt,
  avatarPrompts,
  onPromptEdit,
  onGenerateAvatars,
  onSelectGeneratedAvatar,
  onSelectAllGenerated,
  selectedAvatars,
  conversation,
  error
}: GenerateAvatarTabProps) {
  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">⚠️ {error}</p>
        </div>
      )}

      <AvatarPromptSection
        avatarDescription={avatarDescription}
        setAvatarDescription={setAvatarDescription}
        isOptimizing={isOptimizing}
        onGeneratePrompt={onGeneratePrompt}
        avatarPrompts={avatarPrompts}
        onPromptEdit={onPromptEdit}
        onGenerateAvatars={onGenerateAvatars}
        conversation={conversation}
      />

      <GeneratedAvatarsGrid
        avatarPrompts={avatarPrompts}
        selectedAvatars={selectedAvatars}
        onSelectAvatar={onSelectGeneratedAvatar}
        onSelectAllGenerated={onSelectAllGenerated}
      />
    </div>
  );
} 