import { useState, useRef, useEffect } from "react";
import { Settings, Upload, X, Share2, Trash2, Clock, Users, Shield, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCommunities, type Community } from "@/hooks/useCommunities";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCommunityMembers } from "@/hooks/useCommunityMembers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useModerationLogs } from "@/hooks/useModerationLogs";
import { useReports } from "@/hooks/useReporting";
import { useAuthor } from "@/hooks/useAuthor";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { useManageMembers } from "@/hooks/useManageMembers";
import { genUserName } from "@/lib/genUserName";

import { nip19 } from 'nostr-tools';
import { Copy, Check, QrCode, Download, Crown, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

interface CommunitySettingsProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunitySettings({ communityId, open, onOpenChange }: CommunitySettingsProps) {
  const { data: communities } = useCommunities();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("overview");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);


  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { toast } = useToast();
  const { addMember, declineMember } = useManageMembers();
  const [approvingMembers, setApprovingMembers] = useState<Set<string>>(new Set());
  const [decliningMembers, setDecliningMembers] = useState<Set<string>>(new Set());

  // Real data hooks
  const { data: members } = useCommunityMembers(communityId);
  const { data: joinRequests } = useJoinRequests(communityId);
  const { data: moderationLogs } = useModerationLogs(communityId || '');
  const { data: reports } = useReports(communityId);

  const community = communities?.find(c => c.id === communityId);

  // Calculate analytics from real data
  const totalMembers = members?.length || 0;
  const pendingRequests = joinRequests?.length || 0;
  const totalReports = reports?.length || 0;

  // Initialize form data when community changes
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name,
        description: community.description || "",
        image: community.image || "",
      });
    }
  }, [community]);

  if (!community) {
    return null;
  }

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image must be smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setFormData(prev => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  // Handle join request approval
  const handleApproveRequest = async (requesterPubkey: string) => {
    if (!community) return;

    try {
      addMember({
        communityId: community.id,
        memberPubkey: requesterPubkey
      });
      setApprovingMembers(prev => new Set([...prev, requesterPubkey]));
      toast({
        title: "Success",
        description: "Join request approved successfully!",
      });
    } catch (error) {
      console.error("Failed to approve join request:", error);
      toast({
        title: "Error",
        description: "Failed to approve join request",
        variant: "destructive",
      });
    }
  };

  // Handle join request decline
  const handleDeclineRequest = async (requesterPubkey: string) => {
    if (!community) return;

    try {
      declineMember({
        communityId: community.id,
        memberPubkey: requesterPubkey
      });
      setDecliningMembers(prev => new Set([...prev, requesterPubkey]));
      toast({
        title: "Success",
        description: "Join request declined successfully!",
      });
    } catch (error) {
      console.error("Failed to decline join request:", error);
      toast({
        title: "Error",
        description: "Failed to decline join request",
        variant: "destructive",
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !community) return;

    try {
      let imageUrl = formData.image;

      // Upload image if a file is selected
      if (imageFile) {
        try {
          const [[_, url]] = await uploadFile(imageFile);
          imageUrl = url;
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast({
            title: "Error",
            description: "Failed to upload community icon",
            variant: "destructive",
          });
          return;
        }
      }

      // Get the d tag from the original event
      const dTag = community.event.tags.find(([name]) => name === 'd')?.[1] || '';

      const tags = [
        ["d", dTag],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        tags.push(["description", formData.description.trim()]);
      }

      if (imageUrl) {
        tags.push(["image", imageUrl]);
      }

      // Preserve existing moderators
      community.moderators.forEach(moderatorPubkey => {
        tags.push(["p", moderatorPubkey, "", "moderator"]);
      });

      // Add creator as moderator if not already included
      if (!community.moderators.includes(community.creator)) {
        tags.push(["p", community.creator, "", "moderator"]);
      }

      await createEvent({
        kind: 34550,
        content: "",
        tags,
      });

      toast({
        title: "Success",
        description: "Community settings updated successfully!",
      });

      // Reset image upload state
      setImageFile(null);
      setImagePreview("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

    } catch (error) {
      console.error("Failed to update community:", error);
      toast({
        title: "Error",
        description: "Failed to update community settings",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCommunity = async () => {
    if (!user || !community) return;

    try {
      // Create a kind 5 deletion request event
      await createEvent({
        kind: 5,
        content: "Community deleted by owner",
        tags: [
          ["e", community.event.id], // Reference the community event to be deleted
          ["k", "34550"], // Specify the kind of the event being deleted
        ],
      });

      toast({
        title: "Success",
        description: "Community deletion request sent successfully!",
      });

      // Close the settings dialog
      onOpenChange(false);

    } catch (error) {
      console.error("Failed to delete community:", error);
      toast({
        title: "Error",
        description: "Failed to delete community",
        variant: "destructive",
      });
    }
  };

  // Check if user is admin/mod
  const isAdmin = user?.pubkey === community.creator;
  const isModerator = community.moderators.includes(user?.pubkey || '');

  if (!isAdmin && !isModerator) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            You don't have permission to access community settings.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-white dark:bg-gray-900">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-full border">
              <Settings className="w-5 h-5 text-gray-700 dark:text-primary" />
            </div>
            {community.name} Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6">
            <TabsList className="h-16 grid w-full grid-cols-3 bg-muted/50 p-2 rounded-full">
            <TabsTrigger value="overview" className="h-12 text-xs sm:text-sm flex items-center gap-3 rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-md">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Settings className="w-4 h-4 text-gray-700 dark:text-primary" />
              </div>
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="h-12 text-xs sm:text-sm flex items-center gap-3 relative rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-md">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-700 dark:text-primary" />
              </div>
              Members
              {pendingRequests > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {pendingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="h-12 text-xs sm:text-sm flex items-center gap-3 rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-md">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-700 dark:text-primary" />
              </div>
              Audit
            </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] px-6">
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Community Overview */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <Settings className="w-5 h-5" />
                    Community Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-primary/5 rounded-lg border">
                      <div className="text-2xl font-bold text-gray-600 dark:text-primary">{totalMembers}</div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground">Total Members</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pendingRequests}</div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground">Pending Requests</div>
                    </div>
                    <div className="text-center p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{totalReports}</div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-muted-foreground">Reports</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Community Information */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <Settings className="w-5 h-5" />
                    Community Information
                  </CardTitle>
                  <CardDescription>
                    Basic settings for your community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Community Icon */}
                  <div className="space-y-2">
                    <Label>Community Icon</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={imagePreview || formData.image || community.image} />
                          <AvatarFallback className="text-lg">
                            {community.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || !isAdmin}
                          className="flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {isUploading ? "Uploading..." : "Upload Icon"}
                        </Button>
                        {(imagePreview || formData.image || community.image) && isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={removeImage}
                            className="flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Remove
                          </Button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload a square image (recommended: 256x256px, max 5MB). Only admins can change the community icon.
                    </p>
                  </div>

                  {/* Community Name */}
                  <div className="space-y-2">
                    <Label htmlFor="community-name">Community Name</Label>
                    <Input
                      id="community-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isAdmin}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="community-description">Description</Label>
                    <Textarea
                      id="community-description"
                      placeholder="Describe your community..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      disabled={!isAdmin}
                      rows={3}
                    />
                  </div>

                  {/* Approval Setting */}
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        <Label>Invite-Only Community</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        All new members require approval to join
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 font-medium">Enabled</span>
                    </div>
                  </div>

                  {/* Save Button */}
                  {isAdmin && (
                    <div className="pt-4 flex justify-end">
                      <Button
                        onClick={handleSaveChanges}
                        disabled={isUploading}
                      >
                        {isUploading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sharing Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <Share2 className="w-5 h-5" />
                    Share Community
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CommunityShareContent community={community} />
                </CardContent>
              </Card>

              {/* Danger Zone */}
              {isAdmin && (
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-2xl text-destructive flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Irreversible actions for this community
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            Delete Community
                          </Button>
                        </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the community
                            and remove all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={handleDeleteCommunity}
                          >
                            Delete Community
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="members" className="space-y-4 mt-4">
              {/* Join Requests */}
              {pendingRequests > 0 && (
                <Card className="bg-gray-50 dark:bg-gray-800">
                  <CardHeader>
                    <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                      <Clock className="w-5 h-5" />
                      Pending Join Requests ({pendingRequests})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {joinRequests?.map((request) => (
                        <JoinRequestItem
                          key={request.event.id}
                          request={request}
                          onApprove={() => handleApproveRequest(request.requesterPubkey)}
                          onDecline={() => handleDeclineRequest(request.requesterPubkey)}
                          isApproving={approvingMembers.has(request.requesterPubkey)}
                          isDeclining={decliningMembers.has(request.requesterPubkey)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Member Management */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <Users className="w-5 h-5" />
                    Member Management
                  </CardTitle>
                  <CardDescription>
                    Manage community members and their roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {members && members.length > 0 ? (
                      members.slice(0, 10).map((member) => (
                        <MemberItem key={member.pubkey} member={member} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No members found</p>
                      </div>
                    )}
                    {members && members.length > 10 && (
                      <div className="flex justify-end pt-2">
                        <Button variant="outline">
                          View All {members.length} Members
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4 mt-4">
              {/* Reports */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <Shield className="w-5 h-5" />
                    Moderation Queue ({totalReports})
                  </CardTitle>
                  <CardDescription>
                    Review flagged content and user reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reports && reports.length > 0 ? (
                      reports.slice(0, 5).map((report) => (
                        <ReportItem key={report.id} report={report} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No pending reports</p>
                      </div>
                    )}
                    {reports && reports.length > 5 && (
                      <div className="flex justify-end pt-2">
                        <Button variant="outline">
                          View All {reports.length} Reports
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Audit Log */}
              <Card className="bg-gray-50 dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-3">
                    <FileText className="w-5 h-5" />
                    Audit Log
                  </CardTitle>
                  <CardDescription>
                    Recent moderation and administrative actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {moderationLogs && moderationLogs.length > 0 ? (
                      moderationLogs.slice(0, 10).map((log) => (
                        <ModerationLogItem key={log.id} log={log} />
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No moderation actions recorded</p>
                      </div>
                    )}
                    {moderationLogs && moderationLogs.length > 10 && (
                      <div className="flex justify-end pt-2">
                        <Button variant="outline">
                          View All {moderationLogs.length} Actions
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>

          <div className="flex justify-end pt-4 px-6 pb-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for displaying reports
function ReportItem({ report }: { report: { targetPubkey: string; reporterPubkey: string; reportType: string; reason: string; createdAt: number; targetEventId?: string } }) {
  const targetAuthor = useAuthor(report.targetPubkey);
  const reporterAuthor = useAuthor(report.reporterPubkey);
  const targetDisplayName = targetAuthor.data?.metadata?.name || genUserName(report.targetPubkey);
  const reporterDisplayName = reporterAuthor.data?.metadata?.name || genUserName(report.reporterPubkey);

  const targetNpub = nip19.npubEncode(report.targetPubkey);
  const reporterNpub = nip19.npubEncode(report.reporterPubkey);

  const { toast } = useToast();

  const handleCopyNpub = (npub: string, userType: string) => {
    navigator.clipboard.writeText(npub);
    toast({
      title: 'Copied to clipboard',
      description: `${userType} npub copied to clipboard`,
    });
  };

  const timeAgo = new Date(report.createdAt * 1000).toLocaleString();

  return (
    <div className="p-3 border rounded-lg bg-card">
      <div className="space-y-3">
        {/* Reported User */}
        <div className="space-y-1">
          <div className="font-medium flex items-center gap-2">
            <span className="text-destructive">Reported User:</span>
            {targetDisplayName}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCopyNpub(targetNpub, 'Target user')}
              title="Copy target user npub"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {targetNpub}
          </div>
        </div>

        {/* Reporting User */}
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>Reported by:</span>
            {reporterDisplayName}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => handleCopyNpub(reporterNpub, 'Reporter')}
              title="Copy reporter npub"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {reporterNpub}
          </div>
        </div>

        {/* Report Details */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <p className="text-sm font-medium">
            {report.targetEventId ? 'Content reported' : 'User reported'}
          </p>
          <Badge variant="outline" className="text-xs">
            {report.reportType}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          {timeAgo}
        </p>

        {report.reason && (
          <p className="text-xs text-muted-foreground italic">"{report.reason}"</p>
        )}
      </div>

      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="destructive">
          {report.targetEventId ? 'Delete Content' : 'Ban User'}
        </Button>
      </div>
    </div>
  );
}

// Helper component for displaying moderation log items
function ModerationLogItem({ log }: { log: { action: string; moderatorPubkey: string; targetPubkey?: string; reason: string; createdAt: number } }) {
  const moderator = useAuthor(log.moderatorPubkey);
  const target = useAuthor(log.targetPubkey || '');

  const moderatorName = moderator.data?.metadata?.name || genUserName(log.moderatorPubkey);
  const targetName = log.targetPubkey ? (target.data?.metadata?.name || genUserName(log.targetPubkey)) : null;

  const timeAgo = new Date(log.createdAt * 1000).toLocaleString();

  const getActionIcon = () => {
    switch (log.action) {
      case 'ban':
      case 'mute':
        return <Shield className="w-4 h-4 mt-1 text-destructive" />;
      case 'delete':
        return <Trash2 className="w-4 h-4 mt-1 text-destructive" />;
      case 'approve':
        return <Shield className="w-4 h-4 mt-1 text-green-500" />;
      default:
        return <FileText className="w-4 h-4 mt-1" />;
    }
  };

  const getActionDescription = () => {
    const actionText = log.action.charAt(0).toUpperCase() + log.action.slice(1);
    if (targetName) {
      return `${moderatorName} ${log.action}ned ${targetName}`;
    }
    return `${moderatorName} performed ${actionText}`;
  };

  return (
    <div className="flex items-start gap-3 p-3 border rounded-lg bg-card">
      <div className="p-2 bg-muted rounded-full">
        {getActionIcon()}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{getActionDescription()}</p>
        {log.reason && (
          <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>
        )}
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}

// Component for sharing content (extracted from CommunityShareDialog)
function CommunityShareContent({ community }: { community: Community }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(true);
  const { toast } = useToast();

  // Parse community ID to get the components for naddr
  const [kind, pubkey, identifier] = community.id.split(':');

  // Generate naddr for the community with error handling
  let naddr = '';
  try {
    // Pad the pubkey to 64 characters (32 bytes) if needed
    const paddedPubkey = pubkey.padStart(64, '0');

    naddr = nip19.naddrEncode({
      kind: parseInt(kind),
      pubkey: paddedPubkey,
      identifier,
      relays: community.relays.length > 0 ? community.relays : undefined,
    });
  } catch (error) {
    console.error('Failed to generate naddr:', error);
    // Fallback to a simple join URL without naddr
  }

  // Generate shareable URLs
  const baseUrl = window.location.origin;
  const joinUrl = `${baseUrl}/join/${naddr}`;

  // Auto-generate QR code when component mounts
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        setIsGeneratingQR(true);
        const qrDataUrl = await QRCode.toDataURL(joinUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(qrDataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
        toast({
          title: 'Error',
          description: 'Failed to generate QR code',
          variant: 'destructive',
        });
      } finally {
        setIsGeneratingQR(false);
      }
    };

    generateQRCode();
  }, [joinUrl, toast]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied to clipboard',
        description: 'The link has been copied to your clipboard.',
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `${community.name}-join-qr.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Downloaded',
      description: 'QR code has been downloaded',
    });
  };

  const CopyButton = ({ text, field, className = '' }: { text: string; field: string; className?: string }) => (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Join Link */}
      <div className="space-y-3">
        <div>
          <Label>Join Link</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Direct link for people to request to join your community
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={joinUrl}
            readOnly
            className="font-mono text-sm"
          />
          <CopyButton text={joinUrl} field="join-url" />
        </div>
      </div>

      {/* Nostr Address */}
      <div className="space-y-3">
        <div>
          <Label>Nostr Address (naddr)</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Technical identifier for Nostr clients and developers
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={naddr}
            readOnly
            className="font-mono text-sm"
          />
          <CopyButton text={naddr} field="naddr" />
        </div>
      </div>

      {/* QR Code Section */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2 flex items-center justify-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code
          </h3>
          <p className="text-sm text-muted-foreground">
            Scan this QR code to join the community
          </p>
        </div>
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-lg border">
            {isGeneratingQR ? (
              <div className="w-64 h-64 bg-muted animate-pulse rounded" />
            ) : qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={`QR code for ${community.name}`}
                className="w-64 h-64"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                Failed to generate QR code
              </div>
            )}
          </div>
        </div>
        {qrCodeDataUrl && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQRCode}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}



// Helper component for displaying join requests
function JoinRequestItem({
  request,
  onApprove,
  onDecline,
  isApproving,
  isDeclining
}: {
  request: { requesterPubkey: string; message: string; createdAt: number };
  onApprove: () => void;
  onDecline: () => void;
  isApproving: boolean;
  isDeclining: boolean;
}) {
  const author = useAuthor(request.requesterPubkey);
  const displayName = author.data?.metadata?.name || genUserName(request.requesterPubkey);
  const avatar = author.data?.metadata?.picture;

  const timeAgo = new Date(request.createdAt * 1000).toLocaleString();

  return (
    <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
      <div className="flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={avatar} alt={displayName} />
          <AvatarFallback>
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{displayName}</p>
          <p className="text-sm text-muted-foreground">Requested {timeAgo}</p>
          {request.message && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{request.message}"</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-col sm:flex-row">
        <Button
          size="sm"
          variant="outline"
          onClick={onApprove}
          disabled={isApproving || isDeclining}
          className="border-green-500/50 text-green-600 hover:bg-green-500/10"
        >
          {isApproving ? "Approving..." : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDecline}
          disabled={isApproving || isDeclining}
        >
          {isDeclining ? "Declining..." : "Decline"}
        </Button>
      </div>
    </div>
  );
}

// Helper component for displaying member items
function MemberItem({ member }: { member: { pubkey: string; role: 'owner' | 'moderator' | 'member'; isOnline: boolean } }) {
  const author = useAuthor(member.pubkey);
  const displayName = author.data?.metadata?.name || genUserName(member.pubkey);
  const avatar = author.data?.metadata?.picture;



  const getRoleIcon = () => {
    switch (member.role) {
      case 'owner':
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'moderator':
        return <Shield className="w-3 h-3 text-primary" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={avatar} alt={displayName} />
          <AvatarFallback>
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{displayName}</p>
            {member.isOnline && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Online" />
            )}
          </div>
          <div className="flex gap-1">
            <Badge variant={member.role === 'owner' ? 'secondary' : 'outline'} className="flex items-center gap-1">
              {getRoleIcon()}
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline">Manage</Button>
    </div>
  );
}



