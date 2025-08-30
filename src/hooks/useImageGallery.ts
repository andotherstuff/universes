import { useState, useCallback } from 'react';

export function useImageGallery() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [allImages, setAllImages] = useState<string[]>([]);

  const handleImageClick = useCallback((imageUrl: string, currentImages: string[] = allImages) => {
    const imageIndex = currentImages.indexOf(imageUrl);
    if (imageIndex !== -1) {
      setGalleryIndex(imageIndex);
      setGalleryOpen(true);
    } else {
      // Add the new image to the list and open gallery
      const newImages = [...currentImages, imageUrl];
      setAllImages(newImages);
      setGalleryIndex(newImages.length - 1);
      setGalleryOpen(true);
    }
  }, [allImages]);

  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setGalleryOpen(false);
  }, []);

  const updateImages = useCallback((images: string[]) => {
    setAllImages(images);
  }, []);

  return {
    galleryOpen,
    galleryIndex,
    allImages,
    handleImageClick,
    openGallery,
    closeGallery,
    updateImages,
    setGalleryIndex
  };
}