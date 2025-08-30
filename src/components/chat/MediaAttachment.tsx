import { useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChatImage } from '@/components/ChatImage';
import { cn } from '@/lib/utils';

interface MediaAttachmentProps {
  url: string;
  mimeType?: string;
  size?: number;
  name?: string;
  className?: string;
  onRemove?: () => void;
  showRemove?: boolean;
  onImageClick?: (url: string) => void;
}

export function MediaAttachment({
  url,
  mimeType,
  size,
  name,
  className,
  onRemove,
  showRemove = false,
  onImageClick
}: MediaAttachmentProps) {
  const [imageError, setImageError] = useState(false);

  // Determine media type from URL or mimeType
  const getMediaType = () => {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
    }

    // Fallback to URL extension
    const extension = url.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) return 'image';
    if (['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extension || '')) return 'audio';

    return 'file';
  };

  const mediaType = getMediaType();
  const fileName = name || url.split('/').pop() || 'Unknown file';
  const fileSize = size ? formatFileSize(size) : undefined;

  if (mediaType === 'image' && !imageError) {
    return (
      <div className={cn("relative inline-block max-w-sm", className)}>
        <ChatImage
          src={url}
          alt={fileName}
          className="max-h-64 w-auto"
          onError={() => setImageError(true)}
          onClick={() => onImageClick?.(url)}
        />
        {showRemove && onRemove && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
            onClick={onRemove}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        <div className="absolute bottom-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="w-6 h-6 rounded-full"
            onClick={() => window.open(url, '_blank')}
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={cn("relative inline-block max-w-sm", className)}>
        <video
          src={url}
          className="rounded-lg max-h-64 w-auto"
          controls
          preload="metadata"
        />
        {showRemove && onRemove && (
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
            onClick={onRemove}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  if (mediaType === 'audio') {
    return (
      <Card className={cn("p-3 max-w-sm", className)}>
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <p className="text-sm font-medium truncate">{fileName}</p>
            {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
          </div>
          <audio
            src={url}
            controls
            className="w-32"
            preload="metadata"
          />
          {showRemove && onRemove && (
            <Button
              variant="destructive"
              size="icon"
              className="w-6 h-6 rounded-full flex-shrink-0"
              onClick={onRemove}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Generic file attachment
  return (
    <Card className={cn("p-3 max-w-sm", className)}>
      <div className="flex items-center space-x-3">
        <div className="flex-1">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
          {mimeType && <p className="text-xs text-muted-foreground">{mimeType}</p>}
        </div>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => {
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              a.click();
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="w-8 h-8"
            onClick={() => window.open(url, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          {showRemove && onRemove && (
            <Button
              variant="destructive"
              size="icon"
              className="w-8 h-8"
              onClick={onRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}