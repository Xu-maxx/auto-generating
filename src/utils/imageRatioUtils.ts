export interface ImageDimensions {
  width: number;
  height: number;
  ratio: number;
}

export interface RatioOption {
  value: string;
  label: string;
  width: number;
  height: number;
  ratio: number;
}

export interface CombinedRatioResolutionOption {
  id: string; // unique identifier like "16:9-1920x1080"
  aspectRatio: string; // like "16:9"
  width: number;
  height: number;
  ratio: number;
  label: string; // like "16:9 • 1920×1080"
  description: string; // like "(HD Landscape)"
  isDefault?: boolean; // mark default option for each aspect ratio
}

// Common aspect ratios with their standard resolutions
export const ASPECT_RATIOS: RatioOption[] = [
  { value: '16:9', label: '16:9 (Landscape)', width: 1920, height: 1080, ratio: 16/9 },
  { value: '9:16', label: '9:16 (Portrait)', width: 1080, height: 1920, ratio: 9/16 },
  { value: '1:1', label: '1:1 (Square)', width: 1024, height: 1024, ratio: 1 },
  { value: '4:3', label: '4:3 (Traditional)', width: 1024, height: 768, ratio: 4/3 },
  { value: '3:4', label: '3:4 (Portrait)', width: 768, height: 1024, ratio: 3/4 },
  { value: '21:9', label: '21:9 (Ultrawide)', width: 2560, height: 1080, ratio: 21/9 },
  { value: '3:2', label: '3:2 (Photo)', width: 1512, height: 1008, ratio: 3/2 },
  { value: '2:3', label: '2:3 (Portrait Photo)', width: 1008, height: 1512, ratio: 2/3 },
];

// Alternative resolutions for each aspect ratio
export const RESOLUTION_OPTIONS: Record<string, Array<{width: number, height: number, label: string}>> = {
  '16:9': [
    { width: 1920, height: 1080, label: '1920×1080 (HD)' },
    { width: 1280, height: 720, label: '1280×720 (720p)' },
    { width: 1024, height: 576, label: '1024×576' },
  ],
  '9:16': [
    { width: 1080, height: 1920, label: '1080×1920 (Vertical HD)' },
    { width: 720, height: 1280, label: '720×1280' },
    { width: 576, height: 1024, label: '576×1024' },
  ],
  '1:1': [
    { width: 1024, height: 1024, label: '1024×1024' },
    { width: 768, height: 768, label: '768×768' },
    { width: 512, height: 512, label: '512×512' },
  ],
  '4:3': [
    { width: 1024, height: 768, label: '1024×768' },
    { width: 800, height: 600, label: '800×600' },
    { width: 640, height: 480, label: '640×480' },
  ],
  '3:4': [
    { width: 768, height: 1024, label: '768×1024' },
    { width: 600, height: 800, label: '600×800' },
    { width: 480, height: 640, label: '480×640' },
  ],
  '21:9': [
    { width: 2560, height: 1080, label: '2560×1080' },
    { width: 1920, height: 822, label: '1920×822' },
    { width: 1680, height: 720, label: '1680×720' },
  ],
  '3:2': [
    { width: 1512, height: 1008, label: '1512×1008' },
    { width: 1152, height: 768, label: '1152×768' },
    { width: 864, height: 576, label: '864×576' },
  ],
  '2:3': [
    { width: 1008, height: 1512, label: '1008×1512' },
    { width: 768, height: 1152, label: '768×1152' },
    { width: 576, height: 864, label: '576×864' },
  ],
};

// Combined aspect ratio and resolution options for the new unified selector
export const COMBINED_RATIO_RESOLUTION_OPTIONS: CombinedRatioResolutionOption[] = [
  // 16:9 Landscape options
  { id: '16:9-1920x1080', aspectRatio: '16:9', width: 1920, height: 1080, ratio: 16/9, label: '16:9 • 1920×1080', description: '(Full HD Landscape)', isDefault: true },
  { id: '16:9-1280x720', aspectRatio: '16:9', width: 1280, height: 720, ratio: 16/9, label: '16:9 • 1280×720', description: '(HD Landscape)' },
  { id: '16:9-1024x576', aspectRatio: '16:9', width: 1024, height: 576, ratio: 16/9, label: '16:9 • 1024×576', description: '(Compact Landscape)' },
  
  // 9:16 Portrait options
  { id: '9:16-1080x1920', aspectRatio: '9:16', width: 1080, height: 1920, ratio: 9/16, label: '9:16 • 1080×1920', description: '(Full HD Portrait)', isDefault: true },
  { id: '9:16-720x1280', aspectRatio: '9:16', width: 720, height: 1280, ratio: 9/16, label: '9:16 • 720×1280', description: '(HD Portrait)' },
  { id: '9:16-576x1024', aspectRatio: '9:16', width: 576, height: 1024, ratio: 9/16, label: '9:16 • 576×1024', description: '(Compact Portrait)' },
  
  // 1:1 Square options
  { id: '1:1-1024x1024', aspectRatio: '1:1', width: 1024, height: 1024, ratio: 1, label: '1:1 • 1024×1024', description: '(Square HD)', isDefault: true },
  { id: '1:1-768x768', aspectRatio: '1:1', width: 768, height: 768, ratio: 1, label: '1:1 • 768×768', description: '(Square Medium)' },
  { id: '1:1-512x512', aspectRatio: '1:1', width: 512, height: 512, ratio: 1, label: '1:1 • 512×512', description: '(Square Compact)' },
  
  // 4:3 Traditional options
  { id: '4:3-1024x768', aspectRatio: '4:3', width: 1024, height: 768, ratio: 4/3, label: '4:3 • 1024×768', description: '(Traditional HD)', isDefault: true },
  { id: '4:3-800x600', aspectRatio: '4:3', width: 800, height: 600, ratio: 4/3, label: '4:3 • 800×600', description: '(Traditional Medium)' },
  { id: '4:3-640x480', aspectRatio: '4:3', width: 640, height: 480, ratio: 4/3, label: '4:3 • 640×480', description: '(Traditional Compact)' },
  
  // 3:4 Portrait Traditional options
  { id: '3:4-768x1024', aspectRatio: '3:4', width: 768, height: 1024, ratio: 3/4, label: '3:4 • 768×1024', description: '(Portrait Traditional HD)', isDefault: true },
  { id: '3:4-600x800', aspectRatio: '3:4', width: 600, height: 800, ratio: 3/4, label: '3:4 • 600×800', description: '(Portrait Traditional Medium)' },
  { id: '3:4-480x640', aspectRatio: '3:4', width: 480, height: 640, ratio: 3/4, label: '3:4 • 480×640', description: '(Portrait Traditional Compact)' },
  
  // 21:9 Ultrawide options
  { id: '21:9-2560x1080', aspectRatio: '21:9', width: 2560, height: 1080, ratio: 21/9, label: '21:9 • 2560×1080', description: '(Ultrawide HD)', isDefault: true },
  { id: '21:9-1920x822', aspectRatio: '21:9', width: 1920, height: 822, ratio: 21/9, label: '21:9 • 1920×822', description: '(Ultrawide Medium)' },
  { id: '21:9-1680x720', aspectRatio: '21:9', width: 1680, height: 720, ratio: 21/9, label: '21:9 • 1680×720', description: '(Ultrawide Compact)' },
  
  // 3:2 Photo options
  { id: '3:2-1512x1008', aspectRatio: '3:2', width: 1512, height: 1008, ratio: 3/2, label: '3:2 • 1512×1008', description: '(Photo HD)', isDefault: true },
  { id: '3:2-1152x768', aspectRatio: '3:2', width: 1152, height: 768, ratio: 3/2, label: '3:2 • 1152×768', description: '(Photo Medium)' },
  { id: '3:2-864x576', aspectRatio: '3:2', width: 864, height: 576, ratio: 3/2, label: '3:2 • 864×576', description: '(Photo Compact)' },
  
  // 2:3 Portrait Photo options
  { id: '2:3-1008x1512', aspectRatio: '2:3', width: 1008, height: 1512, ratio: 2/3, label: '2:3 • 1008×1512', description: '(Portrait Photo HD)', isDefault: true },
  { id: '2:3-768x1152', aspectRatio: '2:3', width: 768, height: 1152, ratio: 2/3, label: '2:3 • 768×1152', description: '(Portrait Photo Medium)' },
  { id: '2:3-576x864', aspectRatio: '2:3', width: 576, height: 864, ratio: 2/3, label: '2:3 • 576×864', description: '(Portrait Photo Compact)' },
];

/**
 * Detect image dimensions from a data URL or image element
 */
export const detectImageDimensions = (imageDataUrl: string): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const dimensions: ImageDimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        ratio: img.naturalWidth / img.naturalHeight
      };
      resolve(dimensions);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for dimension detection'));
    };
    
    img.src = imageDataUrl;
  });
};

/**
 * Find the closest matching aspect ratio for given dimensions
 */
export const findClosestAspectRatio = (dimensions: ImageDimensions): RatioOption => {
  let closestRatio = ASPECT_RATIOS[0];
  let smallestDifference = Math.abs(dimensions.ratio - closestRatio.ratio);
  
  for (const aspectRatio of ASPECT_RATIOS.slice(1)) {
    const difference = Math.abs(dimensions.ratio - aspectRatio.ratio);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestRatio = aspectRatio;
    }
  }
  
  return closestRatio;
};

/**
 * Get the best resolution for a given aspect ratio, considering the original image size
 */
export const getBestResolution = (aspectRatio: string, originalDimensions?: ImageDimensions): {width: number, height: number} => {
  const resolutions = RESOLUTION_OPTIONS[aspectRatio];
  if (!resolutions || resolutions.length === 0) {
    // Fallback to the first option from ASPECT_RATIOS
    const fallback = ASPECT_RATIOS.find(ar => ar.value === aspectRatio);
    return fallback ? { width: fallback.width, height: fallback.height } : { width: 1024, height: 1024 };
  }
  
  if (!originalDimensions) {
    return resolutions[0]; // Return the first (highest quality) option
  }
  
  // Find the resolution closest to the original image size
  const originalArea = originalDimensions.width * originalDimensions.height;
  let bestResolution = resolutions[0];
  let smallestAreaDifference = Math.abs(originalArea - (bestResolution.width * bestResolution.height));
  
  for (const resolution of resolutions.slice(1)) {
    const areaDifference = Math.abs(originalArea - (resolution.width * resolution.height));
    if (areaDifference < smallestAreaDifference) {
      smallestAreaDifference = areaDifference;
      bestResolution = resolution;
    }
  }
  
  return bestResolution;
};

/**
 * Convert aspect ratio to runway format (width:height)
 */
export const toRunwayRatio = (aspectRatio: string, resolution?: {width: number, height: number}): string => {
  // If resolution is provided, use it directly
  if (resolution) {
    return `${resolution.width}:${resolution.height}`;
  }
  
  // Otherwise find the aspect ratio and use its default resolution
  const ratioOption = ASPECT_RATIOS.find(ar => ar.value === aspectRatio);
  if (ratioOption) {
    return `${ratioOption.width}:${ratioOption.height}`;
  }
  return '1080:1920'; // Default fallback
};

/**
 * Find a combined option by its ID
 */
export const findCombinedOptionById = (id: string): CombinedRatioResolutionOption | null => {
  return COMBINED_RATIO_RESOLUTION_OPTIONS.find(option => option.id === id) || null;
};

/**
 * Find the best combined option for detected dimensions
 */
export const findBestCombinedOption = (dimensions: ImageDimensions): CombinedRatioResolutionOption => {
  // First find the closest aspect ratio
  const closestRatio = findClosestAspectRatio(dimensions);
  
  // Get all options for this aspect ratio
  const ratioOptions = COMBINED_RATIO_RESOLUTION_OPTIONS.filter(
    option => option.aspectRatio === closestRatio.value
  );
  
  if (ratioOptions.length === 0) {
    return COMBINED_RATIO_RESOLUTION_OPTIONS[0]; // Fallback to first option
  }
  
  // Find the resolution closest to the original image size
  const originalArea = dimensions.width * dimensions.height;
  let bestOption = ratioOptions[0];
  let smallestAreaDifference = Math.abs(originalArea - (bestOption.width * bestOption.height));
  
  for (const option of ratioOptions.slice(1)) {
    const areaDifference = Math.abs(originalArea - (option.width * option.height));
    if (areaDifference < smallestAreaDifference) {
      smallestAreaDifference = areaDifference;
      bestOption = option;
    }
  }
  
  return bestOption;
};

/**
 * Get the default option for a specific aspect ratio
 */
export const getDefaultCombinedOption = (aspectRatio: string): CombinedRatioResolutionOption | null => {
  return COMBINED_RATIO_RESOLUTION_OPTIONS.find(
    option => option.aspectRatio === aspectRatio && option.isDefault
  ) || null;
};

/**
 * Create a visual rectangle icon style for an aspect ratio
 */
export const getRatioIconStyle = (ratio: number): string => {
  // Base size for the rectangle
  const baseSize = 20;
  
  if (ratio > 1) {
    // Landscape: wider than tall
    const width = baseSize;
    const height = Math.round(baseSize / ratio);
    return `width: ${width}px; height: ${height}px;`;
  } else if (ratio < 1) {
    // Portrait: taller than wide
    const width = Math.round(baseSize * ratio);
    const height = baseSize;
    return `width: ${width}px; height: ${height}px;`;
  } else {
    // Square
    return `width: ${baseSize}px; height: ${baseSize}px;`;
  }
}; 