import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Plus, MessageCircle, Wifi, WifiOff, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Virtuoso } from "react-virtuoso";
import { DMConversationList } from "./DMConversationList";
import { DMChatArea } from "./DMChatArea";
import { NewDMDialog } from "./NewDMDialog";
import { NewDMDrawer } from "./NewDMDrawer";

import { UserPanel } from "@/components/layout/UserPanel";
import { MessagingInfoModal } from "@/components/debug/MessagingInfoModal";
import { type DMTabType } from "@/types/dm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/useIsMobile";
import { logger } from "@/lib/logger";
import { useDataManager } from "@/components/DataManagerProvider";
import { useToast } from "@/hooks/useToast";
import { DMTabs } from "./DMTabs";
import { nip19 } from "nostr-tools";
import { LOADING_PHASES } from "@/lib/constants";


interface DirectMessagesProps {
  targetPubkey?: string | null;
  selectedConversation?: string | null;
  onTargetHandled?: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  onConversationSelect?: (pubkey: string | null) => void;
}

export function DirectMessages({ targetPubkey, selectedConversation: propSelectedConversation, onTargetHandled, onNavigateToDMs, onConversationSelect }: DirectMessagesProps = {}) {
  const [internalSelectedConversation, setInternalSelectedConversation] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<DMTabType>('known');

  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  // Use the DataManager for all conversation data
  const { messaging } = useDataManager();
  const {
    conversations: newConversations,
    isLoading,
    loadingPhase,
    isDoingInitialLoad,
    subscriptions
  } = messaging;

  // Use controlled state if provided, otherwise use internal state
  const selectedConversation = propSelectedConversation !== undefined ? propSelectedConversation : internalSelectedConversation;

  // Status indicator component - memoized for performance
  const StatusIndicator = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      );
    }

    if (subscriptions.nip4 || subscriptions.nip17) {
      return (
        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <Wifi className="w-3 h-3" />
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <WifiOff className="w-3 h-3" />
      </div>
    );
  }, [isLoading, subscriptions.nip4, subscriptions.nip17]);

  const handleNewDM = useCallback(() => {
    setShowNewDM(true);
  }, []);

  const handleConversationCreated = useCallback((pubkey: string) => {
    if (propSelectedConversation !== undefined) {
      onConversationSelect?.(pubkey);
    } else {
      setInternalSelectedConversation(pubkey);
    }
    setShowNewDM(false);
  }, [propSelectedConversation, onConversationSelect]);

  // Consolidated responsive item content function
  const conversationItemContent = useCallback((index: number, conversation) => {
    const dmConversation = {
      id: conversation.id,
      pubkey: conversation.id,
      lastMessage: conversation.lastMessage,
      lastMessageTime: conversation.lastActivity,
      unreadCount: conversation.unreadCount || 0,
      isKnown: conversation.isKnown,
      isRequest: conversation.isRequest,
      lastMessageFromUser: conversation.lastMessageFromUser,
    };

    return (
      <div key={conversation.id} className="relative">
        <DMConversationList
          conversations={[dmConversation]}
          selectedConversation={selectedConversation || null}
          onSelectConversation={(pubkey) => {
            if (propSelectedConversation !== undefined) {
              onConversationSelect?.(pubkey);
            } else {
              setInternalSelectedConversation(pubkey);
            }
          }}
          searchQuery={searchQuery}
          isLoading={false}
          isVirtualized={true}
        />

      </div>
    );
  }, [selectedConversation, searchQuery, propSelectedConversation, onConversationSelect]);

  // Consolidated components object with responsive design
  const virtuosoComponents = useMemo(() => ({
    EmptyPlaceholder: () => (
      <div className="flex-1 md:flex-none flex items-center justify-center bg-gray-800 md:bg-transparent p-8">
        <div className="text-center text-gray-400">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {activeTab === 'known' ? 'No known conversations' : 'No requests'}
          </h3>
          <p className="text-sm mb-4">
            {activeTab === 'known'
              ? 'Conversations from people you follow will appear here.'
              : 'Message requests from people you don\'t follow will appear here.'
            }
          </p>
          <Button onClick={handleNewDM} className={isMobile ? "mobile-touch" : ""}>
            <Plus className="w-4 h-4 mr-2" />
            Start New Conversation
          </Button>
        </div>
      </div>
    ),
    Footer: () => <div className="h-2 md:h-0" />,
  }), [activeTab, handleNewDM, isMobile]);

  // Auto-select conversation when targetPubkey is provided
  useEffect(() => {
    if (targetPubkey) {
      // If controlled, notify parent, otherwise set internal state
      if (propSelectedConversation !== undefined) {
        onConversationSelect?.(targetPubkey);
      } else {
        setInternalSelectedConversation(targetPubkey);
      }
      // Mark the target as handled
      onTargetHandled?.();
    }
  }, [targetPubkey, onTargetHandled, onConversationSelect, propSelectedConversation]);

  // Update URL when a conversation is selected (only for manual selections, not initial ones)
  useEffect(() => {
    if (selectedConversation && !targetPubkey && user) {
      // Only update URL if this is a manual selection (not from initial targetPubkey)
      try {
        // Convert hex pubkey to npub for URL
        const npub = nip19.npubEncode(selectedConversation);
        const url = new URL(window.location.href);
        url.pathname = `/dm/${npub}`;
        window.history.replaceState({}, '', url.toString());
      } catch (error) {
        logger.error('Failed to encode pubkey:', error);
      }
    }
  }, [selectedConversation, targetPubkey, user]);

  // Update URL when no conversation is selected
  useEffect(() => {
    if (!selectedConversation && !targetPubkey) {
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedConversation, targetPubkey]);

  // Show discovery progress as toasts
  useEffect(() => {
    if (newConversations.length > 0) {
      toast({
        title: "✅ Messages Loaded",
        description: `Found ${newConversations.length} conversations`,
      });
    }
  }, [newConversations.length, toast]);

  // Memoize the expensive filtering and sorting operations (must be before early return)
  const filteredDiscoveredConversations = useMemo(() => {
    return newConversations
      .filter(conv => {
        // Filter conversations based on active tab
        if (activeTab === 'known') {
          return conv.isKnown; // Show conversations where user has sent messages
        } else {
          return conv.isRequest; // Show conversations where user hasn't replied yet
        }
      })
      .sort((a, b) => b.lastActivity - a.lastActivity); // Sort by most recent message first
  }, [newConversations, activeTab]);

  // Calculate counts for tabs in a single pass
  const { knownCount, requestsCount } = useMemo(() => {
    return newConversations.reduce(
      (counts, conv) => {
        if (conv.isKnown) counts.knownCount++;
        if (conv.isRequest) counts.requestsCount++;
        return counts;
      },
      { knownCount: 0, requestsCount: 0 }
    );
  }, [newConversations]);


  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p>You must be logged in to view direct messages</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    // Mobile: Show either conversation list or chat, not both
    return (
      <div className="flex flex-col h-full">
        {selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
            onNavigateToDMs={onNavigateToDMs}
            onBack={() => {
              if (propSelectedConversation !== undefined) {
                onConversationSelect?.(null);
              } else {
                setInternalSelectedConversation(null);
              }
            }}
            onMessageSent={(_recipientPubkey) => {
              // TODO: Implement new request handling with new system if needed
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-600 bg-secondary/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-white">Messages</h2>
                  {StatusIndicator}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 hover:bg-gray-800/60 mobile-touch"
                    onClick={() => setShowDebugModal(true)}
                  >
                    <Info className="w-3 h-3" />
                  </Button>                  
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 hover:bg-gray-800/60 mobile-touch"
                  onClick={handleNewDM}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <DMTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                knownCount={knownCount}
                requestsCount={requestsCount}
              />

              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors text-base"
                />
              </div>


            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-hidden bg-secondary/30 px-2">
              {/* Show loading state during initial load */}
              {isDoingInitialLoad ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                    <p className="text-sm">
                      {loadingPhase === LOADING_PHASES.CACHE && 'Loading conversations...'}
                      {loadingPhase === LOADING_PHASES.RELAYS && 'Fetching new messages...'}
                    </p>
                  </div>
                </div>
              ) : (
                <Virtuoso
                  data={filteredDiscoveredConversations}
                  itemContent={conversationItemContent}
                  components={virtuosoComponents}
                  className="h-full"
                />
              )}
            </div>
          </>
        )}

        {/* New DM Drawer for mobile */}
        <NewDMDrawer
          open={showNewDM}
          onOpenChange={setShowNewDM}
          onConversationCreated={handleConversationCreated}
        />

        {/* Messaging Info Modal */}
        <MessagingInfoModal
          open={showDebugModal}
          onOpenChange={setShowDebugModal}
        />
      </div>
    );
  }


  // Desktop layout
  return (
    <div className="flex h-full">


      {/* sidebar 2? */}
      <div className="w-72 bg-background flex flex-col border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Messages</h2>
              {StatusIndicator}
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 hover:bg-accent"
                onClick={() => setShowDebugModal(true)}
              >
                <Info className="w-3 h-3" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-accent"
              onClick={handleNewDM}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>



          {/* Tabs */}
          <DMTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            knownCount={knownCount}
            requestsCount={requestsCount}
          />

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus:bg-accent/50 transition-colors"
            />
          </div>


        </div>

        {/* Current Conversation List */}
        <div className="flex-1 overflow-hidden px-1">
          {/* Show loading state during initial load */}
          {isDoingInitialLoad ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
              </div>
            </div>
          ) : (
            <Virtuoso
              data={filteredDiscoveredConversations}
              itemContent={conversationItemContent}
              components={virtuosoComponents}
              className="h-full"
            />
          )}
        </div>

        {/* User Panel at the bottom */}
        <UserPanel />
      </div>

      {/* Chat Area */}
      <div className="flex-1">
        {/* Show loading state during initial load, regardless of selected conversation */}
        {isDoingInitialLoad ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-700">
                  {loadingPhase === LOADING_PHASES.CACHE && 'Loading from cache...'}
                  {loadingPhase === LOADING_PHASES.RELAYS && 'Fetching from relays...'}
                  {loadingPhase === LOADING_PHASES.SUBSCRIPTIONS && 'Setting up subscriptions...'}
                </h3>
              </div>
            </div>
          </div>
        ) : selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
            onNavigateToDMs={onNavigateToDMs}
            onMessageSent={(_recipientPubkey) => {
              // TODO: Implement new request handling with new system if needed
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-sm mb-4">Choose a conversation to start messaging!</p>
              <Button onClick={handleNewDM}>
                <Plus className="w-4 h-4 mr-2" />
                Start New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onConversationCreated={handleConversationCreated}
      />

      {/* Messaging Info Modal */}
      <MessagingInfoModal
        open={showDebugModal}
        onOpenChange={setShowDebugModal}
      />
    </div>
  );


}