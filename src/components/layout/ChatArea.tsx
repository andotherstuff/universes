import {
  HelpCircle,
  Hash,
  Users,
  Search,
  Volume2,
  Settings,
  Copy,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { VoiceChannel } from "@/components/voice/VoiceChannel";
import { useChannels } from "@/hooks/useChannels";
import { generateSpaceUrl } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useUserRole } from "@/hooks/useCommunityRoles";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { Badge } from "@/components/ui/badge";
import { useMessages } from "@/hooks/useMessages";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { usePinMessage, useUnpinMessage, usePinnedMessages } from "@/hooks/usePinnedMessages";
import { useModerationActions } from "@/hooks/useModerationActions";
import { useMentionNotifications } from "@/hooks/useMentionNotifications";
import { useDeleteMessage } from "@/hooks/useMessageActions";
import type { NostrEvent } from "@nostrify/nostrify";
import { useState, useMemo, useCallback } from "react";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { toast } from "sonner";
import { MessageThread } from "@/components/chat/MessageThread";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";
import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BaseChatArea } from "@/components/messaging/BaseChatArea";
import {
  groupMessageInputConfig,
  groupMessageItemConfig,
  groupMessageListConfig,
} from "@/components/messaging/configs/groupConfig";


interface ChatAreaProps {
  communityId: string | null;
  channelId: string | null;
  onToggleMemberList: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

function CommunityChatHeader({
  communityId,
  channelId,
  onToggleMemberList
}: {
  communityId: string;
  channelId: string;
  onToggleMemberList: () => void;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: channels } = useChannels(communityId);
  const { canModerate } = useCanModerate(communityId);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showModerationPanel, setShowModerationPanel] = useState(false);
  const { data: joinRequests } = useJoinRequests(communityId);
  const pendingJoinRequests = joinRequests?.length || 0;

  const channel = channels?.find((c) => c.id === channelId);

  if (!channel) {
    return null;
  }

  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === "voice";

  const copyChannelLink = () => {
    // Use naddr format for community ID
    try {
      const channelLink = generateSpaceUrl(communityId, channelId);
      navigator.clipboard.writeText(channelLink);
      toast.success("Channel link copied to clipboard!");
    } catch {
      toast.error("Failed to generate channel link. Please try again.");
    }
  };

  if (isMobile) {
    return null; // Mobile header handled separately
  }

  return (
    <>
      <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800">
            {isVoiceChannel
              ? <Volume2 className="w-4 h-4 text-green-500" />
              : <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{channelName}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
            onClick={() => navigate("/search")}
          >
            <Search className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
            onClick={onToggleMemberList}
          >
            <Users className="w-4 h-4" />
          </Button>
          {canModerate && channel
            ? (
              <>
                {/* Moderation Button with Notification Badge */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowModerationPanel(true)}
                  className="relative w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full"
                >
                  <Shield className="w-4 h-4" />
                  {pendingJoinRequests > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center rounded-full"
                    >
                      {pendingJoinRequests}
                    </Badge>
                  )}
                </Button>

                {/* Channel Settings Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-800 backdrop-blur-sm rounded-xl shadow-sm">
                    <DropdownMenuItem
                      onClick={() => setShowChannelSettings(true)}
                      className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg"
                    >
                      <Settings className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                      Edit Channel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyChannelLink} className="text-gray-900 dark:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 focus:bg-purple-100 dark:hover:bg-purple-900/20 rounded-lg">
                      <Copy className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                      Copy Channel Link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
            : (
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded-full">
                <HelpCircle className="w-4 h-4" />
              </Button>
            )}
        </div>
      </div>

      {channel && (
        <ChannelSettingsDialog
          channel={channel}
          communityId={communityId}
          open={showChannelSettings}
          onOpenChange={setShowChannelSettings}
        />
      )}

      {/* Moderation Panel */}
      {showModerationPanel && (
        <CommunitySettings
          communityId={communityId}
          open={showModerationPanel}
          onOpenChange={setShowModerationPanel}
        />
      )}
    </>
  );
}

function CommunityChat(
  { communityId, channelId, onToggleMemberList, onNavigateToDMs }:
    & Omit<ChatAreaProps, "communityId" | "channelId">
    & { communityId: string; channelId: string },
) {
  const { data: channels } = useChannels(communityId);
  const {
    data: messages,
    isLoading,
    hasMoreMessages,
    loadingOlderMessages,
    loadOlderMessages,
    reachedStartOfConversation
  } = useMessages(communityId, channelId);
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutate: pinMessage } = usePinMessage();
  const { mutate: unpinMessage } = useUnpinMessage();
  const { data: pinnedMessageIds } = usePinnedMessages(communityId, channelId);
  const { role } = useUserRole(communityId);
  const { banUser } = useModerationActions();
  const { mutate: deleteMessage } = useDeleteMessage(communityId);
  const { mutate: sendMentionNotifications } = useMentionNotifications();
  const { data: membershipStatus } = useUserCommunityMembership(communityId);
  const [threadRootMessage, setThreadRootMessage] = useState<NostrEvent | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  // Create dynamic message item config based on user role
  const dynamicMessageItemConfig = useMemo(() => ({
    ...groupMessageItemConfig,
    showBan: isAdmin, // Enable ban option for admin users
  }), [isAdmin]);

  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => ['messages', communityId, channelId], [communityId, channelId]);

  const handleSendMessage = useCallback(async (content: string, additionalTags: string[][] = []) => {
    const [kind, pubkey, identifier] = communityId.split(":");

    const tags = [
      ["t", channelId],
      ["a", `${kind}:${pubkey}:${identifier}`],
      ...additionalTags, // Add any additional tags (like imeta for files, p tags for mentions)
    ];

    // Extract mentioned pubkeys from p tags
    const mentionedPubkeys = tags
      .filter(([name]) => name === 'p')
      .map(([, pubkey]) => pubkey);

    const messageEvent = await createEvent({
      kind: 9411,
      content,
      tags,
    });

    // Send mention notifications if there are any mentioned users
    if (mentionedPubkeys.length > 0 && messageEvent) {
      try {
        await sendMentionNotifications({
          mentionedPubkeys,
          messageEvent,
          communityId,
          channelId,
        });
      } catch (error) {
        console.error('Failed to send mention notifications:', error);
        // Don't fail the message send if notifications fail
      }
    }
  }, [communityId, channelId, createEvent, sendMentionNotifications]);

  const handlePinMessage = useCallback((message: NostrEvent) => {
    const isPinned = pinnedMessageIds?.includes(message.id) || false;

    if (isPinned) {
      unpinMessage({ communityId, channelId, messageId: message.id });
    } else {
      pinMessage({ communityId, channelId, messageId: message.id });
    }
  }, [pinnedMessageIds, unpinMessage, pinMessage, communityId, channelId]);

  const handleReply = useCallback((message: NostrEvent) => {
    setThreadRootMessage(message);
    setIsThreadOpen(true);
  }, []);

  const handleBanUser = useCallback((pubkey: string, reason?: string) => {
    banUser.mutate({
      communityId,
      userPubkey: pubkey,
      reason: reason?.trim() || 'Banned by admin from chat'
    });
  }, [banUser, communityId]);

  const handleDeleteMessage = useCallback((message: NostrEvent, reason?: string) => {
    deleteMessage({
      messageEvent: message,
      reason: reason?.trim()
    });
  }, [deleteMessage]);

  // Memoize JSX elements after all hooks
  const header = useMemo(() => (
    <CommunityChatHeader
      communityId={communityId}
      channelId={channelId}
      onToggleMemberList={onToggleMemberList}
    />
  ), [communityId, channelId, onToggleMemberList]);

  const additionalContent = useMemo(() => (
    <div className="flex-shrink-0">
      <TypingIndicator channelId={channelId} />
    </div>
  ), [channelId]);

  // Now we can do early returns and computed values
  const channel = channels?.find((c) => c.id === channelId);
  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === "voice";

  // Memoize input placeholder to prevent re-renders (must be after channelName is defined)
  const inputPlaceholder = useMemo(() => `Message #${channelName}`, [channelName]);

  if (!channel) {
    return <div>Channel not found</div>;
  }

  const handleJoinRequest = () => {
    setShowJoinDialog(true);
  };

  if (isVoiceChannel) {
    return (
      <div className="flex flex-col h-full chat-container">
        {header}
        <div className="flex-1 p-4">
          <VoiceChannel channelId={channelId} channelName={channelName} />
        </div>
      </div>
    );
  }

  return (
    <>
      <BaseChatArea
        messages={messages || []}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        queryKey={queryKey}
        onPin={handlePinMessage}
        onReply={handleReply}
        onBan={handleBanUser}
        onDelete={handleDeleteMessage}
        header={header}
        messageListConfig={groupMessageListConfig}
        messageItemConfig={dynamicMessageItemConfig}
        messageInputConfig={groupMessageInputConfig}
        inputPlaceholder={inputPlaceholder}
        onNavigateToDMs={onNavigateToDMs}
        communityId={communityId}
        channelId={channelId}
        additionalContent={additionalContent}
        hasMoreMessages={hasMoreMessages}
        loadingOlderMessages={loadingOlderMessages}
        onLoadOlderMessages={loadOlderMessages}
        reachedStartOfConversation={reachedStartOfConversation}
        membershipStatus={membershipStatus}
        onJoinRequest={handleJoinRequest}
      />

      {threadRootMessage && (
        (() => {
          // Debug: Log communityId right before rendering MessageThread
          if (process.env.NODE_ENV === 'development') {
            console.log('About to render MessageThread with communityId:', communityId);
          }
          return null;
        })()
      )}
      {threadRootMessage && (
        <MessageThread
          rootMessage={threadRootMessage}
          open={isThreadOpen}
          onOpenChange={setIsThreadOpen}
          onNavigateToDMs={onNavigateToDMs}
          communityId={communityId}
          channelId={channelId}
        />
      )}

      {showJoinDialog && (
        <JoinRequestDialog
          communityId={communityId}
          open={showJoinDialog}
          onOpenChange={setShowJoinDialog}
        />
      )}
    </>
  );
}

export function ChatArea(props: ChatAreaProps) {

  if (!props.communityId || !props.channelId) {
    return (
      <div className="flex flex-col h-full w-full max-w-full overflow-hidden bg-white dark:bg-gray-900">
        <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-blue-600/20 rounded-full animate-pulse" />
            <div className="w-24 h-5 bg-blue-600/20 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full border border-purple-200 dark:border-purple-800 inline-block mb-6">
              <Hash className="w-16 h-16 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Select a channel</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose a channel to start chatting!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CommunityChat
      {...props}
      communityId={props.communityId}
      channelId={props.channelId}
    />
  );
}
