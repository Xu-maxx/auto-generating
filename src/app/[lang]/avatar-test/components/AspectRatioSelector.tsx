import { useState, useRef, useEffect } from 'react';
import { COMBINED_RATIO_RESOLUTION_OPTIONS, CombinedRatioResolutionOption } from '@/utils/imageRatioUtils';

interface AspectRatioSelectorProps {
  selectedOption: CombinedRatioResolutionOption;
  onRatioResolutionChange: (aspectRatio: string, resolution: {width: number, height: number}) => void;
  className?: string;
}

export default function AspectRatioSelector({
  selectedOption,
  onRatioResolutionChange,
  className = ''
}: AspectRatioSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside the dropdown to close it
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

  const handleOptionChange = (option: CombinedRatioResolutionOption) => {
    onRatioResolutionChange(option.aspectRatio, { width: option.width, height: option.height });
    setIsDropdownOpen(false);
  };

  return (
    <div className={`${className}`}>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image Aspect Ratio & Resolution
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
                  width: selectedOption.ratio > 1 ? '16px' : `${Math.round(16 * selectedOption.ratio)}px`,
                  height: selectedOption.ratio > 1 ? `${Math.round(16 / selectedOption.ratio)}px` : '16px'
                }}
              ></div>
              <span>
                {selectedOption.label} {selectedOption.description}
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
                  onClick={() => handleOptionChange(option)}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center space-x-2 hover:bg-gray-50 ${
                    selectedOption.id === option.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
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
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Choose the aspect ratio and resolution for generated avatar images. This will affect the dimensions of all generated images.
      </p>
    </div>
  );
} 