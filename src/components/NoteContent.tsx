import { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { MediaAttachment } from '@/components/chat/MediaAttachment';
import { ProfileModal } from '@/components/user/ProfileModal';
import { InlineEvent } from '@/components/InlineEvent';
import { LinkPreview } from '@/components/LinkPreview';
import { ImageGallery } from '@/components/ImageGallery';
import { ChatImage } from '@/components/ChatImage';
import { useImageGallery } from '@/hooks/useImageGallery';
import { extractUrls } from '@/lib/urlUtils';
import { cn } from '@/lib/utils';

// Helper function to check if a URL is an image
function isImageURL(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    const searchParams = parsedUrl.search.toLowerCase();

    // Check file extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico'];
    if (imageExtensions.some(ext => pathname.endsWith(ext))) {
      return true;
    }

    // Check query parameters that might indicate images
    if (searchParams.includes('format=jpg') ||
        searchParams.includes('format=jpeg') ||
        searchParams.includes('format=png') ||
        searchParams.includes('format=gif') ||
        searchParams.includes('format=webp')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Helper function to detect if content contains markdown syntax
function containsMarkdown(text: string): boolean {
  // Check for common markdown patterns, but exclude user mentions
  const markdownPatterns = [
    /^#{1,6}\s+/m,           // Headers
    /\*\*.*?\*\*/,          // Bold
    /\*.*?\*/,              // Italic
    /`.*?`/,                // Inline code
    /```[\s\S]*?```/,       // Code blocks
    /^>\s+/m,               // Blockquotes
    /^[-*+]\s+/m,           // Lists
    /^\d+\.\s+/m,           // Numbered lists
    /!\[.*?\]\(.*?\)/,      // Images (but not user mentions)
    /\|.*?\|/,              // Tables
    /~~.*?~~/,              // Strikethrough
  ];

  // Check for markdown links, but exclude user mentions in the format @[name](pubkey)
  const hasMarkdownLinks = /\[.*?\]\(.*?\)/.test(text);
  const hasUserMentions = /@\[.*?\]\([0-9a-f]{64}\)/i.test(text);

  // Only consider it markdown if it has markdown links but no user mentions
  const hasRealMarkdown = markdownPatterns.some(pattern => pattern.test(text)) || (hasMarkdownLinks && !hasUserMentions);

  return hasRealMarkdown;
}

interface NoteContentProps {
  event: NostrEvent;
  className?: string;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

/** Parses content of text note events so that URLs and hashtags are linkified. */
export function NoteContent({
  event,
  className,
  onNavigateToDMs,
}: NoteContentProps) {
  const [selectedUserPubkey, setSelectedUserPubkey] = useState<string | undefined>(undefined);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const {
    galleryOpen,
    galleryIndex,
    allImages,
    handleImageClick,
    closeGallery,
    updateImages
  } = useImageGallery();

  const handleProfileChange = (newPubkey: string) => {
    setSelectedUserPubkey(newPubkey);
  };
  // Extract media attachments from imeta tags
  const mediaAttachments = useMemo(() => {
    return event.tags
      .filter(tag => tag[0] === 'imeta')
      .map(tag => {
        // Parse imeta tag format: ["imeta", "url <url>", "m <mime-type>", "x <hash>", ...]
        const params: Record<string, string> = {};
        for (let i = 1; i < tag.length; i++) {
          const param = tag[i];
          const spaceIndex = param.indexOf(' ');
          if (spaceIndex > 0) {
            const key = param.substring(0, spaceIndex);
            const value = param.substring(spaceIndex + 1);
            params[key] = value;
          }
        }
        return {
          url: params.url,
          mimeType: params.m,
          size: params.size ? parseInt(params.size) : undefined,
          name: params.alt || params.url?.split('/').pop() || 'Attachment',
        };
      })
      .filter(attachment => attachment.url); // Only include valid attachments
  }, [event.tags]);

  // Collect all images for gallery (from content and media attachments)
  useEffect(() => {
    const imagesFromContent = extractUrls(event.content).filter(url => isImageURL(url));
    const imagesFromMedia = mediaAttachments
      .filter(attachment => attachment.mimeType?.startsWith('image/'))
      .map(attachment => attachment.url);

    // Remove duplicates while preserving order
    const allImages = [...imagesFromContent, ...imagesFromMedia];
    const uniqueImages = Array.from(new Set(allImages));
    updateImages(uniqueImages);
  }, [event.content, mediaAttachments, updateImages]);

  // Check if content contains markdown
  const hasMarkdown = useMemo(() => containsMarkdown(event.content), [event.content]);

  // Extract URLs for link preview (only first URL)
  const firstUrl = useMemo(() => {
    const urls = extractUrls(event.content);
    return urls[0]; // Only get the first URL
  }, [event.content]);

  // Process the content to render mentions, links, etc.
  const content = useMemo(() => {
    let text = event.content;

    // Remove media URLs from content if they're already in imeta tags
    const mediaUrls = mediaAttachments.map(a => a.url);
    mediaUrls.forEach(url => {
      if (url) {
        text = text.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
      }
    });

    // If content contains markdown, use ReactMarkdown with custom components
    if (hasMarkdown) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom link component to handle external links and user mentions
            a: ({ href, children, ...props }) => {
              // Check if this is a user mention in the format @[name](pubkey)
              const childText = Array.isArray(children) ? children.join('') : String(children || '');
              const isUserMention = href && /^[0-9a-f]{64}$/i.test(href); // 64 char hex pubkey

              // Also check if the text starts with @ and href is a pubkey (for @[name](pubkey) format)
              const isMentionFormat = childText.startsWith('@') && href && /^[0-9a-f]{64}$/i.test(href);

              if (isUserMention || isMentionFormat) {
                // Remove the leading @ from the display name if it exists, since NostrMention will add it back
                const displayName = childText.startsWith('@') ? childText.substring(1) : childText;
                const pubkey = href;

                return (
                  <NostrMention
                    pubkey={pubkey}
                    displayName={displayName}
                    onUserClick={(pubkey) => {
                      setSelectedUserPubkey(pubkey);
                      setShowProfileDialog(true);
                    }}
                  />
                );
              }

              if (href?.startsWith('http')) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline break-all"
                    {...props}
                  >
                    {children}
                  </a>
                );
              }
              return (
                <Link to={href || '#'} className="text-blue-500 hover:underline break-all" {...props}>
                  {children}
                </Link>
              );
            },
            // Custom image component
            img: ({ src, alt }) => {
              if (src) {
                return (
                  <div className="my-1 inline-block">
                    <ChatImage
                      src={src}
                      alt={alt || 'Markdown image'}
                      className="max-h-64 w-auto"
                      onClick={() => handleImageClick(src, allImages)}
                    />
                  </div>
                );
              }
              return null;
            },
            // Custom code component for inline code
            code: ({ children, ...props }) => (
              <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono break-all" {...props}>
                {children}
              </code>
            ),
            // Custom pre component for code blocks
            pre: ({ children, ...props }) => (
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-1 whitespace-pre-wrap break-words max-w-full" {...props}>
                {children}
              </pre>
            ),
            // Custom blockquote component
            blockquote: ({ children, ...props }) => (
              <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-1 italic break-words" {...props}>
                {children}
              </blockquote>
            ),
            // Custom paragraph component
            p: ({ children, ...props }) => (
              <p className="break-words" {...props}>
                {children}
              </p>
            ),
            // Custom heading components
            h1: ({ children, ...props }) => (
              <h1 className="text-2xl font-bold mt-2 mb-1 break-words" {...props}>
                {children}
              </h1>
            ),
            h2: ({ children, ...props }) => (
              <h2 className="text-xl font-semibold mt-2 mb-1 break-words" {...props}>
                {children}
              </h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 className="text-lg font-medium mt-2 mb-1 break-words" {...props}>
                {children}
              </h3>
            ),
            h4: ({ children, ...props }) => (
              <h4 className="text-base font-medium mt-1 mb-1 break-words" {...props}>
                {children}
              </h4>
            ),
            h5: ({ children, ...props }) => (
              <h5 className="text-sm font-medium mt-1 mb-1 break-words" {...props}>
                {children}
              </h5>
            ),
            h6: ({ children, ...props }) => (
              <h6 className="text-sm font-medium mt-1 mb-0.5 break-words" {...props}>
                {children}
              </h6>
            ),
            // Custom list components
            ul: ({ children, ...props }) => (
              <ul className="list-disc list-inside space-y-0.5 my-0.5 pl-2 break-words" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal list-inside space-y-0.5 my-0.5 pl-4 break-words" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="pl-1 break-words" {...props}>
                {children}
              </li>
            ),
            // Custom table components
            table: ({ children, ...props }) => (
              <div className="overflow-x-auto my-1 max-w-full">
                <table className="min-w-full border-collapse border border-border" {...props}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }) => (
              <th className="border border-border px-3 py-2 bg-muted font-semibold text-left break-words max-w-xs" {...props}>
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td className="border border-border px-3 py-2 break-words max-w-xs" {...props}>
                {children}
              </td>
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      );
    }

    // If no markdown, use the original regex-based processing
    const regex = /(https?:\/\/[^\s]+)|nostr:(npub1|note1|nprofile1|nevent1|naddr1)([023456789acdefghjklmnpqrstuvwxyz]+)|@\[([^\]]+)\]\(([^)]+)\)|(#\w+)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyCounter = 0;

    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, url, nostrPrefix, nostrData, mentionDisplayName, mentionPubkey, hashtag] = match;
      const index = match.index;

      // Add text before this match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index));
      }

      if (url) {
        // Check if URL is an image
        const isImageUrl = isImageURL(url);

        if (isImageUrl) {
          // Render image URLs as actual images
          parts.push(
            <div key={`image-${keyCounter++}`} className="my-1 inline-block">
              <ChatImage
                src={url}
                alt="Shared image"
                className="max-h-64 w-auto"
                onClick={() => handleImageClick(url, allImages)}
                onError={(e) => {
                  // If image fails to load, fall back to link
                  const fallbackLink = document.createElement('a');
                  fallbackLink.href = url;
                  fallbackLink.target = '_blank';
                  fallbackLink.rel = 'noopener noreferrer';
                  fallbackLink.className = 'text-blue-500 hover:underline';
                  fallbackLink.textContent = url;
                  const eventTarget = e.currentTarget as HTMLElement;
                  eventTarget.parentNode?.replaceChild(fallbackLink, eventTarget);
                }}
              />
            </div>
          );
        } else {
          // Handle non-image URLs as regular links
          parts.push(
            <a
              key={`url-${keyCounter++}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {url}
            </a>
          );
        }
      } else if (nostrPrefix && nostrData) {
        // Handle Nostr references
        try {
          const nostrId = `${nostrPrefix}${nostrData}`;
          const decoded = nip19.decode(nostrId);

          if (decoded.type === 'npub') {
            const pubkey = decoded.data;
            parts.push(
              <NostrMention
                key={`mention-${keyCounter++}`}
                pubkey={pubkey}
                onUserClick={(pubkey) => {
                  setSelectedUserPubkey(pubkey);
                  setShowProfileDialog(true);
                }}
              />
            );
          } else if (decoded.type === 'note' || decoded.type === 'nevent' || decoded.type === 'naddr') {
            // Render inline event for note, nevent, and naddr
            parts.push(
              <div key={`inline-event-${keyCounter++}`} className="my-1">
                <InlineEvent
                  eventId={nostrId}
                  showHeader={true}
                  maxContentLength={250}
                />
              </div>
            );
          } else {
            // For other types, just show as a link
            parts.push(
              <Link
                key={`nostr-${keyCounter++}`}
                to={`/${nostrId}`}
                className="text-blue-500 hover:underline"
              >
                {fullMatch}
              </Link>
            );
          }
        } catch {
          // If decoding fails, just render as text
          parts.push(fullMatch);
        }
      } else if (mentionDisplayName && mentionPubkey) {
        // Handle user mentions in @[displayName](pubkey) format
        const displayName = mentionDisplayName.startsWith('@') ? mentionDisplayName.substring(1) : mentionDisplayName;
        parts.push(
          <NostrMention
            key={`user-mention-${keyCounter++}`}
            pubkey={mentionPubkey}
            displayName={displayName}
            onUserClick={(pubkey) => {
              setSelectedUserPubkey(pubkey);
              setShowProfileDialog(true);
            }}
          />
        );
      } else if (hashtag) {
        // Handle hashtags
        const tag = hashtag.slice(1); // Remove the #
        parts.push(
          <Link
            key={`hashtag-${keyCounter++}`}
            to={`/t/${tag}`}
            className="text-blue-500 hover:underline"
          >
            {hashtag}
          </Link>
        );
      }

      lastIndex = index + fullMatch.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // If no special content was found, just use the plain text
    if (parts.length === 0) {
      parts.push(text);
    }

    return parts;
  }, [event.content, mediaAttachments, hasMarkdown, allImages, handleImageClick]);

  return (
    <div className={cn("space-y-3 force-wrap", className)}>
      {/* Text content */}
      {(content || event.content) && (
        <div className="whitespace-pre-wrap break-words">
          {content || event.content}
        </div>
      )}

      {/* Link preview for first URL (only if not an image) */}
      {firstUrl && !isImageURL(firstUrl) && (
        <div className="mt-2">
          <LinkPreview url={firstUrl} />
        </div>
      )}

      {/* Media attachments */}
      {mediaAttachments.length > 0 && (
        <div className="space-y-1">
          {mediaAttachments.map((attachment, index) => (
            <MediaAttachment
              key={index}
              url={attachment.url}
              mimeType={attachment.mimeType}
              size={attachment.size}
              name={attachment.name}
              onImageClick={(url) => handleImageClick(url, allImages)}
            />
          ))}
        </div>
      )}

      {/* Image Gallery */}
      {allImages.length > 0 && (
        <ImageGallery
          images={allImages}
          isOpen={galleryOpen}
          onClose={closeGallery}
          initialIndex={galleryIndex}
        />
      )}

      {/* User Profile Dialog */}
      <ProfileModal
        targetPubkey={selectedUserPubkey}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onOpenSettings={() => {}}
        onNavigateToDMs={onNavigateToDMs}
        onProfileChange={handleProfileChange}
      />
    </div>
  );
}

// Helper component to display user mentions
function NostrMention({
  pubkey,
  displayName: providedDisplayName,
  onUserClick
}: {
  pubkey: string;
  displayName?: string;
  onUserClick?: (pubkey: string) => void;
}) {
  const author = useAuthor(pubkey);
  const hasRealName = !!author.data?.metadata?.name;
  const displayName = providedDisplayName || author.data?.metadata?.name || genUserName(pubkey);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onUserClick?.(pubkey);
  };

  // Only add @ prefix if the display name doesn't already start with @
  const displayText = displayName.startsWith('@') ? displayName : `@${displayName}`;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "font-medium hover:underline cursor-pointer",
        hasRealName || providedDisplayName
          ? "text-blue-500 hover:text-blue-600"
          : "text-gray-500 hover:text-gray-600"
      )}
    >
      {displayText}
    </button>
  );
}