import { Users, Crown, Shield, MessageCircle, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { CommunitySettings } from "@/components/community/CommunitySettings";
import { ChannelSettingsDialog } from "@/components/community/ChannelSettingsDialog";
import { FolderManagementDialog } from "@/components/community/FolderManagementDialog";
import { CommunityChannelList } from "@/components/community/CommunityChannelList";
import { useChannels, type Channel } from "@/hooks/useChannels";
import { useCanModerate } from "@/hooks/useCommunityRoles";
import { useDataManager } from "@/components/DataManagerProvider";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommunitySectionNav } from "@/components/spaces/CommunitySectionNav";
import { useNavigate } from "react-router-dom";

interface CommunityPanelProps {
  communityId: string | null;
  selectedChannel: string | null;
  selectedSpace?: string | null;
  onSelectChannel?: (channelId: string | null) => void;
  onSelectSpace?: (spaceId: string | null) => void;
  onSelectCommunity?: (communityId: string | null) => void;
  dmTargetPubkey?: string | null;
  onDmTargetHandled?: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
  managementMode?: boolean;
}

export function CommunityPanel({ communityId, selectedChannel, selectedSpace, onSelectChannel, onSelectSpace, onSelectCommunity, dmTargetPubkey, onDmTargetHandled, onNavigateToDMs, managementMode = false }: CommunityPanelProps) {
  const { communities } = useDataManager();

  // Convert DataManager communities to array for compatibility with existing code
  const userCommunities = Array.from(communities.communities.values());
  const { refetch: refetchChannels } = useChannels(communityId);
  const { canModerate } = useCanModerate(communityId || '');
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState<Channel | null>(null);

  const handleChannelCreated = () => {
    refetchChannels();
  };

  // Use DataManager as the primary source for community data
  const community = communities.communities.get(communityId || '');

  if (!communityId) {
    // On mobile, show communities list instead of Direct Messages
    if (isMobile) {
      return (
        <div className="h-full w-full flex flex-col bg-gray-800 mobile-communities-container min-h-0">
          <div className="p-4 border-b border-gray-700 shrink-0 mobile-communities-item">
            <h2 className="text-lg font-semibold text-white mobile-communities-text">
              Your Communities
            </h2>
            <p className="text-sm text-gray-400">
              {userCommunities.length} communities
            </p>
          </div>

          <ScrollArea className="flex-1 mobile-communities-container min-h-0">
            <div className="p-4 space-y-3 mobile-communities-container">
              {communities.isLoading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-full flex flex-col items-center p-3 rounded-lg bg-gray-700/50 overflow-hidden">
                    <Skeleton className="w-12 h-12 rounded-lg mb-3" />
                    <div className="w-full text-center space-y-2">
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                      <Skeleton className="h-3 w-1/2 mx-auto" />
                    </div>
                  </div>
                ))
              ) : userCommunities.length > 0 ? (
                userCommunities.map((community) => (
                  <button
                    key={community.id}
                    onClick={() => onSelectCommunity?.(community.id)}
                    className="w-full flex flex-col p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors text-left mobile-touch mobile-button overflow-hidden"
                  >
                    {/* Icon/Avatar at the top */}
                    <div className="w-full flex justify-center mb-3">
                      {community.info.image ? (
                        <Avatar className="w-12 h-12 shrink-0">
                          <AvatarImage src={community.info.image} alt={community.info.name} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {community.info.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-12 h-12 shrink-0 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm">
                          {community.info.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content below the icon */}
                    <div className="w-full text-center">
                      <div className="flex items-center justify-center mb-1">
                        <h3 className="font-medium text-white text-sm">
                          {community.info.name}
                        </h3>
                        {(community.membershipStatus === 'owner' || community.membershipStatus === 'moderator') && (
                          <div className="ml-2 shrink-0">
                            {community.membershipStatus === 'owner' && (
                              <Crown className="w-4 h-4 text-yellow-400" />
                            )}
                            {community.membershipStatus === 'moderator' && (
                              <Shield className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 break-words">
                        {community.info.description || `${community.info.moderators.length + 1} members`}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 px-4">
                  <Users className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">No Communities</h3>
                  <p className="text-sm text-gray-400 mb-4 break-words">
                    You haven't joined any communities yet.
                  </p>
                </div>
              )}

              {/* Direct Messages Section */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => onNavigateToDMs?.('')}
                  className="w-full flex items-center p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors text-left mobile-touch mobile-button overflow-hidden"
                >
                  <div className="w-12 h-12 shrink-0 mr-3 bg-green-600 rounded-lg flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="font-medium text-white text-sm truncate">
                      Direct Messages
                    </h3>
                    <p className="text-xs text-gray-400 truncate">
                      Private conversations
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    // Desktop: Direct Messages view - return the full DirectMessages component
    return (
      <DirectMessages
        targetPubkey={dmTargetPubkey}
        onTargetHandled={onDmTargetHandled}
        onNavigateToDMs={onNavigateToDMs}
      />
    );
  }

  if (!community && !communityId) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="p-4 border-b border-gray-600">
          <Skeleton className="h-6 w-full" />
        </div>
        <div className="flex-1 min-h-0 p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-white mb-2">Community Not Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            The community you're looking for doesn't exist or couldn't be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">


      {/* Community Header */}
      <div className="px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 h-14 flex items-center">
        {!community ? (
          <div className="animate-pulse flex items-center space-x-2 w-full">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 w-full">
            {community.info.image ? (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={community.info.image} alt={community.info.name} />
                <AvatarFallback className="text-sm font-semibold">
                  {community.info.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
                {community.info.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {community.info.name}
              </h1>
            </div>

            {/* Management Button for Owners/Moderators */}
            {canModerate && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/space/${encodeURIComponent(communityId)}/manage`)}
                className="w-8 h-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex-shrink-0"
                title="Manage Community"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-4 w-full">
          {/* Community Section Navigator - Marketplace and Resources */}
          <div className="hidden">
            <CommunitySectionNav
              communityId={communityId}
              selectedSpace={selectedSpace || null}
              onSelectSpace={(spaceId) => onSelectSpace?.(spaceId)}
            />
          </div>

          {/* Community Channel List - Hide in management mode */}
          {!managementMode && (
            <CommunityChannelList
              communityId={communityId}
              selectedChannel={selectedChannel}
              onSelectChannel={(channelId) => onSelectChannel?.(channelId)}
              onChannelSettings={setSelectedChannelForSettings}
              canModerate={canModerate}
              onChannelCreated={handleChannelCreated}
            />
          )}
        </div>
      </ScrollArea>

      {/* Community Settings Dialog */}
      <CommunitySettings
        communityId={communityId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />

      {/* Folder Management Dialog */}
      <FolderManagementDialog
        communityId={communityId}
        open={showFolderManagement}
        onOpenChange={setShowFolderManagement}
      />

      {/* Channel Settings Dialog */}
      {selectedChannelForSettings && (
        <ChannelSettingsDialog
          channel={selectedChannelForSettings}
          communityId={communityId}
          open={!!selectedChannelForSettings}
          onOpenChange={(open) => {
            if (!open) setSelectedChannelForSettings(null);
          }}
        />
      )}
    </div>
  );
}