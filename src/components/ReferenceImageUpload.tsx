'use client';

import { useState, useRef } from 'react';
import { ReferenceImage } from '@/types/session';

interface ReferenceImageUploadProps {
  referenceImages: ReferenceImage[];
  onReferenceImagesChange: (images: ReferenceImage[]) => void;
  maxImages?: number;
  dict: any; // Dictionary for translations
}

export default function ReferenceImageUpload({ 
  referenceImages, 
  onReferenceImagesChange,
  maxImages = 4,
  dict
}: ReferenceImageUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractVideoFrame = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Seek to 1 second or 10% of video duration, whichever is smaller
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(frameDataUrl);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      
      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const uploadToOSS = async (file: File, filename: string): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', filename);

      const response = await fetch('/api/upload-reference-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload to OSS');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      return result.url;
    } catch (error) {
      console.error('OSS upload error:', error);
      throw error;
    }
  };

  const handleFileSelect = async (files: FileList) => {
    if (referenceImages.length >= maxImages) {
      alert(dict.promptGenerator.referenceImages.maxImagesAlert.replace('{max}', maxImages.toString()));
      return;
    }

    const remainingSlots = maxImages - referenceImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    setIsProcessing(true);

    try {
      const newImages: ReferenceImage[] = [];

      for (const file of filesToProcess) {
        const isVideo = file.type.startsWith('video/');
        const id = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let url = URL.createObjectURL(file);
        let extractedFrame: string | undefined;

        // Extract frame if it's a video
        if (isVideo) {
          try {
            extractedFrame = await extractVideoFrame(file);
          } catch (error) {
            console.error('Failed to extract video frame:', error);
            alert(dict.promptGenerator.referenceImages.failedToExtractFrame.replace('{filename}', file.name));
            continue;
          }
        }

        // Try to upload to OSS for public access
        try {
          const publicUrl = await uploadToOSS(file, file.name);
          url = publicUrl;
        } catch (error) {
          console.warn('OSS upload failed, using local URL:', error);
          // Continue with local URL if OSS upload fails
        }

        const referenceImage: ReferenceImage = {
          id,
          filename: file.name,
          url,
          originalFile: file,
          isVideo,
          extractedFrame
        };

        newImages.push(referenceImage);
      }

      onReferenceImagesChange([...referenceImages, ...newImages]);
    } catch (error) {
      console.error('Error processing reference images:', error);
      alert(dict.promptGenerator.referenceImages.failedToProcessImages);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeReferenceImage = (id: string) => {
    const updatedImages = referenceImages.filter(img => img.id !== id);
    onReferenceImagesChange(updatedImages);
  };

  const clearAllReferenceImages = () => {
    onReferenceImagesChange([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-semibold text-gray-700">
          {dict.promptGenerator.referenceImages.title
            .replace('{current}', referenceImages.length.toString())
            .replace('{max}', maxImages.toString())}
        </h4>
        {referenceImages.length > 0 && (
          <button
            onClick={clearAllReferenceImages}
            className="text-sm text-red-600 hover:text-red-800 transition-colors"
          >
            {dict.promptGenerator.referenceImages.clearAll}
          </button>
        )}
      </div>

      <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p><strong>{dict.promptGenerator.referenceImages.description.replace('{max}', maxImages.toString())}</strong></p>
      </div>

      {/* Upload Area */}
      {referenceImages.length < maxImages && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              handleFileSelect(files);
            }
          }}
        >
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div className="text-gray-600">
            {isProcessing ? (
              <span className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>{dict.promptGenerator.referenceImages.processingImages}</span>
              </span>
            ) : (
              <>
                <span className="font-medium">{dict.promptGenerator.referenceImages.clickToUpload}</span> {dict.promptGenerator.referenceImages.dragAndDrop}
                <br />
                <span className="text-sm">{dict.promptGenerator.referenceImages.supportedFiles.replace('{remaining}', (maxImages - referenceImages.length).toString())}</span>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files);
          }
        }}
        className="hidden"
      />

      {/* Reference Images Grid */}
      {referenceImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {referenceImages.map((image) => (
            <div key={image.id} className="relative group">
              <div className="relative w-full h-24 bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-300">
                <img
                  src={image.isVideo && image.extractedFrame ? image.extractedFrame : image.url}
                  alt={image.filename}
                  className="w-full h-full object-cover"
                />
                {/* Video indicator */}
                {image.isVideo && (
                  <div className="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 py-0.5 rounded">
                    {dict.promptGenerator.referenceImages.videoLabel}
                  </div>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removeReferenceImage(image.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">{image.filename}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 