'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { 
  detectImageDimensions, 
  findClosestAspectRatio, 
  getBestResolution,
  ASPECT_RATIOS,
  RESOLUTION_OPTIONS,
  COMBINED_RATIO_RESOLUTION_OPTIONS,
  findCombinedOptionById,
  findBestCombinedOption,
  getRatioIconStyle,
  type ImageDimensions,
  type RatioOption,
  type CombinedRatioResolutionOption
} from '@/utils/imageRatioUtils';

interface FileUploadProps {
  onImageExtracted: (imageDataUrl: string) => void;
  imageDataUrl?: string;
  onReset?: () => void;
  dict: any; // Dictionary for translations
  // New props for ratio/resolution
  onRatioResolutionChange?: (aspectRatio: string, resolution: {width: number, height: number}) => void;
  selectedAspectRatio?: string;
  selectedResolution?: {width: number, height: number};
}

export default function FileUpload({ 
  onImageExtracted, 
  imageDataUrl, 
  onReset, 
  dict,
  onRatioResolutionChange,
  selectedAspectRatio,
  selectedResolution
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(imageDataUrl || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [selectedCombinedOption, setSelectedCombinedOption] = useState<CombinedRatioResolutionOption>(
    COMBINED_RATIO_RESOLUTION_OPTIONS[0] // Default to first option (16:9 1920×1080)
  );
  const [autoDetectedOption, setAutoDetectedOption] = useState<CombinedRatioResolutionOption | null>(null);
  const [hasDetectedRatio, setHasDetectedRatio] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Legacy state for backward compatibility (derived from selectedCombinedOption)
  const aspectRatio = selectedCombinedOption.aspectRatio;
  const resolution = { width: selectedCombinedOption.width, height: selectedCombinedOption.height };

  // Sync preview with session data when imageDataUrl changes
  useEffect(() => {
    setPreviewUrl(imageDataUrl || null);
  }, [imageDataUrl]);

  // Sync internal state with parent state only when it changes externally
  useEffect(() => {
    if (selectedAspectRatio && selectedAspectRatio !== aspectRatio) {
      // Find the default option for this aspect ratio
      const defaultOption = COMBINED_RATIO_RESOLUTION_OPTIONS.find(
        option => option.aspectRatio === selectedAspectRatio && option.isDefault
      );
      if (defaultOption) {
        setSelectedCombinedOption(defaultOption);
      }
    }
  }, [selectedAspectRatio, aspectRatio]);

  useEffect(() => {
    if (selectedResolution && 
        (selectedResolution.width !== resolution.width || selectedResolution.height !== resolution.height)) {
      // Find the option that matches this resolution
      const matchingOption = COMBINED_RATIO_RESOLUTION_OPTIONS.find(
        option => option.width === selectedResolution.width && option.height === selectedResolution.height
      );
      if (matchingOption) {
        setSelectedCombinedOption(matchingOption);
      }
    }
  }, [selectedResolution, resolution]);

  // Detect image dimensions when imageDataUrl changes
  useEffect(() => {
    if (imageDataUrl && !hasDetectedRatio) {
      console.log('🔍 FileUpload: Starting image dimension detection...', { 
        imageDataUrl: imageDataUrl.substring(0, 50) + '...', 
        hasDetectedRatio 
      });
      detectImageDimensions(imageDataUrl)
        .then((dimensions) => {
          console.log('📏 FileUpload: Detected dimensions:', dimensions);
          setImageDimensions(dimensions);
          const bestOption = findBestCombinedOption(dimensions);
          console.log('🎯 FileUpload: Best combined option found:', bestOption);
          setAutoDetectedOption(bestOption);
          
          // Auto-set the detected option
          setSelectedCombinedOption(bestOption);
          setHasDetectedRatio(true);
          
          // Notify parent of the detected settings
          if (onRatioResolutionChange) {
            console.log('📤 FileUpload: Notifying parent of ratio change:', bestOption.aspectRatio, { width: bestOption.width, height: bestOption.height });
            onRatioResolutionChange(bestOption.aspectRatio, { width: bestOption.width, height: bestOption.height });
          } else {
            console.log('⚠️ FileUpload: onRatioResolutionChange not provided');
          }
        })
        .catch((error) => {
          console.error('❌ FileUpload: Failed to detect image dimensions:', error);
        });
    }
  }, [imageDataUrl, hasDetectedRatio, onRatioResolutionChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const extractFrameFromVideo = useCallback((videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas) {
        reject(new Error('Video or canvas element not available'));
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const url = URL.createObjectURL(videoFile);
      video.src = url;

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        video.currentTime = 0.1; // Extract frame at 0.1 seconds
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Error loading video'));
      };
    });
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);
    setHasDetectedRatio(false); // Reset detection flag

    try {
      let imageDataUrl: string;

      if (file.type.startsWith('image/')) {
        // Handle image files
        const reader = new FileReader();
        imageDataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (file.type.startsWith('video/')) {
        // Handle video files - extract first frame
        imageDataUrl = await extractFrameFromVideo(file);
      } else {
        throw new Error('Unsupported file type');
      }

      setPreviewUrl(imageDataUrl);
      onImageExtracted(imageDataUrl);
    } catch (error) {
      console.error('Error processing file:', error);
      alert(dict.fileUpload.uploadError);
    } finally {
      setIsProcessing(false);
    }
  }, [extractFrameFromVideo, onImageExtracted, dict]);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageDimensions(null);
    setAutoDetectedOption(null);
    setHasDetectedRatio(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onReset) {
      onReset();
    }
  };

  const handleAspectRatioChange = (newAspectRatio: string) => {
    // Find the default option for this aspect ratio
    const defaultOption = COMBINED_RATIO_RESOLUTION_OPTIONS.find(
      option => option.aspectRatio === newAspectRatio && option.isDefault
    );
    if (defaultOption) {
      setSelectedCombinedOption(defaultOption);
      if (onRatioResolutionChange) {
        onRatioResolutionChange(defaultOption.aspectRatio, { width: defaultOption.width, height: defaultOption.height });
      }
    }
  };

  const handleCombinedOptionChange = (optionId: string) => {
    const option = findCombinedOptionById(optionId);
    if (option) {
      setSelectedCombinedOption(option);
      if (onRatioResolutionChange) {
        onRatioResolutionChange(option.aspectRatio, { width: option.width, height: option.height });
      }
    }
  };

  const handleResolutionChange = (newResolution: {width: number, height: number}) => {
    // Find the option that matches this resolution
    const matchingOption = COMBINED_RATIO_RESOLUTION_OPTIONS.find(
      option => option.width === newResolution.width && option.height === newResolution.height
    );
    if (matchingOption) {
      setSelectedCombinedOption(matchingOption);
      if (onRatioResolutionChange) {
        onRatioResolutionChange(matchingOption.aspectRatio, { width: matchingOption.width, height: matchingOption.height });
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        {previewUrl ? (
          <div className="space-y-4">
            <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-contain"
              />
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleButtonClick}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {dict.fileUpload.clickToUpload}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                {dict.fileUpload.reset}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-gray-500">
              {isProcessing ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p>{dict.fileUpload.processing}</p>
                </div>
              ) : (
                <>
                  <p className="text-lg font-semibold">{dict.fileUpload.dragDrop}</p>
                  <p className="text-sm">{dict.fileUpload.supportedFormats}</p>
                  <p className="text-xs text-gray-400">{dict.fileUpload.maxSize}</p>
                </>
              )}
            </div>
            {!isProcessing && (
              <button
                onClick={handleButtonClick}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                {dict.fileUpload.clickToUpload}
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Hidden video and canvas elements for frame extraction */}
      <video
        ref={videoRef}
        className="hidden"
        preload="metadata"
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Image Ratio and Resolution Selection - Show only when image is uploaded */}
      {previewUrl && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            {dict.fileUpload.imageSettings || 'Image Generation Settings'}
          </h4>
          
          {/* Display detected dimensions */}
          {imageDimensions && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="text-blue-800">
                <strong>{dict.fileUpload.detectedDimensions || 'Detected'}:</strong> {imageDimensions.width}×{imageDimensions.height}
                {autoDetectedOption && (
                  <span className="ml-2">
                    ({dict.fileUpload.suggestedRatio || 'Suggested'}: {autoDetectedOption.label})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Combined Aspect Ratio & Resolution Selection */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {dict.fileUpload.aspectRatioResolution || 'Aspect Ratio & Resolution'}
            </label>
            
            {/* Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-left flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className="border border-gray-400 bg-gray-200 rounded-sm flex-shrink-0"
                    style={{
                      width: selectedCombinedOption.ratio > 1 ? '16px' : `${Math.round(16 * selectedCombinedOption.ratio)}px`,
                      height: selectedCombinedOption.ratio > 1 ? `${Math.round(16 / selectedCombinedOption.ratio)}px` : '16px'
                    }}
                  ></div>
                  <span>
                    {selectedCombinedOption.label} {selectedCombinedOption.description}
                    {autoDetectedOption?.id === selectedCombinedOption.id && ' ★'}
                  </span>
                </div>
                <svg 
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Options */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                  {COMBINED_RATIO_RESOLUTION_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        handleCombinedOptionChange(option.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left flex items-center space-x-2 hover:bg-gray-50 ${
                        selectedCombinedOption.id === option.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <div 
                        className="border border-gray-400 bg-gray-200 rounded-sm flex-shrink-0"
                        style={{
                          width: option.ratio > 1 ? '16px' : `${Math.round(16 * option.ratio)}px`,
                          height: option.ratio > 1 ? `${Math.round(16 / option.ratio)}px` : '16px'
                        }}
                      ></div>
                      <span>
                        {option.label} {option.description}
                        {autoDetectedOption?.id === option.id && ' ★'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {dict.fileUpload.ratioResolutionTip || 'These settings will be used for both image generation and video creation. Video generation will automatically match the image ratio.'}
          </p>
        </div>
      )}

      {selectedFile && (
        <div className="mt-4 text-sm text-gray-600">
          <p>Selected: {selectedFile.name}</p>
          <p>Type: {selectedFile.type}</p>
          <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
    </div>
  );
} 