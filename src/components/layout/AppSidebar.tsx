import { Plus, MessageCircle, Crown, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunityOrder } from "@/hooks/useCommunityOrder";
import { useDataManager } from "@/components/DataManagerProvider";
import { CommunitySelectionDialog } from "@/components/community/CommunitySelectionDialog";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useSoundEffect } from "@/hooks/useSoundEffect";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthor } from "@/hooks/useAuthor";
import { genUserName } from "@/lib/genUserName";
import { useIsMobile } from "@/hooks/useIsMobile";
import { UserStatusIndicator } from "@/components/user/UserStatusIndicator";
import { UserMenu } from "@/components/user/UserMenu";
import { logger } from "@/lib/logger";
import { usePreloadCommunity } from "@/hooks/usePreloadCommunity";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import type { UserCommunity } from '@/hooks/useUserCommunities';

interface AppSidebarProps {
  selectedCommunity: string | null;
  showCommunitySelectionDialog: boolean;
  onShowCommunitySelectionDialogChange: (open: boolean) => void;
  onSelectCommunity: (communityId: string | null) => void;
}

// Inline SortableCommunityItem component
interface SortableCommunityItemProps {
  community: UserCommunity;
  isSelected: boolean;
  isLaunching: boolean;
  isLanding: boolean;
  isAnimating: boolean;
  onSelect: (communityId: string) => void;
  onMouseDown?: (communityId: string) => void; // Generic mouse down handler
}

function SortableCommunityItem({
  community,
  isSelected,
  isLaunching,
  isLanding,
  isAnimating,
  onSelect,
  onMouseDown,
}: SortableCommunityItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: community.id,
    disabled: isAnimating, // Disable dragging during rocket animations
    data: { community },
  });

  // Smart memoized state for showing drag cursor after delay
  const [isDraggingAfterDelay, setIsDraggingAfterDelay] = useState(false);
  const mouseDownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized mouse down handler to prevent recreation
  const handleMouseDown = useCallback(() => {
    // Start preloading immediately on mouse down
    if (onMouseDown) {
      onMouseDown(community.id);
    }

    // Clear existing timeout if any
    if (mouseDownTimeoutRef.current) {
      clearTimeout(mouseDownTimeoutRef.current);
    }

    // Set timeout to show grab cursor after 250ms
    mouseDownTimeoutRef.current = setTimeout(() => {
      setIsDraggingAfterDelay(true);
    }, 250);
  }, [community.id, onMouseDown]);

  // Memoized mouse up/leave handler
  const handleMouseUp = useCallback(() => {
    setIsDraggingAfterDelay(false);
    if (mouseDownTimeoutRef.current) {
      clearTimeout(mouseDownTimeoutRef.current);
      mouseDownTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mouseDownTimeoutRef.current) {
        clearTimeout(mouseDownTimeoutRef.current);
      }
    };
  }, []);

  // Restrict transform to vertical movement only, but don't interfere with rocket animations
  const style = useMemo(() => ({
    transform: !isLaunching && !isLanding && transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition: !isLaunching && !isLanding && !isDragging ? transition : 'none', // Disable transition during drag
    zIndex: isDragging ? 1000 : 'auto',
  }), [isLaunching, isLanding, transform, transition, isDragging]);

  // Generate button classes based on state
  const buttonClasses = useMemo(() => cn(
    // Base styles
    "w-12 h-12 rounded-2xl hover:bg-accent",
    "transition-all duration-100 relative z-10", // Faster transitions for better drag feel
    // State-dependent styles
    {
      "bg-accent": isSelected,
      "animate-rocket-launch": isLaunching,
      "shadow-lg shadow-purple-500/20": isLaunching,
      "animate-rocket-landing": isLanding,
      "shadow-lg shadow-blue-500/20": isLanding,
      "cursor-grabbing scale-105": isDragging,
      "cursor-grab": isDraggingAfterDelay && !isDragging && !isAnimating, // Only show grab after mouse down delay
      "cursor-pointer": !isDraggingAfterDelay && !isDragging && !isAnimating, // Default pointer cursor
      "shadow-lg shadow-blue-500/30": isDragging,
      // Subtle hint that item is draggable on hover
      "hover:shadow-md hover:shadow-gray-400/20": !isDragging && !isAnimating,
      // Selection border
      "border-2 border-blue-500": isSelected,
      "border-2 border-transparent": !isSelected,
    }
  ), [isSelected, isLaunching, isLanding, isDragging, isAnimating, isDraggingAfterDelay]);

  // Generate container classes for opacity effects
  const containerClasses = useMemo(() => cn(
    "transition-opacity duration-200",
    {
      "opacity-100": isSelected, // Full opacity when selected
      "opacity-60": !isSelected && !isDragging, // Reduced opacity for non-selected items
      "opacity-50": isDragging, // Even more reduced opacity when dragging for visual feedback
    }
  ), [isSelected, isDragging]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    logger.log('Community clicked:', community.name, { isDragging, isAnimating, isLaunching, isLanding });

    // Stop propagation to prevent drag listeners from interfering
    e.stopPropagation();

    // Only handle click if we're not in the middle of a drag operation
    if (!isDragging && !isAnimating) {
      onSelect(community.id);
    }
  }, [community.name, community.id, isDragging, isAnimating, isLaunching, isLanding, onSelect]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={containerClasses}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Reset cursor when mouse leaves
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className={buttonClasses}
              onClick={handleClick}
              disabled={isAnimating && !isLaunching && !isLanding}
            >
              {community.image ? (
                <Avatar className="w-10 h-10 rounded-xl">
                  <AvatarImage src={community.image} alt={community.name} className="rounded-xl" />
                  <AvatarFallback className="w-10 h-10 rounded-xl bg-nostr-purple text-nostr-purple-foreground font-semibold text-sm">
                    {community.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-10 h-10 bg-nostr-purple rounded-xl flex items-center justify-center text-nostr-purple-foreground font-semibold text-sm">
                  {community.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </Button>

            {/* Membership status indicator */}
            {community.membershipStatus === 'owner' && (
              <div className="absolute -bottom-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center z-20">
                <Crown className="w-3 h-3 text-white" />
              </div>
            )}
            {community.membershipStatus === 'moderator' && (
              <div className="absolute -bottom-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center z-20">
                <Shield className="w-3 h-3 text-white" />
              </div>
            )}
            {community.membershipStatus === 'pending' && (
              <div className="absolute -bottom-1 w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center z-20">
                <Clock className="w-3 h-3 text-white" />
              </div>
            )}

            {/* Launch phase effects - disabled during drag */}
            {isLaunching && !isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded-full animate-pulse delay-75"></div>
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-1 h-2 bg-gradient-to-t from-orange-600 to-red-500 rounded-full animate-pulse delay-150"></div>
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-0.5 h-1 bg-gradient-to-t from-yellow-500 to-transparent rounded-full animate-pulse delay-200"></div>

                {/* Enhanced launch glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-orange-500/30 animate-ping"></div>
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-pulse"></div>
              </div>
            )}

            {/* Landing phase effects - disabled during drag */}
            {isLanding && !isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Landing sparkles */}
                <div className="absolute -top-1 left-1 w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
                <div className="absolute -top-1 right-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-100"></div>
                <div className="absolute -bottom-1 left-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-200"></div>
                <div className="absolute -bottom-1 right-1 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-300"></div>

                {/* Landing glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-blue-400/20 animate-pulse"></div>
              </div>
            )}

            {/* Drag glow effect */}
            {isDragging && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-pulse"></div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="space-y-1">
            <p>{community.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {community.membershipStatus === 'approved' ? 'Member' :
                community.membershipStatus === 'pending' ? 'Pending approval' :
                  community.membershipStatus}
            </p>
            {isDragging && (
              <p className="text-xs text-blue-400">Dragging...</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppSidebar({
  selectedCommunity,
  showCommunitySelectionDialog,
  onShowCommunitySelectionDialogChange,
  onSelectCommunity
}: AppSidebarProps) {
  const { communities: dataManagerCommunities } = useDataManager();

  // Convert DataManager communities to UserCommunity format
  const communitiesList = useMemo(() => {
    return Array.from(dataManagerCommunities.communities.values()).map(community => ({
      id: community.fullAddressableId, // Use full addressable ID for compatibility with old hooks
      name: community.info.name,
      description: community.info.description || '',
      image: community.info.image,
      banner: community.info.banner,
      creator: community.pubkey,
      moderators: community.info.moderators,
      relays: community.info.relays,
      event: community.definitionEvent,
      membershipStatus: community.membershipStatus,
    }));
  }, [dataManagerCommunities.communities]);

  const { orderedCommunities, reorderCommunities } = useCommunityOrder(communitiesList);
  const { playSound } = useSoundEffect();
  const isMobile = useIsMobile();
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');
  const metadata = author.data?.metadata;
  const { preloadCommunity } = usePreloadCommunity();
  const navigate = useNavigate();

  // State for sophisticated animation
  const [launchingCommunity, setLaunchingCommunity] = useState<string | null>(null);
  const [landingCommunity, setLandingCommunity] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());


  // Drag and drop sensors with click/drag distinction
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced to 3px for more responsive drag feedback
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );




  // Handle drag end event
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      reorderCommunities(String(active.id), String(over.id));
    }
  }, [reorderCommunities]);

  // Handle drag start to detect if we're dragging
  const handleDragStart = useCallback(() => {
    logger.log('Drag started');
  }, []);

  // Handle click on communities (only when not dragging)
  const handleDragCancel = useCallback(() => {
    logger.log('Drag cancelled');
  }, []);

  // Handle community selection with sophisticated rocket animation
  const handleCommunitySelect = useCallback(async (communityId: string | null) => {
    logger.log('handleCommunitySelect called:', { communityId, selectedCommunity, isAnimating });

    if (!communityId || communityId === selectedCommunity || isAnimating) {
      onSelectCommunity(communityId);
      return;
    }

    // Clear any existing animation timeouts to prevent race conditions
    animationTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    animationTimeouts.current.clear();

    setIsAnimating(true);

    // Phase 1: Launch animation
    setLaunchingCommunity(communityId);
    logger.log('🚀 Launch animation started for:', communityId);

    // Play launch sound immediately at very low volume
    playSound('/sounds/rocket-launching.mp3', 0.01);

    // Phase 2: After launch animation starts, fade out and move to top
    const timeoutId1 = setTimeout(() => {
      setLaunchingCommunity(null);
      setLandingCommunity(communityId);
      logger.log('🛬 Landing animation started for:', communityId);

      // Actually select the community
      onSelectCommunity(communityId);

      // Phase 3: Clear landing animation after it completes (no landing sound)
      const timeoutId2 = setTimeout(() => {
        // Double-check we're still working with the same community
        setLandingCommunity(prev => prev === communityId ? null : prev);
        setIsAnimating(false);
        animationTimeouts.current.delete(timeoutId2);
      }, 600); // Landing animation duration

      animationTimeouts.current.add(timeoutId2);
      animationTimeouts.current.delete(timeoutId1);
    }, 400); // Launch animation duration before fade out

    animationTimeouts.current.add(timeoutId1);
  }, [selectedCommunity, isAnimating, playSound, onSelectCommunity]);

  // Reset animation states when component unmounts
  useEffect(() => {
    const timeouts = animationTimeouts.current;
    return () => {
      // Clear all animation timeouts
      timeouts.forEach(timeoutId => clearTimeout(timeoutId));
      timeouts.clear();
      setLaunchingCommunity(null);
      setLandingCommunity(null);
      setIsAnimating(false);
    };
  }, []);



  // Add mouse down handler for community interactions
  const handleCommunityMouseDown = useCallback((communityId: string) => {
    preloadCommunity(communityId, selectedCommunity || undefined);
  }, [preloadCommunity, selectedCommunity]);

  // Memoize the community list rendering to avoid unnecessary re-renders
  const communityListContent = useMemo(() => {
    if (!dataManagerCommunities.isLoading && orderedCommunities) {
      return orderedCommunities.map((community) => (
        <SortableCommunityItem
          key={community.id}
          community={community}
          isSelected={selectedCommunity === community.id}
          isLaunching={launchingCommunity === community.id}
          isLanding={landingCommunity === community.id}
          isAnimating={isAnimating}
          onSelect={handleCommunitySelect}
          onMouseDown={handleCommunityMouseDown}
        />
      ));
    } else if (dataManagerCommunities.isLoading) {
      // Skeleton loading for communities
      return Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="w-12 h-12 rounded-2xl" />
      ));
    } else {
      // No communities found
      return (
        <div className="text-xs text-muted-foreground text-center px-2">
          No communities
        </div>
      );
    }
  }, [dataManagerCommunities.isLoading, orderedCommunities, selectedCommunity, launchingCommunity, landingCommunity, isAnimating, handleCommunitySelect, handleCommunityMouseDown]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full z-10">
        {/* Fixed top section - Notifications and Direct Messages */}
        <div className="flex flex-col items-center pt-3 pb-2 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <NotificationCenter />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-accent transition-all duration-200 ${selectedCommunity === null ? 'bg-accent' : ''
                  }`}
                onClick={() => navigate('/dm')}
              >
                <MessageCircle className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Direct Messages</p>
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="w-8 h-0.5 bg-border rounded-full" />
        </div>

        {/* Scrollable communities section */}
        <ScrollArea className="flex-1 px-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            autoScroll={{ threshold: { x: 0, y: 0.2 } }}
          >
            <SortableContext
              items={orderedCommunities?.map(c => c.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col items-center space-y-2 pb-2">
                {communityListContent}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>

        {/* Fixed bottom section - Add Community Button */}
        <div className="flex flex-col items-center pt-2 pb-3 space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 border-2 border-dashed border-border hover:border-nostr-purple text-nostr-purple"
                onClick={() => onShowCommunitySelectionDialogChange(true)}
              >
                <Plus className="w-6 h-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Add a Community</p>
            </TooltipContent>
          </Tooltip>

          {/* User Profile Picture - Only show in mobile view */}
          {isMobile && user && (
            <UserMenu
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200"
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={metadata?.picture} alt={metadata?.name || genUserName(user.pubkey)} />
                      <AvatarFallback className="bg-nostr-purple text-nostr-purple-foreground text-xs">
                        {(metadata?.name || genUserName(user.pubkey)).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1">
                      <UserStatusIndicator pubkey={user.pubkey} />
                    </div>
                  </div>
                </Button>
              }
              side="right"
              align="end"
              sideOffset={10}
            />
          )}
        </div>

        <CommunitySelectionDialog
          open={showCommunitySelectionDialog}
          onOpenChange={onShowCommunitySelectionDialogChange}
          onCommunitySelect={onSelectCommunity}
        />
      </div>
    </TooltipProvider>
  );
}