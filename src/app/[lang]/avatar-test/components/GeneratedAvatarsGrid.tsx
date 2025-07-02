import Image from 'next/image';
import { AvatarPrompt, GeneratedAvatar, ExistingImage } from './types';

interface GeneratedAvatarsGridProps {
  avatarPrompts: AvatarPrompt[];
  selectedAvatars: (ExistingImage | GeneratedAvatar)[];
  onSelectAvatar: (avatar: GeneratedAvatar) => void;
  onSelectAllGenerated: () => void;
}

export default function GeneratedAvatarsGrid({
  avatarPrompts,
  selectedAvatars,
  onSelectAvatar,
  onSelectAllGenerated
}: GeneratedAvatarsGridProps) {
  const allGeneratedAvatars = avatarPrompts.flatMap(prompt => prompt.generatedImages);
  const selectedGeneratedCount = selectedAvatars.filter(avatar => 
    allGeneratedAvatars.some(gen => gen.id === avatar.id)
  ).length;

  if (allGeneratedAvatars.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-800">Generated Avatars</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {selectedGeneratedCount} of {allGeneratedAvatars.length} selected
          </span>
          <button
            onClick={onSelectAllGenerated}
            className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          >
            Select All Generated
          </button>
        </div>
      </div>

      {avatarPrompts.map((prompt) => (
        prompt.generatedImages.length > 0 && (
          <div key={prompt.id} className="mb-6 last:mb-0">
            <h4 className="text-md font-medium text-gray-700 mb-3">
              From Prompt #{prompt.id}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {prompt.generatedImages.map((avatar) => {
                const isSelected = selectedAvatars.some(selected => selected.id === avatar.id);
                
                return (
                  <div
                    key={avatar.id}
                    onClick={() => onSelectAvatar(avatar)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      isSelected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square">
                      <Image
                        src={avatar.url}
                        alt={avatar.filename}
                        width={150}
                        height={150}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="p-2 bg-white">
                      <p className="text-xs text-gray-600 truncate">{avatar.filename}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}
    </div>
  );
} 