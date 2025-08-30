import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { cn } from "@/lib/utils";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { useToast } from '@/hooks/useToast';

interface ImageGalleryProps {
  images: string[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}

/**
 * ImageGallery component with pinch zoom functionality
 *
 * Features:
 * - Pinch to zoom on touch devices
 * - Mouse wheel zoom on desktop
 * - Double-click to toggle zoom
 * - Pan when zoomed in
 * - Zoom controls (desktop: top-right, mobile: bottom-center)
 * - Zoom resets when changing images
 * - Supports min/max zoom limits (0.5x to 5x)
 */

// Custom DialogContent without the automatic close button
const ImageGalleryDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/80" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-[100001] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background shadow-lg",
        className
      )}
      {...props}
    >
      {children}
      {/* No automatic close button */}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ImageGalleryDialogContent.displayName = "ImageGalleryDialogContent";

// Zoom controls component that uses the useControls hook
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/30 bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          zoomIn();
        }}
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/30 bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          zoomOut();
        }}
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/30 bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          resetTransform();
        }}
        title="Reset zoom"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </>
  );
}

export function ImageGallery({ images, isOpen, onClose, initialIndex = 0 }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside the main content container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrevious();
    } else if (e.key === 'ArrowRight') {
      goToNext();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      const imageUrl = images[currentIndex];
      if (!imageUrl) {
        throw new Error('No image URL provided');
      }

      // Extract filename from URL or create a default one
      const urlParts = imageUrl.split('/');
      const urlFilename = urlParts[urlParts.length - 1] || '';

      // Remove query parameters first
      const cleanFilename = urlFilename.split('?')[0] || '';

      // Check if the clean filename has a valid image extension
      const hasExtension = cleanFilename.includes('.') &&
        cleanFilename.split('.').pop()?.match(/^(jpg|jpeg|png|gif|webp|svg)$/i) !== undefined;

      const filename = hasExtension
        ? cleanFilename
        : `chat-image-${currentIndex + 1}.jpg`;

      // Try to fetch the image and download it as a blob (handles CORS better)
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Network response was not ok');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);

        toast({
          title: 'Download started',
          description: `Downloading ${filename}`,
        });
      } catch (fetchError) {
        // Fallback: try direct download (may not work for CORS images)
        console.warn('Fetch download failed, trying direct download:', fetchError);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Download started',
          description: `Downloading ${filename} (fallback method)`,
        });
      }
    } catch (error) {
      console.error('Download failed:', error);

      toast({
        title: 'Download failed',
        description: 'Opening image in new tab instead',
        variant: 'destructive',
      });

      // Final fallback: open in new tab
      window.open(images[currentIndex], '_blank', 'noopener,noreferrer');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInNewTab = () => {
    const imageUrl = images[currentIndex];
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  };

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  if (!isOpen || images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
      <ImageGalleryDialogContent
        className="p-0 bg-background/85 border-0"
        onKeyDown={handleKeyDown}
        style={{
          // Ensure the gallery covers the full viewport including safe areas on mobile
          top: '0',
          left: '0',
          transform: 'none',
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
        }}
      >
        <VisuallyHidden.Root>
          <DialogPrimitive.Title>
            Image Gallery - Viewing image {currentIndex + 1} of {images.length}
          </DialogPrimitive.Title>
        </VisuallyHidden.Root>
        <div className="relative flex items-center justify-center overflow-hidden" onClick={onClose}>
          {/* Content container - this defines the boundaries for button positioning */}
          <div
            ref={contentRef}
            className="relative h-full sm:h-[95%] flex items-center justify-center md:p-8 2xl:max-w-[60vw] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - positioned within content container */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 sm:top-4 right-2 sm:right-7 z-50 text-white hover:bg-white/20 bg-black/30"
              style={{
                // Account for mobile safe area and navigation
                top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>

            {/* Action buttons - positioned within content container */}
            <div
              className="absolute top-2 sm:top-4 left-2 sm:left-7 z-50 flex gap-2"
              style={{
                // Account for mobile safe area and navigation
                top: 'max(0.5rem, env(safe-area-inset-top, 0px))',
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 bg-black/30"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={isDownloading}
                title={isDownloading ? "Downloading..." : "Download image"}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 bg-black/30"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenInNewTab();
                }}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation buttons - positioned within content container */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 bg-black/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                >
                  <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 bg-black/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                >
                  <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
                </Button>
              </>
            )}

            {/* Main image with zoom functionality */}
            <div className="w-full h-full flex items-center justify-center overflow-block">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                wheel={{ step: 0.1 }}
                pinch={{ step: 5 }}
                doubleClick={{ mode: "toggle", step: 0.7 }}
                panning={{
                  velocityDisabled: true,
                  // Disable panning when not zoomed to allow navigation gestures
                  disabled: false
                }}
                // Reset transform when image changes
                key={currentIndex}
                centerOnInit={true}
                limitToBounds={true}
                centerZoomedOut={true}
              >
              {/* Zoom controls positioned under the image */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-black/50 backdrop-blur-sm rounded-full p-1 flex gap-1">
                  <ZoomControls />
                </div>
              </div>

              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img
                  src={images[currentIndex]}
                  alt={`Chat image ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>

          {/* Image counter and thumbnail navigation - positioned within content container */}
          {images.length > 1 && (
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
              style={{
                // Account for mobile safe area and zoom controls
                bottom: 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 5rem))',
              }}
            >
              {/* Image counter */}
              <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} of {images.length}
              </div>

              {/* Thumbnail navigation */}
              <div className="flex gap-2 max-w-[calc(100vw-4rem)] overflow-x-auto px-2">
                <div className="flex gap-2 pb-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(index);
                      }}
                      className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentIndex
                          ? 'border-white shadow-lg'
                          : 'border-white/30 hover:border-white/60'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </ImageGalleryDialogContent>
    </DialogPrimitive.Root>
  );
}