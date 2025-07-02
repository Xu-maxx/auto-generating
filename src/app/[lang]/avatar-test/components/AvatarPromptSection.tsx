import { AvatarPrompt, ConversationMessage } from './types';

interface AvatarPromptSectionProps {
  avatarDescription: string;
  setAvatarDescription: (value: string) => void;
  isOptimizing: boolean;
  onGeneratePrompt: () => void;
  avatarPrompts: AvatarPrompt[];
  onPromptEdit: (id: number, newRunwayPrompt: string) => void;
  onGenerateAvatars: (promptId: number, imageCount: number) => void;
  conversation: ConversationMessage[];
}

export default function AvatarPromptSection({
  avatarDescription,
  setAvatarDescription,
  isOptimizing,
  onGeneratePrompt,
  avatarPrompts,
  onPromptEdit,
  onGenerateAvatars,
  conversation
}: AvatarPromptSectionProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Generate New Avatar</h2>
        
        {/* Description Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Avatar Description
          </label>
          <textarea
            value={avatarDescription}
            onChange={(e) => setAvatarDescription(e.target.value)}
            placeholder="Describe the avatar you want to generate (e.g., a professional business woman with short hair)"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* Generate Prompt Button */}
        <button
          onClick={onGeneratePrompt}
          disabled={!avatarDescription.trim() || isOptimizing}
          className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isOptimizing ? 'Optimizing Prompt...' : 'Generate Optimized Prompt'}
        </button>
      </div>

      {/* Generated Prompts */}
      {avatarPrompts.length > 0 && (
        <div className="space-y-4">
          {avatarPrompts.map((prompt) => (
            <div key={prompt.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-800 mb-2">
                  Prompt #{prompt.id}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Original:</strong> {prompt.content}
                </p>
              </div>

              {/* Editable Runway Prompt */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Runway Prompt:
                </label>
                <textarea
                  value={prompt.runwayPrompt}
                  onChange={(e) => onPromptEdit(prompt.id, e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>

              {/* Chinese Translation */}
              {prompt.chineseTranslation && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chinese Translation:
                  </label>
                  <p className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    {prompt.chineseTranslation}
                  </p>
                </div>
              )}

              {/* Generate Images Controls */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => onGenerateAvatars(prompt.id, 1)}
                  disabled={prompt.isGeneratingImages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {prompt.isGeneratingImages ? 'Generating...' : 'Generate 1 Avatar'}
                </button>
                <button
                  onClick={() => onGenerateAvatars(prompt.id, 2)}
                  disabled={prompt.isGeneratingImages}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {prompt.isGeneratingImages ? 'Generating...' : 'Generate 2 Avatars'}
                </button>
                <button
                  onClick={() => onGenerateAvatars(prompt.id, 4)}
                  disabled={prompt.isGeneratingImages}
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {prompt.isGeneratingImages ? 'Generating...' : 'Generate 4 Avatars'}
                </button>
              </div>

              {/* Failed Generation Count */}
              {prompt.failedCount > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Failed generations: {prompt.failedCount}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conversation History */}
      {conversation.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Conversation History</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {conversation.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-50 border-l-4 border-blue-400'
                    : 'bg-gray-50 border-l-4 border-gray-400'
                }`}
              >
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="text-sm text-gray-800">
                  {message.editedContent || message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 