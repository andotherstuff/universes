import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown, Shield, Users, ExternalLink, Settings, Share2 } from "lucide-react";
import { useUserCommunities } from "@/hooks/useUserCommunities";
import { useLeaveCommunity } from "@/hooks/useLeaveCommunity";
import { CommunityDiscovery } from "@/components/discovery/CommunityDiscovery";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { LoginArea } from "@/components/auth/LoginArea";
import { CommunityShareDialog } from "@/components/community/CommunityShareDialog";
import { generateCommunityNaddr, encodeNaddrForUrl } from "@/lib/utils";

export function Communities() {
  const navigate = useNavigate();
  const { data: userCommunities, isLoading } = useUserCommunities();
  const { mutate: leaveCommunity } = useLeaveCommunity();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("my-communities");

  const handleLeaveCommunity = (communityId: string, communityName: string) => {
    leaveCommunity(
      { communityId, message: `Leaving ${communityName}` },
      {
        onSuccess: () => {
          toast({
            title: "Leave Request Sent",
            description: `Your request to leave ${communityName} has been sent.`,
          });
        },
        onError: (error) => {
          toast({
            title: "Failed to Leave",
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Login Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm sm:text-base">
              You need to be logged in to view and manage your communities.
            </p>
            <LoginArea className="w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Communities</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your community memberships and discover new communities
          </p>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2 h-10 sm:h-auto">
            <TabsTrigger value="my-communities" className="text-sm sm:text-base">My Communities</TabsTrigger>
            <TabsTrigger value="discover" className="text-sm sm:text-base">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="my-communities" className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold">Your Communities</h2>
              <Badge variant="outline" className="text-xs sm:text-sm">
                {userCommunities?.length || 0} communities
              </Badge>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-2 sm:pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 sm:h-5 bg-muted rounded w-3/4" />
                          <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="h-3 sm:h-4 bg-muted rounded w-full" />
                        <div className="h-3 sm:h-4 bg-muted rounded w-2/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userCommunities && userCommunities.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {userCommunities.map((community) => (
                  <Card key={community.id} className="hover:bg-muted/50 transition-colors overflow-hidden">
                    <CardHeader className="pb-2 sm:pb-3 overflow-hidden">
                      <div className="flex items-start justify-between min-w-0">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {community.image ? (
                            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                              <AvatarImage src={community.image} alt={community.name} />
                              <AvatarFallback>
                                {community.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm sm:text-base shrink-0">
                              {community.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <CardTitle className="text-base sm:text-lg truncate">
                              {community.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Badge
                                variant={
                                  community.membershipStatus === 'owner' ? 'default' :
                                  community.membershipStatus === 'moderator' ? 'secondary' :
                                  'outline'
                                }
                                className="text-xs shrink-0"
                              >
                                {community.membershipStatus === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                                {community.membershipStatus === 'moderator' && <Shield className="w-3 h-3 mr-1" />}
                                {community.membershipStatus === 'approved' ? 'Member' : community.membershipStatus}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3 sm:space-y-4 overflow-hidden">
                      {community.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                          {community.description}
                        </p>
                      )}

                      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 min-w-0">
                        <div className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground shrink-0">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{community.moderators.length + 1} members</span>
                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto min-w-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs sm:text-sm whitespace-nowrap shrink-0"
                            onClick={() => {
                              const naddr = generateCommunityNaddr(community.event);
                              const encodedNaddr = encodeNaddrForUrl(naddr);
                              navigate(`/space/${encodedNaddr}`);
                            }}
                          >
                            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            View
                          </Button>

                          <CommunityShareDialog community={community}>
                            <Button variant="outline" size="sm" className="text-xs sm:text-sm whitespace-nowrap shrink-0">
                              <Share2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Share
                            </Button>
                          </CommunityShareDialog>

                          {(community.membershipStatus === 'owner' || community.membershipStatus === 'moderator') && (
                            <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm whitespace-nowrap shrink-0">
                              <Link to={`/communities/${encodeURIComponent(community.id)}/manage`}>
                                <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Manage
                              </Link>
                            </Button>
                          )}

                          {community.membershipStatus !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLeaveCommunity(community.id, community.name)}
                              className="text-xs sm:text-sm whitespace-nowrap shrink-0"
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 sm:py-12 px-4 sm:px-8 text-center">
                  <div className="max-w-sm mx-auto space-y-4">
                    <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground opacity-50" />
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold mb-2">No Communities Yet</h3>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        You haven't joined any communities yet. Discover and join communities that interest you!
                      </p>
                    </div>
                    <Button onClick={() => setSelectedTab("discover")} className="text-sm sm:text-base">
                      Discover Communities
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="discover">
            <CommunityDiscovery />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}