import { useState, useEffect, useRef } from "react";
import { Virtuoso } from "react-virtuoso";
import { AppSidebar } from "./AppSidebar";
import { CommunityPanel } from "./CommunityPanel";
import { ChatArea } from "./ChatArea";
import { MemberList } from "./MemberList";
import { UserPanel } from "./UserPanel";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { SpacesArea } from "@/components/spaces/SpacesArea";

import { JoinRequestDialog } from "@/components/community/JoinRequestDialog";
import { FriendItem } from "@/components/friends/FriendsList";
import { MobileChannelHeader } from "@/components/layout/MobileChannelHeader";
import { useChannels } from "@/hooks/useChannels";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { useUrlParameters } from "@/hooks/useUrlParameters";
import { useUserCommunityMembership } from "@/hooks/useUserCommunityMembership";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMessageSystem } from "@/hooks/useMessageSystem";
import { useMutualFriends } from "@/hooks/useFollowers";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreHorizontal, LogOut, Share2, Shield } from "lucide-react";
import { useVisitHistory } from "@/hooks/useVisitHistory";
import { CommunityProvider } from "@/contexts/CommunityContext.tsx";
import { useMarketplaceContext } from "@/contexts/MarketplaceContext.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useCommunities } from "@/hooks/useCommunities";
import { useLeaveCommunity } from "@/hooks/useLeaveCommunity";
import { useToast } from "@/hooks/useToast";
import { handleInviteMembers } from "@/lib/communityUtils";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { Badge } from "@/components/ui/badge";

import { CommunitySettings } from "@/components/community/CommunitySettings";
import { createMarketplaceItemMessage } from "@/lib/marketplaceDM";
import { updateSpaceUrl } from "@/lib/utils";
import type { MarketplaceItem } from "@/components/spaces/MarketplaceSpace";

interface DiscordLayoutProps {
  initialDMTargetPubkey?: string | null;
  initialSpaceCommunityId?: string | null;
  initialSpaceChannelId?: string | null;
}

export function DiscordLayout({ initialDMTargetPubkey, initialSpaceCommunityId, initialSpaceChannelId }: DiscordLayoutProps = {}) {
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(
    null,
  );
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [showMemberList, setShowMemberList] = useState(true);
  const [dmTargetPubkey, setDmTargetPubkey] = useState<string | null>(null);
  const [selectedDMConversation, setSelectedDMConversation] = useState<string | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showCommunitySelectionDialog, setShowCommunitySelectionDialog] =
    useState(false);
  const [isAutoSelected, setIsAutoSelected] = useState(false);

  const [showMobileModeration, setShowMobileModeration] = useState(false);
  const initializationRef = useRef(false);
  const urlInitializationRef = useRef(false);
  const [communityBeforeJoinDialog, setCommunityBeforeJoinDialog] = useState<
    string | null
  >(null);
  const [activeTab, setActiveTab] = useState("channels");

  const { setActiveCommunity } = useMessageSystem();
  useEffect(() => {
    setActiveCommunity(selectedCommunity);
  }, [selectedCommunity, setActiveCommunity]);

  const { recordCommunityVisit, recordChannelVisit } = useVisitHistory();

  // Hooks for mobile channel menu
  const { data: communities } = useCommunities();
  const { mutate: leaveCommunity, isPending: isLeavingCommunity } = useLeaveCommunity();
  const { toast } = useToast();
  const { canModerate } = useCanModerate(selectedCommunity || '');
  const { data: joinRequests } = useJoinRequests(selectedCommunity);
  const pendingJoinRequests = joinRequests?.length || 0;

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<
    "communities" | "channels" | "chat" | "members"
  >("communities");

  // Initialize mobile view based on community and DM selection
  useEffect(() => {
    if (isMobile) {
      if (selectedCommunity) {
        setMobileView("channels");
      } else {
        setMobileView("chat"); // DM list view or conversation
      }
    }
  }, [isMobile, selectedCommunity]);

  const { data: channels } = useChannels(selectedCommunity);
  const { data: userCommunities } = useUserCommunities();
  const { communityId: urlCommunityId, isJoinRequest, clearNavigation } =
    useUrlNavigation();
  const { data: membershipStatus } = useUserCommunityMembership(urlCommunityId);
  const { data: mutualFriends } = useMutualFriends();
  const navigate = useNavigate();
  const urlParameters = useUrlParameters();
  const { setHighlightedItemId } = useMarketplaceContext();
  const urlChannelId = urlParameters.channelId;

  const { sendMessage: sendDM } = useDirectMessages();
  const [pendingMarketplaceItem, setPendingMarketplaceItem] = useState<MarketplaceItem | null>(null);

  const handleNavigateToDMs = (targetPubkey?: string, marketplaceItem?: MarketplaceItem) => {
    setSelectedCommunity(null);
    setSelectedChannel(null);
    setSelectedSpace(null);
    setActiveTab("channels"); // Reset to channels tab to avoid confusion

    // Update URL to /dm when navigating to DMs
    const url = new URL(window.location.href);
    url.pathname = '/dm';
    window.history.replaceState({}, '', url.toString());

    if (targetPubkey) {
      setDmTargetPubkey(targetPubkey);
      setSelectedDMConversation(targetPubkey);

      // If there's a marketplace item, store it to be sent when the DM loads
      if (marketplaceItem) {
        setPendingMarketplaceItem(marketplaceItem);
      }
    } else {
      setSelectedDMConversation(null);
      setPendingMarketplaceItem(null);
    }

    if (isMobile) {
      setMobileView("chat");
    }
  };

  // Handle initial DM target pubkey from URL
  useEffect(() => {
    if (initialDMTargetPubkey !== undefined) {
      setSelectedCommunity(null);
      setSelectedChannel(null);
      setSelectedSpace(null);
      setDmTargetPubkey(initialDMTargetPubkey);
      setSelectedDMConversation(initialDMTargetPubkey);
      if (isMobile) {
        setMobileView("chat");
      }
    }
  }, [initialDMTargetPubkey, isMobile]);

  // Handle initial space community ID from URL - only once
  useEffect(() => {
    if (initialSpaceCommunityId && !urlInitializationRef.current) {
      urlInitializationRef.current = true;

      // Always set the selected community, even if it's not in cache
      // This allows users to navigate to communities they're not yet members of
      setSelectedCommunity(initialSpaceCommunityId);
      setSelectedDMConversation(null);
      setDmTargetPubkey(null);
      setActiveTab("channels"); // Ensure we default to channels tab
      setSelectedSpace(null);

      // Set initial channel if provided
      if (initialSpaceChannelId && initialSpaceCommunityId) {
        // Channel ID is just channel name for naddr format
        setSelectedChannel(initialSpaceChannelId);
      }

      if (isMobile) {
        setMobileView("channels");
      }
    }
  }, [initialSpaceCommunityId, initialSpaceChannelId, isMobile]);

  // Send marketplace item message when DM conversation is selected
  useEffect(() => {
    if (selectedDMConversation && pendingMarketplaceItem) {
      const sendMessage = async () => {
        try {
          // Create the marketplace item message
          const messageContent = createMarketplaceItemMessage(pendingMarketplaceItem);

          // Send the DM
          await sendDM({
            recipientPubkey: selectedDMConversation,
            content: messageContent,
          });

          // Clear the pending item
          setPendingMarketplaceItem(null);
        } catch (error) {
          console.error('Failed to send marketplace item message:', error);
          // Don't clear the pending item so user can try again or it can be retried
        }
      };

      sendMessage();
    }
  }, [selectedDMConversation, pendingMarketplaceItem, sendDM]);

  useEffect(() => {
    // Only auto-select a community once on app initialization - never again
    // But don't auto-select if we have an initialSpaceCommunityId from URL navigation
    if (!initializationRef.current && !urlCommunityId && userCommunities !== undefined && !initialSpaceCommunityId) {
      initializationRef.current = true;

      if (userCommunities.length > 0) {
        const firstCommunityId = userCommunities[0].id;
        setSelectedCommunity(firstCommunityId);
        setIsAutoSelected(true);
      } else {
        setSelectedCommunity(null);
      }
    }
  }, [
    urlCommunityId,
    userCommunities,
    initialSpaceCommunityId,
  ]);

  useEffect(() => {
    if (urlCommunityId) {
      if (isJoinRequest) {
        setCommunityBeforeJoinDialog(selectedCommunity);
        setShowJoinDialog(true);
      } else {
        setSelectedCommunity(urlCommunityId);

        // Update URL to show /space/naddr when navigating via URL parameters
        updateSpaceUrl(urlCommunityId, urlChannelId);

        // Handle URL parameters for tab selection and item highlighting
        if (urlParameters.tab === 'marketplace') {
          setActiveTab('marketplace');
          setSelectedSpace('marketplace');
          setSelectedChannel(null);

          // Set the highlighted item if provided
          if (urlParameters.highlight) {
            setHighlightedItemId(urlParameters.highlight);
          }
        } else if (urlParameters.tab === 'resources') {
          setActiveTab('resources');
          setSelectedSpace('resources');
          setSelectedChannel(null);
        } else {
          // Default to channels tab when no tab parameter is specified
          setActiveTab('channels');
          setSelectedSpace(null);
        }

        if (
          membershipStatus !== "owner" && membershipStatus !== "moderator" &&
          membershipStatus !== "approved" && membershipStatus !== "pending"
        ) {
          setTimeout(() => {
            setCommunityBeforeJoinDialog(selectedCommunity);
            setShowJoinDialog(true);
          }, 500);
        } else if (membershipStatus === "pending") {
          setTimeout(() => {
            clearNavigation();
          }, 500);
        } else {
          clearNavigation();
        }
      }
    }
  }, [
    urlCommunityId,
    isJoinRequest,
    membershipStatus,
    clearNavigation,
    selectedCommunity,
    urlParameters.tab,
    urlParameters.highlight,
    setHighlightedItemId,
  ]);

  useEffect(() => {
    if (
      selectedCommunity && !selectedSpace && channels && channels.length > 0
    ) {
      // Check if the currently selected channel exists in this community
      // If it does, keep it selected. If not, set a default channel.
      let newSelectedChannel = selectedChannel;

      if (selectedChannel) {
        const currentChannelExists = channels.some((channel) => channel.id === selectedChannel);
        if (!currentChannelExists) {
          newSelectedChannel = null; // Reset if channel doesn't exist in this community
        }
      }

      // Only set default channel if no valid channel is selected
      if (!newSelectedChannel) {
        const generalChannel = channels.find((channel) =>
          channel.name.toLowerCase() === "general" && channel.type === "text"
        );

        if (generalChannel) {
          newSelectedChannel = generalChannel.id;
        } else {
          const firstTextChannel = channels.find((channel) =>
            channel.type === "text"
          );
          if (firstTextChannel) {
            newSelectedChannel = firstTextChannel.id;
          }
        }
      }

      // Only update if the channel selection actually changed
      if (newSelectedChannel !== selectedChannel) {
        setSelectedChannel(newSelectedChannel);
      }

      if (isMobile) {
        setMobileView("channels");
        setIsAutoSelected(false);
      }
    } else if (!selectedCommunity) {
      setSelectedChannel(null);
      setSelectedSpace(null);

      if (isMobile) {
        setMobileView("communities");
      }
    }
  }, [selectedCommunity, selectedSpace, channels, isMobile, isAutoSelected, selectedChannel]);

  // Additional effect to handle URL-based channel selection when channels are loaded
  // This ensures that the channel specified in the URL is properly selected
  // even if it's not immediately available in the channels list
  useEffect(() => {
    if (
      selectedCommunity &&
      urlChannelId &&
      channels &&
      channels.length > 0 &&
      selectedChannel !== urlChannelId
    ) {
      // Find the channel that matches the URL parameter (urlChannelId is now channel name)
      const urlChannel = channels.find((channel) =>
        channel.name.toLowerCase() === urlChannelId.toLowerCase() &&
        channel.type === "text"
      );

      if (urlChannel) {
        setSelectedChannel(urlChannel.id);
      }
    }
  }, [selectedCommunity, urlChannelId, channels, selectedChannel]);

  // Auto-show join dialog when user selects a community they're not a member of
  useEffect(() => {
    if (selectedCommunity && membershipStatus && !urlCommunityId) {
      // Only show dialog if user is not an approved member and not coming from URL navigation
      if (
        membershipStatus !== "owner" &&
        membershipStatus !== "moderator" &&
        membershipStatus !== "approved" &&
        membershipStatus !== "pending"
      ) {
        // Small delay to allow the community to load first
        setTimeout(() => {
          setCommunityBeforeJoinDialog(null); // No previous community to go back to
          setShowJoinDialog(true);
        }, 300);
      }
    }
  }, [selectedCommunity, membershipStatus, urlCommunityId]);

  const handleJoinSuccess = (communityId: string) => {
    setSelectedCommunity(communityId);
    clearNavigation();
    setCommunityBeforeJoinDialog(null);

    // Update URL to show /space/naddr when joining a community
    updateSpaceUrl(communityId, urlChannelId);
  };

  const handleJoinDialogClose = () => {
    setShowJoinDialog(false);
    clearNavigation();
    if (communityBeforeJoinDialog === null && selectedCommunity) {
      setSelectedCommunity(null);
      // Go back to /dm when closing join dialog without selecting a community
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    } else if (communityBeforeJoinDialog !== null) {
      setSelectedCommunity(communityBeforeJoinDialog);
      setCommunityBeforeJoinDialog(null);
      // Update URL to show the previously selected community
      updateSpaceUrl(communityBeforeJoinDialog, urlChannelId);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
    setSelectedSpace(null);
    setActiveTab("channels"); // Ensure we're on channels tab when selecting a channel

    if (selectedCommunity) {
      recordChannelVisit(selectedCommunity, channelId);
      // Update URL to reflect channel selection
      updateSpaceUrl(selectedCommunity, channelId);
    }

    if (isMobile) {
      setMobileView("chat");
    }
  };

  const handleSpaceSelect = (spaceId: string) => {
    setSelectedSpace(spaceId);
    setSelectedChannel(null);

    // Sync active tab with space selection
    if (spaceId === "marketplace") {
      setActiveTab("marketplace");
    } else if (spaceId === "resources") {
      setActiveTab("resources");
    }

    if (isMobile) {
      setMobileView("chat");
    }
  };

  const handleCommunitySelect = (communityId: string | null) => {
    setSelectedCommunity(communityId);
    // Don't immediately reset channel selection - let the useEffect handle it after channels load
    // This prevents the channel from being reset before the new community's channels are available
    setSelectedSpace(null);
    setIsAutoSelected(false);

    if (communityId) {
      // Update URL to show /space/naddr when a community is selected
      updateSpaceUrl(communityId);
      recordCommunityVisit(communityId);
    } else {
      // When no community is selected, go back to /dm
      setSelectedChannel(null); // Only reset channel when leaving communities entirely
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    }
  };



  const handleBackNavigation = () => {
    if (isMobile) {
      if (!selectedCommunity && selectedDMConversation) {
        // DM conversation: go back to DM list
        setSelectedDMConversation(null);
        setDmTargetPubkey(null);
      } else if (selectedCommunity && mobileView === "chat") {
        // Community chat: go back to channels
        setMobileView("channels");
      } else if (selectedCommunity && mobileView === "members") {
        // Community members: go back to chat
        setMobileView("chat");
      } else if (selectedCommunity && mobileView === "channels") {
        // Community channels: go back to no community (DM list)
        setSelectedCommunity(null);
        setMobileView("chat");
        // Update URL to /dm when leaving community
        const url = new URL(window.location.href);
        url.pathname = '/dm';
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  // Mobile channel menu functions
  const handleMobileInviteMembers = async () => {
    if (!selectedCommunity) return;

    const community = communities?.find((c) => c.id === selectedCommunity);
    if (!community) return;

    await handleInviteMembers(community.id, community.relays);
  };

  const handleLeaveCommunity = () => {
    if (!selectedCommunity) return;

    const community = communities?.find((c) => c.id === selectedCommunity);
    if (!community) return;

    leaveCommunity(
      { communityId: selectedCommunity },
      {
        onSuccess: () => {
          toast({
            title: "Left community",
            description: `You have left ${community.name}`,
          });
          // Navigate to /dm after leaving community
          const url = new URL(window.location.href);
          url.pathname = '/dm';
          window.location.href = url.toString();
        },
        onError: (error) => {
          toast({
            title: "Failed to leave community",
            description: error.message || "An error occurred while leaving the community",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (isMobile) {
    // Show sidebar when:
    // 1. In channels view with a community selected, OR
    // 2. In DM list view (no community selected, no active DM conversation)
    // Hide sidebar when in an active DM conversation
    const showSidebar = (mobileView === "channels" && selectedCommunity) || (!selectedCommunity && !selectedDMConversation);

    return (
      <CommunityProvider currentCommunityId={selectedCommunity}>
          <>
            <div className="flex h-screen bg-background text-foreground">
          {/* Left Sidebar - only show in channels view or when no community selected */}
          {showSidebar && (
            <div className="w-16 bg-background/50 flex flex-col h-full border-r">
              <AppSidebar
                selectedCommunity={selectedCommunity}
                showCommunitySelectionDialog={showCommunitySelectionDialog}
                onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
                onSelectCommunity={handleCommunitySelect}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile Top Navigation Bar - only show when needed */}
            {((!selectedCommunity && dmTargetPubkey) ||
              (selectedCommunity && (mobileView === "chat" || mobileView === "members")) ||
              (mobileView === "chat" && selectedCommunity) ||
              (mobileView === "members")) && (
              <div className="flex items-center justify-between p-3 border-b bg-background z-20 flex-shrink-0">
                {/* Back button - show for DM conversations or community chat/members */}
                {(!selectedCommunity && dmTargetPubkey) || (selectedCommunity && (mobileView === "chat" || mobileView === "members")) ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackNavigation}
                    className="flex-shrink-0"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : (
                  <div className="flex-shrink-0 w-9"></div>
                )}

                {/* Center content - Minimal titles, no title for DM conversations */}
                <div className="flex-1 text-center min-w-0">
                  {mobileView === "chat" && selectedCommunity && (
                    <>
                      {activeTab === "channels" ? (
                        <MobileChannelHeader
                          communityId={selectedCommunity}
                          channelId={selectedChannel}
                          onNavigateToDMs={handleNavigateToDMs}
                        />
                      ) : (
                        <h2 className="font-semibold text-lg truncate w-full">
                          {activeTab === "marketplace" ? "Shop" :
                           activeTab === "resources" ? "Files" : "Chat"}
                        </h2>
                      )}
                    </>
                  )}
                  {mobileView === "members" && (
                    <h2 className="font-semibold text-lg truncate">Members</h2>
                  )}
                </div>

                {/* Action Buttons - show for community chat with channels tab */}
                {mobileView === "chat" && selectedCommunity && activeTab === "channels" ? (
                  <div className="flex items-center gap-1">
                    {/* Moderation Button with Notification Badge */}
                    {canModerate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowMobileModeration(true)}
                        className="relative flex-shrink-0"
                      >
                        <Shield className="h-5 w-5" />
                        {pendingJoinRequests > 0 && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center rounded-full"
                          >
                            {pendingJoinRequests}
                          </Badge>
                        )}
                      </Button>
                    )}

                    {/* Triple Dot Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={handleMobileInviteMembers}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Invite Members
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleLeaveCommunity}
                          disabled={isLeavingCommunity}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Leave Community
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-9"></div>
                )}
              </div>
            )}



            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden min-w-0">
              {!selectedCommunity ? (
                // Direct Messages - now controlled by parent state
                <DirectMessages
                  targetPubkey={dmTargetPubkey}
                  selectedConversation={selectedDMConversation}
                  onTargetHandled={() => {
                    setDmTargetPubkey(null);
                    setSelectedDMConversation(null);
                  }}
                  onNavigateToDMs={(pubkey) => {
                    handleNavigateToDMs(pubkey);
                  }}
                  onConversationSelect={setSelectedDMConversation}
                />
              ) : mobileView === "chat"
                ? (
                  <>
                    {activeTab === "channels" && (
                      <ChatArea
                        communityId={selectedCommunity}
                        channelId={selectedChannel}
                        onToggleMemberList={() => setMobileView("members")}
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                    {activeTab === "marketplace" && selectedCommunity && (
                      <SpacesArea
                        communityId={selectedCommunity}
                        selectedSpace="marketplace"
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                    {activeTab === "resources" && selectedCommunity && (
                      <SpacesArea
                        communityId={selectedCommunity}
                        selectedSpace="resources"
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                  </>
                )
                : mobileView === "channels"
                ? (
                  <CommunityPanel
                    communityId={selectedCommunity}
                    selectedChannel={selectedChannel}
                    selectedSpace={selectedSpace}
                    onSelectChannel={handleChannelSelect}
                    onSelectSpace={handleSpaceSelect}
                    onSelectCommunity={handleCommunitySelect}
                    onNavigateToDMs={handleNavigateToDMs}
                  />
                )
                : (
                  <div className="h-full">
                    {/* Mobile Members View */}
                    {selectedCommunity && selectedChannel && (
                      <MemberList
                        communityId={selectedCommunity}
                        channelId={selectedChannel}
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>

        <JoinRequestDialog
          open={showJoinDialog}
          onOpenChange={handleJoinDialogClose}
          onJoinSuccess={handleJoinSuccess}
          communityId={urlCommunityId}
        />



        {/* Mobile Moderation Panel */}
        {showMobileModeration && selectedCommunity && (
          <CommunitySettings
            communityId={selectedCommunity}
            open={showMobileModeration}
            onOpenChange={setShowMobileModeration}
          />
        )}
          </>
      </CommunityProvider>
    );
  }

  return (
    <CommunityProvider currentCommunityId={selectedCommunity}>
      <>
        <div className="flex h-screen bg-background text-foreground">
          <div className="w-16 bg-background/50 flex flex-col h-full">
            <AppSidebar
              selectedCommunity={selectedCommunity}
              showCommunitySelectionDialog={showCommunitySelectionDialog}
              onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
              onSelectCommunity={handleCommunitySelect}
            />
          </div>

          {selectedCommunity
            ? (
              <>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-72 bg-secondary/30 flex flex-col">
                      <CommunityPanel
                        communityId={selectedCommunity}
                        selectedChannel={selectedChannel}
                        selectedSpace={selectedSpace}
                        onSelectChannel={handleChannelSelect}
                        onSelectSpace={handleSpaceSelect}
                        onSelectCommunity={handleCommunitySelect}
                        onNavigateToDMs={handleNavigateToDMs}
                      />
                      <UserPanel />
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                      {/* Main Content Area */}
                      <div className="flex-1 flex flex-col min-h-0">
                        {activeTab === "channels" && (
                          <>
                            {selectedSpace
                              ? (
                                <SpacesArea
                                  communityId={selectedCommunity}
                                  selectedSpace={selectedSpace}
                                  onNavigateToDMs={handleNavigateToDMs}
                                />
                              )
                              : (
                                <ChatArea
                                  communityId={selectedCommunity}
                                  channelId={selectedChannel}
                                  onToggleMemberList={() =>
                                    setShowMemberList(!showMemberList)}
                                  onNavigateToDMs={handleNavigateToDMs}
                                />
                              )}
                          </>
                        )}
                        {activeTab === "marketplace" && selectedCommunity && (
                          <SpacesArea
                            communityId={selectedCommunity}
                            selectedSpace="marketplace"
                            onNavigateToDMs={handleNavigateToDMs}
                          />
                        )}
                        {activeTab === "resources" && selectedCommunity && (
                          <SpacesArea
                            communityId={selectedCommunity}
                            selectedSpace="resources"
                            onNavigateToDMs={handleNavigateToDMs}
                          />
                        )}
                      </div>
                    </div>

                    {showMemberList && selectedChannel && !selectedSpace && activeTab === "channels" && (
                      <div className="w-72 bg-secondary/30">
                        <MemberList
                          communityId={selectedCommunity}
                          channelId={selectedChannel}
                          onNavigateToDMs={handleNavigateToDMs}
                        />
                      </div>
                    )}
                  </div>
              </>
            )
            : (
              <>
                <div className="flex-1 flex flex-col">
                  <CommunityPanel
                    communityId={selectedCommunity}
                    selectedChannel={selectedChannel}
                    onSelectChannel={setSelectedChannel}
                    onSelectCommunity={handleCommunitySelect}
                    dmTargetPubkey={dmTargetPubkey}
                    onDmTargetHandled={() => setDmTargetPubkey(null)}
                    onNavigateToDMs={handleNavigateToDMs}
                  />
                </div>

                <div className="w-72 bg-card border-l border-border flex flex-col">
                  <Virtuoso
                    data={mutualFriends || []}
                    itemContent={(index, friend) => (
                      <div className="p-4 pt-0">
                        <FriendItem
                          friend={friend}
                          onMessage={(pubkey) => navigate(`/dm/${pubkey}`)}
                        />
                      </div>
                    )}
                    components={{
                      Header: () => (
                        <div className="p-4">
                          <h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
                        </div>
                      ),
                      EmptyPlaceholder: () => (
                        <div className="p-4">
                          <p className="text-sm text-muted-foreground">No mutual friends yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Friends appear when you follow each other
                          </p>
                        </div>
                      ),
                      Footer: () => <div className="h-2" />,
                    }}
                    className="flex-1 scrollbar-thin"
                  />
                </div>
              </>
            )}
        </div>

        <JoinRequestDialog
          open={showJoinDialog}
          onOpenChange={handleJoinDialogClose}
          onJoinSuccess={handleJoinSuccess}
          communityId={urlCommunityId}
        />
      </>
    </CommunityProvider>
  );
}
