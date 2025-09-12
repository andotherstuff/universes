import { MessageCircle, UserPlus, MoreHorizontal, Flag, VolumeX, Copy, Check, Zap, Music, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuthor } from "@/hooks/useAuthor";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserStatus, useUserMusicStatus } from "@/hooks/useUserStatus";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { ProfileModal } from "@/components/user/ProfileModal";
import { ZapDialog } from "@/components/ZapDialog";
import { ReportUserDialog } from "@/components/reporting/ReportUserDialog";
import { MutualCommunities } from "@/components/profile/MutualCommunities";
import { useIsFriend } from "@/hooks/useFriends";
import { useManageFriends } from "@/hooks/useManageFriends";
import { useManageMutedUsers } from "@/hooks/useManageMutedUsers";
import { useIsMuted } from "@/hooks/useMutedUsers";
import { useDataManager } from "@/components/DataManagerProvider";
import { genUserName } from "@/lib/genUserName";
import { nip19 } from "nostr-tools";
import { useState, KeyboardEvent } from "react";
import { toast } from "sonner";

interface MemberCardProps {
  pubkey: string;
  children: React.ReactNode;
  onStartDM?: (pubkey: string) => void;
  onFollow?: (pubkey: string) => void;
  onMute?: (pubkey: string) => void;
  onReport?: (pubkey: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MemberCard({
  pubkey,
  children,
  onStartDM,
  onFollow,
  onMute,
  onReport,
  open,
  onOpenChange
}: MemberCardProps) {
  const { user } = useCurrentUser();
  const author = useAuthor(pubkey);
  const { data: userStatus } = useUserStatus(pubkey);
  const { data: musicStatus } = useUserMusicStatus(pubkey);
  const metadata = author.data?.metadata;
  const [copied, setCopied] = useState(false);
  const [currentProfilePubkey, setCurrentProfilePubkey] = useState(pubkey);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [_showSettingsDialog, _setShowSettingsDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [dmMessage, setDmMessage] = useState("");
  const isMobile = useIsMobile();
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);

  // DM functionality
  const { messaging } = useDataManager();
  const { sendMessage: sendDM } = messaging;
  const [isSendingDM, setIsSendingDM] = useState(false);

  // Follow state and actions
  const isFollowing = useIsFriend(pubkey);
  const { addFriend, removeFriend, isAddingFriend, isRemovingFriend } = useManageFriends();

  // Mute state and actions (NIP-51 compliant)
  const isMuted = useIsMuted(pubkey);
  const { muteUser, unmuteUser, isMuting, isUnmuting } = useManageMutedUsers();

  const displayName = metadata?.name || genUserName(pubkey);
  const profileImage = metadata?.picture;
  const banner = metadata?.banner;
  const about = metadata?.about;
  const nip05 = metadata?.nip05;
  const npub = nip19.npubEncode(pubkey);

  const isOwnProfile = user?.pubkey === pubkey;

  // Create a minimal event object for the ZapDialog
  const fakeEvent = {
    id: `fake-${pubkey}`,
    pubkey,
    kind: 0,
    content: '',
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
    sig: ''
  };

  const handleStartDM = () => {
    onStartDM?.(pubkey);
    onOpenChange?.(false);
  };


  const handleToggleMute = async () => {
    try {
      if (isMuted) {
        await unmuteUser(pubkey);
      } else {
        await muteUser(pubkey);
      }
      onMute?.(pubkey);
      onOpenChange?.(false);
    } catch (error) {
      // Error handling is already done in the useManageMutedUsers hook
      console.error('Mute/unmute error:', error);
    }
  };

  const handleReport = () => {
    setShowReportDialog(true);
    onOpenChange?.(false);
    onReport?.(pubkey); // Still call the optional callback for compatibility
  };

  const handleProfileChange = (newPubkey: string) => {
    setCurrentProfilePubkey(newPubkey);
  };

  const handleCopyNpub = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      toast.success("Copied npub to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy npub");
    }
  };

  const handleOpenProfile = () => {
    setShowProfileDialog(true);
    onOpenChange?.(false); // Close the member card popup
  };

  const _handleProfileDM = (targetPubkey: string) => {
    onStartDM?.(targetPubkey);
    setShowProfileDialog(false);
  };

  const handleToggleFollow = async () => {
    try {
      if (isFollowing) {
        await removeFriend(pubkey);
      } else {
        // Get user's preferred relay from their profile metadata
        const userRelay = metadata?.nip05 ? `wss://${metadata.nip05.split('@')[1]}` : undefined;
        await addFriend({
          pubkey,
          relay: userRelay,
          petname: displayName
        });
      }
      onFollow?.(pubkey);
    } catch (error) {
      // Error handling is already done in the useManageFriends hook
      console.error('Follow/unfollow error:', error);
    }
  };

  const handleSendQuickDM = async () => {
    if (!dmMessage.trim() || !user) return;

    try {
      setIsSendingDM(true);
      await sendDM({
        recipientPubkey: pubkey,
        content: dmMessage.trim(),
      });

      // Clear input and show success
      setDmMessage("");
      toast.success("Message sent!");

      // Open the DM thread
      onStartDM?.(pubkey);
      onOpenChange?.(false);
    } catch (error) {
      // Error is already handled by the useSendDM hook
      console.error('Failed to send quick DM:', error);
    } finally {
      setIsSendingDM(false);
    }
  };

  const handleDMKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuickDM();
    }
  };

  return (
    <>
      {isMobile ? (
        // Mobile: Use Dialog for full-screen experience
        <>
          <div onClick={() => setMobileDialogOpen(true)}>
            {children}
          </div>
          <Dialog open={mobileDialogOpen} onOpenChange={setMobileDialogOpen}>
            <DialogContent className="max-w-md p-0 bg-gray-900 border-gray-700 shadow-xl">
              <div className="relative">
                {/* Banner */}
                <div className="h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-t-md relative overflow-hidden">
                  {banner && (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${banner})` }}
                    />
                  )}
                </div>


                <div className="px-4 pb-4">
                  {/* Avatar positioned over banner */}
                  <div className="-mt-8 mb-4">
                    <div
                      className="cursor-pointer relative inline-block"
                      onClick={handleOpenProfile}
                      title="View profile"
                    >
                      <Avatar className="w-16 h-16 border-4 border-background">
                        <AvatarImage src={profileImage} alt={displayName} />
                        <AvatarFallback className="bg-indigo-600 text-white text-sm">
                          {displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {/* Status indicator positioned on avatar */}
                      <div className="absolute bottom-2 right-0.5">
                        <UserStatusIndicator pubkey={pubkey} />
                      </div>
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="space-y-3">
                    <div>
                      <h3
                        className="text-lg font-bold text-white leading-tight cursor-pointer hover:text-indigo-400 transition-colors"
                        onClick={handleOpenProfile}
                        title="View profile"
                      >
                        {displayName}
                      </h3>

                      {/* Status message */}
                      {(userStatus?.emoji || userStatus?.message) && (
                        <div className="flex items-center space-x-1 mt-1">
                          <span className="text-sm">🌌</span>
                          {userStatus.emoji && (
                            <span className="text-sm">{userStatus.emoji}</span>
                          )}
                          {userStatus.message && (
                            <p className="text-sm text-gray-300">{userStatus.message}</p>
                          )}
                        </div>
                      )}

                      {/* Music Status */}
                      {musicStatus && musicStatus.content && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Music className="w-3 h-3 text-purple-500" />
                          <p className="text-sm text-gray-300 truncate">
                            {musicStatus.link ? (
                              <a
                                href={musicStatus.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-purple-400 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {musicStatus.content}
                              </a>
                            ) : (
                              musicStatus.content
                            )}
                          </p>
                        </div>
                      )}

                      {/* npub with copy button */}
                      <div className="flex items-center space-x-2 mt-2">
                        <p className="text-xs text-gray-400 font-mono">
                          {npub.slice(0, 20)}...
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyNpub}
                          className="h-5 w-5 hover:bg-gray-700 text-gray-400 hover:text-white"
                          title="Copy npub"
                        >
                          {copied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>

                      {/* NIP-05 verification */}
                      {nip05 && (
                        <Badge variant="secondary" className="mt-2 text-xs bg-green-900/30 text-green-400 border-green-700">
                          ✓ {nip05}
                        </Badge>
                      )}
                    </div>

                    {/* About section (truncated) */}
                    {about && (
                      <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 overflow-hidden">
                        {about}
                      </p>
                    )}

                    {/* Mutual Communities */}
                    <MutualCommunities
                      targetPubkey={pubkey}
                      onCommunityClick={() => onOpenChange?.(false)}
                    />

                    {/* Action buttons */}
                    {!isOwnProfile && (
                      <div className="flex items-center space-x-2 pt-2">
                        {/* Follow button */}
                        <Button
                          variant={isFollowing ? "outline" : "default"}
                          size="sm"
                          onClick={handleToggleFollow}
                          disabled={isAddingFriend || isRemovingFriend}
                          className={`flex-1 h-8 text-xs ${isFollowing
                              ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            }`}
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          {isAddingFriend || isRemovingFriend
                            ? "..."
                            : isFollowing
                              ? "Following"
                              : "Follow"
                          }
                        </Button>

                        {/* DM button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartDM}
                          className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-8 text-xs"
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          Message
                        </Button>

                        {/* Zap button */}
                        <ZapDialog target={fakeEvent}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-8 h-8 p-0 border-yellow-600 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-500"
                            title="Send zap"
                          >
                            <Zap className="w-3 h-3" />
                          </Button>
                        </ZapDialog>

                        {/* More actions dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-8 h-8 p-0 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              <MoreHorizontal className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-gray-800 border-gray-600"
                          >
                            <DropdownMenuItem
                              onClick={handleToggleMute}
                              disabled={isMuting || isUnmuting}
                              className="text-orange-400 focus:text-orange-300 focus:bg-orange-900/20"
                            >
                              <VolumeX className="w-4 h-4 mr-2" />
                              {isMuting || isUnmuting ? "..." : isMuted ? "Unmute User" : "Mute User"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-600" />
                            <DropdownMenuItem
                              onClick={handleReport}
                              className="text-red-400 focus:text-red-300 focus:bg-red-900/20"
                            >
                              <Flag className="w-4 h-4 mr-2" />
                              Report User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}

                    {/* Quick DM Input */}
                    {!isOwnProfile && (
                      <div className="pt-2">
                        <div className="flex items-center space-x-1">
                          <Input
                            type="text"
                            placeholder={`Message @${displayName.split(' ')[0]}...`}
                            value={dmMessage}
                            onChange={(e) => setDmMessage(e.target.value)}
                            onKeyPress={handleDMKeyPress}
                            disabled={isSendingDM}
                            className="flex-1 h-8 text-xs bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                          <Button
                            onClick={handleSendQuickDM}
                            disabled={!dmMessage.trim() || isSendingDM}
                            size="sm"
                            className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSendingDM ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        // Desktop: Use Popover for hover/click overlay
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            {children}
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0 bg-gray-900 border-gray-700 shadow-xl"
            align="start"
            side="right"
            sideOffset={8}
          >
            <div className="relative">
              {/* Banner */}
              <div className="h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-t-md relative overflow-hidden">
                {banner && (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${banner})` }}
                  />
                )}
              </div>

              <div className="px-4 pb-4">
                {/* Avatar positioned over banner */}
                <div className="-mt-8 mb-4">
                  <div
                    className="cursor-pointer relative inline-block"
                    onClick={handleOpenProfile}
                    title="View profile"
                  >
                    <Avatar className="w-16 h-16 border-4 border-background">
                      <AvatarImage src={profileImage} alt={displayName} />
                      <AvatarFallback className="bg-indigo-600 text-white text-sm">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Status indicator positioned on avatar */}
                    <div className="absolute bottom-2 right-0.5">
                      <UserStatusIndicator pubkey={pubkey} />
                    </div>
                  </div>
                </div>

                {/* Profile Info */}
                <div className="space-y-3">
                  <div>
                    <h3
                      className="text-lg font-bold text-white leading-tight cursor-pointer hover:text-indigo-400 transition-colors"
                      onClick={handleOpenProfile}
                      title="View profile"
                    >
                      {displayName}
                    </h3>

                    {/* Status message */}
                    {(userStatus?.emoji || userStatus?.message) && (
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="text-sm">🌌</span>
                        {userStatus.emoji && (
                          <span className="text-sm">{userStatus.emoji}</span>
                        )}
                        {userStatus.message && (
                          <p className="text-sm text-gray-300">{userStatus.message}</p>
                        )}
                      </div>
                    )}

                    {/* Music Status */}
                    {musicStatus && musicStatus.content && (
                      <div className="flex items-center space-x-1 mt-1">
                        <Music className="w-3 h-3 text-purple-500" />
                        <p className="text-sm text-gray-300 truncate">
                          {musicStatus.link ? (
                            <a
                              href={musicStatus.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-purple-400 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {musicStatus.content}
                            </a>
                          ) : (
                            musicStatus.content
                          )}
                        </p>
                      </div>
                    )}

                    {/* npub with copy button */}
                    <div className="flex items-center space-x-2 mt-2">
                      <p className="text-xs text-gray-400 font-mono">
                        {npub.slice(0, 20)}...
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyNpub}
                        className="h-5 w-5 hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="Copy npub"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    {/* NIP-05 verification */}
                    {nip05 && (
                      <Badge variant="secondary" className="mt-2 text-xs bg-green-900/30 text-green-400 border-green-700">
                        ✓ {nip05}
                      </Badge>
                    )}
                  </div>

                  {/* About section (truncated) */}
                  {about && (
                    <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 overflow-hidden">
                      {about}
                    </p>
                  )}

                  {/* Mutual Communities */}
                  <MutualCommunities
                    targetPubkey={pubkey}
                    onCommunityClick={() => onOpenChange?.(false)}
                  />

                  {/* Action buttons */}
                  {!isOwnProfile && (
                    <div className="flex items-center space-x-2 pt-2">
                      {/* Follow button */}
                      <Button
                        variant={isFollowing ? "outline" : "default"}
                        size="sm"
                        onClick={handleToggleFollow}
                        disabled={isAddingFriend || isRemovingFriend}
                        className={`flex-1 h-8 text-xs ${isFollowing
                            ? "border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                          }`}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        {isAddingFriend || isRemovingFriend
                          ? "..."
                          : isFollowing
                            ? "Following"
                            : "Follow"
                        }
                      </Button>

                      {/* DM button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartDM}
                        className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-8 text-xs"
                      >
                        <MessageCircle className="w-3 h-3 mr-1" />
                        Message
                      </Button>

                      {/* Zap button */}
                      <ZapDialog target={fakeEvent}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0 border-yellow-600 text-yellow-500 hover:bg-yellow-500/20 hover:border-yellow-500"
                          title="Send zap"
                        >
                          <Zap className="w-3 h-3" />
                        </Button>
                      </ZapDialog>

                      {/* More actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-8 h-8 p-0 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-gray-800 border-gray-600"
                        >
                          <DropdownMenuItem
                            onClick={handleToggleMute}
                            disabled={isMuting || isUnmuting}
                            className="text-orange-400 focus:text-orange-300 focus:bg-orange-900/20"
                          >
                            <VolumeX className="w-4 h-4 mr-2" />
                            {isMuting || isUnmuting ? "..." : isMuted ? "Unmute User" : "Mute User"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-600" />
                          <DropdownMenuItem
                            onClick={handleReport}
                            className="text-red-400 focus:text-red-300 focus:bg-red-900/20"
                          >
                            <Flag className="w-4 h-4 mr-2" />
                            Report User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  {/* Quick DM Input */}
                  {!isOwnProfile && (
                    <div className="pt-2">
                      <div className="flex items-center space-x-1">
                        <Input
                          type="text"
                          placeholder={`Message @${displayName.split(' ')[0]}...`}
                          value={dmMessage}
                          onChange={(e) => setDmMessage(e.target.value)}
                          onKeyPress={handleDMKeyPress}
                          disabled={isSendingDM}
                          className="flex-1 h-8 text-xs bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                        />
                        <Button
                          onClick={handleSendQuickDM}
                          disabled={!dmMessage.trim() || isSendingDM}
                          size="sm"
                          className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSendingDM ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Profile Dialog */}
      <ProfileModal
        targetPubkey={currentProfilePubkey}
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        onOpenSettings={() => _setShowSettingsDialog(true)}
        onNavigateToDMs={onStartDM}
        onProfileChange={handleProfileChange}
      />

      {/* Report Dialog */}
      <ReportUserDialog
        targetPubkey={pubkey}
        targetDisplayName={displayName}
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
      />
    </>
  );
}