import { useState } from 'react';
import {
  ChevronRight,
  Settings,
  ShoppingBag,
  BookOpen,
  Box,
  Palette,
  Globe,
  Users,
  MessageSquare,
  Calendar,
  Music,
  Camera,
  Code,
  Gamepad2,
  Heart,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SpaceManagementDialog } from './SpaceManagementDialog';
import { useSpaces, type Space } from '@/hooks/useSpaces';
import { useCanModerate } from '@/hooks/useCommunityRoles';

interface CommunitySectionNavProps {
  communityId: string;
  selectedSpace: string | null;
  onSelectSpace: (spaceId: string | null) => void;
}

const ICON_COMPONENTS = {
  ShoppingBag,
  BookOpen,
  Box,
  Palette,
  Globe,
  Users,
  MessageSquare,
  Calendar,
  Music,
  Camera,
  Code,
  Gamepad2,
  Heart,
  Zap,
};

export function CommunitySectionNav({
  communityId,
  selectedSpace,
  onSelectSpace
}: CommunitySectionNavProps) {
  const { data: spaces, isLoading: isLoadingSpaces } = useSpaces(communityId);

  // Show loading only if we have no data AND we're actually loading (not just fetching in background)
  const shouldShowLoading = isLoadingSpaces && !spaces;
  const { canModerate } = useCanModerate(communityId);
  const [isOpen, setIsOpen] = useState(true);
  const [showManagement, setShowManagement] = useState(false);

  const getIconComponent = (iconName: string) => {
    return ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || Box;
  };

  // Show loading skeleton only if we have no data AND we're actually loading (not background fetching)
  if (shouldShowLoading) {
    return <CommunitySectionNavSkeleton />;
  }

  if (!spaces || spaces.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between group">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 justify-start p-1 h-auto text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 rounded-sm transition-all duration-150"
            >
              <ChevronRight className={`w-3 h-3 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
              <span className="tracking-wide">SPACES</span>
            </Button>
          </CollapsibleTrigger>

          {canModerate && (
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-accent"
              onClick={() => setShowManagement(true)}
            >
              <Settings className="w-3 h-3" />
            </Button>
          )}
        </div>

        <CollapsibleContent className="space-y-0.5">
          {spaces.map((space) => (
            <SpaceItem
              key={space.id}
              space={space}
              isSelected={selectedSpace === space.id}
              onSelect={() => onSelectSpace(space.id)}
              getIconComponent={getIconComponent}
              communityId={communityId}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Space Management Dialog */}
      <SpaceManagementDialog
        communityId={communityId}
        open={showManagement}
        onOpenChange={setShowManagement}
      />
    </div>
  );
}

// Loading skeleton for CommunitySectionNav
function CommunitySectionNavSkeleton() {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between group">
        <div className="flex-1 flex items-center p-1 h-auto">
          <Skeleton className="w-3 h-3 mr-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="w-6 h-6" />
      </div>
      <div className="space-y-0.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="ml-4">
            <div className="flex items-center px-2 py-1 h-8">
              <Skeleton className="w-4 h-4 mr-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpaceItem({
  space,
  isSelected,
  onSelect,
  getIconComponent,
  communityId,
  onSpacePreload,
}: {
  space: Space;
  isSelected: boolean;
  onSelect: () => void;
  getIconComponent: (iconName: string) => React.ComponentType<{ className?: string }>;
  communityId: string;
  onSpacePreload?: (communityId: string) => void;
}) {
  const IconComponent = getIconComponent(space.icon);

  return (
    <div
      className="ml-4"
      onMouseDown={() => onSpacePreload?.(communityId)}
    >
      <Button
        variant="ghost"
        size="sm"
        className={`
          w-full justify-start px-2 py-1 h-auto min-h-[32px] rounded-sm transition-all duration-150 relative
          ${isSelected
            ? 'bg-nostr-purple/20 text-nostr-purple shadow-sm'
            : 'text-foreground hover:text-nostr-purple hover:bg-accent'
          }
        `}
        onClick={onSelect}
      >
        <IconComponent className="w-4 h-4 mr-2 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{space.name}</span>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-nostr-purple rounded-r-full"></div>
        )}
      </Button>
    </div>
  );
}