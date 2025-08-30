import React, { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export function ChatImage({ src, alt, className, onClick, onError }: ChatImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setHasError(true);
    onError?.(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!hasError && !isLoading) {
      e.stopPropagation();
      onClick?.();
    }
  };

  return (
    <>
      {/* Preview thumbnail */}
      <div
        className={cn(
          "relative inline-block cursor-pointer group overflow-hidden rounded-lg max-w-xs transition-all duration-300 hover:shadow-lg hover:scale-105",
          className
        )}
        onClick={handleClick}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg">
            <div className="text-center">
              <div className="text-2xl mb-1">🖼️</div>
              <p className="text-xs text-muted-foreground">Failed to load</p>
            </div>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="w-full h-48 object-cover transition-all duration-300 hover:opacity-90"
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
            style={{ transformOrigin: 'center center' }}
          />
        )}

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-black/0 opacity-0 group-hover:opacity-10 transition-opacity duration-200 pointer-events-none rounded-lg" />
      </div>
    </>
  );
}