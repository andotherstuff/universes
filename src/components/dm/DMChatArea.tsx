import { ArrowLeft, Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useConversationMessages, useDataManager } from "@/components/DataManagerProvider";
import { BaseChatArea } from "@/components/messaging/BaseChatArea";
import {
  dmMessageInputConfig,
  dmMessageItemConfig,
  dmMessageListConfig,
} from "@/components/messaging/configs/dmConfig";
import { useAutoProtocol } from "@/hooks/useAutoProtocol";
import type { NostrEvent } from "@nostrify/nostrify";
import { useToast } from "@/hooks/useToast";
import { MESSAGES_PER_PAGE } from "@/lib/dmConstants";
import { useMemo, useCallback, useState } from "react";


interface DMChatAreaProps {
  conversationId: string; // The other person's pubkey
  onNavigateToDMs?: (targetPubkey: string) => void;
  onBack?: () => void; // For mobile navigation
  onMessageSent?: (recipientPubkey: string) => void; // Callback when a message is sent
}

function DMChatHeader({
  conversationId,
  onBack
}: {
  conversationId: string;
  onBack?: () => void;
}) {
  const isMobile = useIsMobile();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;

  const displayName = metadata?.name || genUserName(conversationId);
  const profileImage = metadata?.picture;

  return (
    <div
      className={`${isMobile ? "h-14" : "h-16"
        } border-b flex items-center justify-between px-4 bg-background`}
    >
      <div className="flex items-center space-x-3">
        {isMobile && onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="w-8 h-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="w-8 h-8">
          <AvatarImage src={profileImage} alt={displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">{displayName}</h3>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {/* These buttons are placeholders for future functionality */}
        <Button variant="ghost" size="icon" className="w-8 h-8">
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-8 h-8">
          <Video className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function DMChatArea(
  { conversationId, onNavigateToDMs, onBack, onMessageSent }: DMChatAreaProps,
) {
  const { messages: conversationMessages } = useConversationMessages(conversationId);
  const { messaging } = useDataManager();
  const { sendMessage, isDoingInitialLoad, isLoading } = messaging;

  // Simple pagination from conversation messages
  const [displayLimit, setDisplayLimit] = useState<number>(MESSAGES_PER_PAGE);

  // Memoize paginated messages to prevent unnecessary recalculations
  // BaseMessageList expects oldest-first order, so we slice from the end to get newest messages
  // This ensures newest messages appear at bottom and older messages load above
  const messages = useMemo(() => {
    // Take the NEWEST messages (from the end) for initial display
    // This ensures newest messages appear at bottom of chat
    const startIndex = Math.max(0, conversationMessages.length - displayLimit);
    return conversationMessages.slice(startIndex);
  }, [conversationMessages, displayLimit]);

  const hasMoreMessages = useMemo(() =>
    displayLimit < conversationMessages.length,
    [displayLimit, conversationMessages.length]
  );

  // Determine if we should show loading state for this conversation
  // Show loading during initial load OR if we have no messages yet and are still loading (for direct conversation links)
  const isConversationLoading = isDoingInitialLoad || (conversationMessages.length === 0 && isLoading);
  const loadingOlderMessages = false;

  const loadOlderMessages = useCallback(async () => {
    setDisplayLimit(prev => prev + MESSAGES_PER_PAGE);
  }, []);
  const { mutateAsync: createEvent } = useNostrPublish();
  const author = useAuthor(conversationId);
  const metadata = author.data?.metadata;
  const { user } = useCurrentUser();
  const { toast } = useToast();

  // Get automatic protocol determination - NIP-17 by default, falls back to NIP-04
  const protocol = useAutoProtocol(conversationId);

  const displayName = metadata?.name || genUserName(conversationId);

  // Memoize query key to prevent unnecessary re-renders (like ChatArea.tsx)
  const queryKey = useMemo(() => ['dm-unified-messages', user!.pubkey, conversationId], [user, conversationId]);

  // Memoize input placeholder to prevent re-renders
  const inputPlaceholder = useMemo(() => `Message ${displayName}`, [displayName]);

  // Memoize header to prevent re-renders
  const header = useMemo(() => (
    <DMChatHeader
      conversationId={conversationId}
      onBack={onBack}
    />
  ), [conversationId, onBack]);

  const handleSendMessage = useCallback(async (content: string) => {
    await sendMessage({
      recipientPubkey: conversationId,
      content,
      protocol,
    });

    // Call the callback to notify that a message was sent
    onMessageSent?.(conversationId);
  }, [sendMessage, conversationId, onMessageSent, protocol]);

  const handleDeleteMessage = useCallback(async (message: NostrEvent) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to delete messages",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create deletion event
      await createEvent({
        kind: 5, // Deletion event kind
        content: "Message deleted",
        tags: [
          ['e', message.id],
          ['k', message.kind.toString()],
        ],
      });

      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete message. Please try again.",
        variant: "destructive",
      });
    }
  }, [user, createEvent, toast]);

  // The key prop forces React to recreate the component when conversation changes
  // This prevents showing previous conversation messages during transitions
  return (
    <BaseChatArea
      key={conversationId} // Force component remount when conversation changes
      messages={messages || []}
      isLoading={isConversationLoading}
      onSendMessage={handleSendMessage}
      onDelete={handleDeleteMessage}
      queryKey={queryKey}
      header={header}
      messageListConfig={dmMessageListConfig}
      messageItemConfig={dmMessageItemConfig}
      messageInputConfig={dmMessageInputConfig}
      inputPlaceholder={inputPlaceholder}
      onNavigateToDMs={onNavigateToDMs}
      hasMoreMessages={hasMoreMessages}
      loadingOlderMessages={loadingOlderMessages}
      onLoadOlderMessages={loadOlderMessages}
    />
  );
}
