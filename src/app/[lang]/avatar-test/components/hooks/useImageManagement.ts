import { useState } from 'react';
import { ExistingImage, GeneratedAvatar } from '../types';

export const useImageManagement = () => {
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [selectedAvatars, setSelectedAvatars] = useState<(ExistingImage | GeneratedAvatar)[]>([]);

  // Load existing images from the generated-images directory
  const loadExistingImages = async () => {
    try {
      const response = await fetch('/api/list-existing-images');
      const data = await response.json();
      
      if (data.success) {
        setExistingImages(data.images || []);
      } else {
        console.error('Failed to load existing images:', data.error);
      }
    } catch (error) {
      console.error('Error loading existing images:', error);
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
    
    if (isSelected) {
      // Remove from selection
      setSelectedAvatars(prev => prev.filter(avatar => avatar.id !== image.id));
      const updatedImages = existingImages.map(img => ({
        ...img,
        selected: img.id === image.id ? false : img.selected
      }));
      setExistingImages(updatedImages);
    } else {
      // Add to selection
      setSelectedAvatars(prev => [...prev, image]);
      const updatedImages = existingImages.map(img => ({
        ...img,
        selected: img.id === image.id ? true : img.selected
      }));
      setExistingImages(updatedImages);
    }
  };

  // Select a generated avatar (toggle selection)
  const selectGeneratedAvatar = (avatar: GeneratedAvatar) => {
    const isSelected = selectedAvatars.some(selected => selected.id === avatar.id);
    
    if (isSelected) {
      setSelectedAvatars(prev => prev.filter(selected => selected.id !== avatar.id));
    } else {
      setSelectedAvatars(prev => [...prev, avatar]);
    }
  };

  const selectAllImages = () => {
    const unselectedImages = existingImages.filter(img => !img.selected);
    setSelectedAvatars(prev => [...prev, ...unselectedImages]);
    setExistingImages(prev => prev.map(img => ({ ...img, selected: true })));
  };

  const clearSelection = () => {
    setSelectedAvatars([]);
    setExistingImages(prev => prev.map(img => ({ ...img, selected: false })));
  };

  const selectAllGeneratedAvatars = () => {
    // This would need to be implemented based on the current avatarPrompts state
    // For now, keeping it simple
  };

  return {
    existingImages,
    selectedAvatars,
    setExistingImages,
    setSelectedAvatars,
    loadExistingImages,
    handleFileUpload,
    selectExistingImage,
    selectGeneratedAvatar,
    selectAllImages,
    clearSelection,
    selectAllGeneratedAvatars
  };
}; 