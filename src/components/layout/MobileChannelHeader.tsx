import { Hash, Users, Info, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { MemberList } from "./MemberList";
import { useChannels } from "@/hooks/useChannels";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useCommunities } from "@/hooks/useCommunities";
import { useToast } from "@/hooks/useToast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateSpaceUrl } from "@/lib/utils";

interface MobileChannelHeaderProps {
  communityId: string;
  channelId: string | null;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function MobileChannelHeader({ communityId, channelId, onNavigateToDMs }: MobileChannelHeaderProps) {
  const { data: channels } = useChannels(communityId);
  const { data: members } = useCommunityMembers(communityId);
  const { data: communities } = useCommunities();
  const { toast } = useToast();

  const channel = channels?.find((c) => c.id === channelId);
  const community = communities?.find((c) => c.id === communityId);

  if (!channel || !community) {
    return null;
  }

  const channelName = channel?.name || channelId;
  const isVoiceChannel = channel?.type === "voice";

  const copyChannelLink = () => {
    if (!channelId) return;

    // Use naddr format for community ID
    try {
      const channelLink = generateSpaceUrl(communityId, channelId);
      navigator.clipboard.writeText(channelLink);
      toast({
        title: "Channel link copied",
        description: "The channel link has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate channel link. Please try again.",
        variant: "destructive",
      });
    }
  };



  const onlineMembersCount = members?.filter(m => m.isOnline).length || 0;
  const totalMembersCount = members?.length || 0;

  return (
    <div className="flex items-center justify-between w-full">
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent flex-1 justify-center">
            <div className="flex flex-col items-center min-w-0">
              <div className="flex items-center space-x-1">
                {isVoiceChannel ? (
                  <Hash className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-semibold text-lg truncate">{channelName}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {onlineMembersCount} online • {totalMembersCount} members
              </div>
            </div>
          </Button>
        </DrawerTrigger>

      <DrawerContent className="h-[85vh]">
        <div className="flex flex-col h-full">
          <DrawerHeader className="p-4 border-b">
            <DrawerTitle className="flex items-center space-x-3">
              {isVoiceChannel ? (
                <Hash className="w-5 h-5 text-green-500" />
              ) : (
                <Hash className="w-5 h-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-lg">{channelName}</div>
                <div className="text-sm text-muted-foreground">
                  {onlineMembersCount} online • {totalMembersCount} members
                </div>
              </div>
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Channel Information */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Info className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold">Channel Information</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={community.image} alt={community.name} />
                        <AvatarFallback className="bg-indigo-600 text-white">
                          {community.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">{community.name}</div>
                        <div className="text-sm text-muted-foreground">Community</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Channel Type</span>
                        <Badge variant={isVoiceChannel ? "default" : "secondary"}>
                          {isVoiceChannel ? "Voice" : "Text"}
                        </Badge>
                      </div>

                      {channel.description && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Description</div>
                          <div className="text-sm">{channel.description}</div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Members</span>
                        <span className="text-sm font-medium">{totalMembersCount}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Online Now</span>
                        <span className="text-sm font-medium text-green-600">{onlineMembersCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={copyChannelLink}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Channel Link
                  </Button>
                </div>

                {/* Members List */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold">Members</h3>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <MemberList
                      communityId={communityId}
                      channelId={channelId}
                      onNavigateToDMs={onNavigateToDMs}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>

    </div>
  );
}