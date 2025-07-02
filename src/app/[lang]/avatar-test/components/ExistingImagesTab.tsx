import { useRef } from 'react';
import Image from 'next/image';
import { ExistingImage, GeneratedAvatar } from './types';

interface ExistingImagesTabProps {
  existingImages: ExistingImage[];
  selectedAvatars: (ExistingImage | GeneratedAvatar)[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectImage: (image: ExistingImage) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export default function ExistingImagesTab({
  existingImages,
  selectedAvatars,
  fileInputRef,
  onFileUpload,
  onSelectImage,
  onSelectAll,
  onClearSelection
}: ExistingImagesTabProps) {
  const selectedExistingCount = selectedAvatars.filter(avatar => 
    existingImages.some(img => img.id === avatar.id)
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Choose from Existing Images</h2>
        
        {/* Upload New Images */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Upload Images
            </button>
          </div>
          
          {/* Selection Controls */}
          {existingImages.length > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">
                {selectedExistingCount} of {existingImages.length} selected
              </span>
              <button
                onClick={onSelectAll}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={onClearSelection}
                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={onFileUpload}
            className="hidden"
          />
        </div>

        {/* Images Grid */}
        {existingImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {existingImages.map((image) => (
              <div
                key={image.id}
                onClick={() => onSelectImage(image)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  image.selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="aspect-square">
                  <Image
                    src={image.url}
                    alt={image.filename}
                    width={150}
                    height={150}
                    className="w-full h-full object-cover"
                  />
                </div>
                {image.selected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="p-2 bg-white">
                  <p className="text-xs text-gray-600 truncate">{image.filename}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No images available. Upload some images or load existing ones.</p>
          </div>
        )}
      </div>
    </div>
  );
} 