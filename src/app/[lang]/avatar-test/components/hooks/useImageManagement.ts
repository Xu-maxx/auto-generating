import { useState, useEffect } from 'react';
import { ExistingImage, GeneratedAvatar } from '../types';

interface UseImageManagementProps {
  sessionSelectedAvatars?: (ExistingImage | GeneratedAvatar)[];
  onSelectedAvatarsChange?: (avatars: (ExistingImage | GeneratedAvatar)[]) => void;
}

export const useImageManagement = ({ 
  sessionSelectedAvatars = [], 
  onSelectedAvatarsChange 
}: UseImageManagementProps = {}) => {
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [selectedAvatars, setSelectedAvatars] = useState<(ExistingImage | GeneratedAvatar)[]>(sessionSelectedAvatars);
  const [loading, setLoading] = useState(false);

  // Sync selected avatars from session when session changes
  useEffect(() => {
    setSelectedAvatars(sessionSelectedAvatars);
    // Update existing images selection state based on session
    setExistingImages(prev => prev.map(img => ({
      ...img,
      selected: sessionSelectedAvatars.some(avatar => avatar.id === img.id)
    })));
  }, [sessionSelectedAvatars]);

  // Load existing images from the generated-images directory
  const loadExistingImages = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading existing images...');
      
      const response = await fetch('/api/list-existing-images');
      const data = await response.json();
      
      if (data.success) {
        const images = data.images || [];
        console.log(`✅ Loaded ${images.length} existing images`);
        
        // Mark images as selected based on current session
        const imagesWithSelection = images.map((img: ExistingImage) => ({
          ...img,
          selected: sessionSelectedAvatars.some(avatar => avatar.id === img.id)
        }));
        
        setExistingImages(imagesWithSelection);
      } else {
        console.error('❌ Failed to load existing images:', data.error);
        setExistingImages([]);
      }
    } catch (error) {
      console.error('❌ Error loading existing images:', error);
      setExistingImages([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload for new images
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newImages: ExistingImage[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = URL.createObjectURL(file);
      
      const newImage: ExistingImage = {
        id: `uploaded_${Date.now()}_${i}`,
        url: imageUrl,
        filename: file.name,
        selected: false
      };
      
      newImages.push(newImage);
    }
    
    setExistingImages(prev => [...prev, ...newImages]);
  };

  // Select an existing image as avatar (toggle selection)
  const selectExistingImage = (image: ExistingImage) => {
    const isSelected = selectedAvatars.some(avatar => avatar.id === image.id);
    
    let newSelectedAvatars: (ExistingImage | GeneratedAvatar)[];
    
    if (isSelected) {
      // Remove from selection
      newSelectedAvatars = selectedAvatars.filter(avatar => avatar.id !== image.id);
      setExistingImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, selected: false } : img
      ));
    } else {
      // Add to selection
      newSelectedAvatars = [...selectedAvatars, image];
      setExistingImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, selected: true } : img
      ));
    }
    
    setSelectedAvatars(newSelectedAvatars);
    // Sync to session
    onSelectedAvatarsChange?.(newSelectedAvatars);
  };

  // Select a generated avatar (toggle selection)
  const selectGeneratedAvatar = (avatar: GeneratedAvatar) => {
    const isSelected = selectedAvatars.some(selected => selected.id === avatar.id);
    
    let newSelectedAvatars: (ExistingImage | GeneratedAvatar)[];
    
    if (isSelected) {
      newSelectedAvatars = selectedAvatars.filter(selected => selected.id !== avatar.id);
    } else {
      newSelectedAvatars = [...selectedAvatars, avatar];
    }
    
    setSelectedAvatars(newSelectedAvatars);
    // Sync to session
    onSelectedAvatarsChange?.(newSelectedAvatars);
  };

  const selectAllImages = () => {
    const unselectedImages = existingImages.filter(img => !img.selected);
    const newSelectedAvatars = [...selectedAvatars, ...unselectedImages];
    
    setSelectedAvatars(newSelectedAvatars);
    setExistingImages(prev => prev.map(img => ({ ...img, selected: true })));
    // Sync to session
    onSelectedAvatarsChange?.(newSelectedAvatars);
  };

  const clearSelection = () => {
    setSelectedAvatars([]);
    setExistingImages(prev => prev.map(img => ({ ...img, selected: false })));
    // Sync to session
    onSelectedAvatarsChange?.([]);
  };

  const selectAllGeneratedAvatars = () => {
    // This would need to be implemented based on the current avatarPrompts state
    // For now, keeping it simple
  };

  // Remove a specific avatar from selection
  const removeSelectedAvatar = (avatarId: string) => {
    const newSelectedAvatars = selectedAvatars.filter(avatar => avatar.id !== avatarId);
    
    setSelectedAvatars(newSelectedAvatars);
    setExistingImages(prev => prev.map(img => 
      img.id === avatarId ? { ...img, selected: false } : img
    ));
    // Sync to session
    onSelectedAvatarsChange?.(newSelectedAvatars);
  };

  return {
    existingImages,
    selectedAvatars,
    loading,
    loadExistingImages,
    handleFileUpload,
    selectExistingImage,
    selectGeneratedAvatar,
    selectAllImages,
    clearSelection,
    selectAllGeneratedAvatars,
    removeSelectedAvatar
  };
}; 