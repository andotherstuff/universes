import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/useToast";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Upload, X, Users, Sparkles, MessageSquare, Hash, Settings, Share, Wand2, Plus, Shield } from "lucide-react";
import { cn, communityIdToNaddr, generateChannelIdentifier } from "@/lib/utils";
import type { Community } from "@/hooks/useCommunities";
import { QuickSetupStep } from "./QuickSetupStep";


interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommunityCreated?: (communityId: string) => void;
}

export function CreateCommunityDialog({ open, onOpenChange, onCommunityCreated }: CreateCommunityDialogProps) {
  const [step, setStep] = useState<'welcome' | 'details' | 'quicksetup' | 'create' | 'success'>('welcome');
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [createdCommunityId, setCreatedCommunityId] = useState<string>("");
  const [selectedModerators, setSelectedModerators] = useState<string[]>([]);
  const [requireApproval, setRequireApproval] = useState<boolean>(false);
  const [preApprovedUsers, setPreApprovedUsers] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('welcome');
      setFormData({ name: "", description: "", image: "" });
      setImageFile(null);
      setImagePreview("");
      setCreatedCommunityId("");
      setSelectedModerators([]);
      setRequireApproval(false);
      setPreApprovedUsers([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

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

  // Optimistic community creation mutation
  const createCommunityMutation = useMutation({
    mutationFn: async () => {
      // Move to create step for animation
      setStep('create');

      // Add a dramatic pause for the creation effect
      await new Promise(resolve => setTimeout(resolve, 2000));

      let imageUrl = formData.image;

      // Upload image if a file is selected
      if (imageFile) {
        try {
          const [[_, url]] = await uploadFile(imageFile);
          imageUrl = url;
        } catch (error) {
          console.error("Failed to upload image:", error);
          throw new Error("Failed to upload community icon");
        }
      }

      const communityIdentifier = generateChannelIdentifier(formData.name);

      // Create community definition event
      const communityTags = [
        ["d", communityIdentifier],
        ["name", formData.name.trim()],
      ];

      if (formData.description.trim()) {
        communityTags.push(["description", formData.description.trim()]);
      }

      if (imageUrl) {
        communityTags.push(["image", imageUrl]);
      }

      // Add creator as moderator
      communityTags.push(["p", user!.pubkey, "", "moderator"]);

      // Add selected moderators
      selectedModerators.forEach(moderatorPubkey => {
        communityTags.push(["p", moderatorPubkey, "", "moderator"]);
      });

      const communityEvent = await createEvent({
        kind: 34550,
        content: "",
        tags: communityTags,
      });

      // Create simplified community settings event
      const settingsTags = [
        ["d", `34550:${user!.pubkey}:${communityIdentifier}`],
        ["require_approval", requireApproval.toString()],
        ["allow_anonymous", "true"],
        ["moderation_policy", "moderate"],
        ["max_post_length", "280"],
        ["auto_moderation", JSON.stringify({
          enabled: false,
          spamDetection: true,
          profanityFilter: false,
          linkValidation: true,
        })],
        ["notifications", JSON.stringify({
          newMembers: true,
          newPosts: false,
          reports: true,
          mentions: true,
        })],
      ];

      await createEvent({
        kind: 34552,
        content: "",
        tags: settingsTags,
      });

      // Create approved members list if approval is required
      if (requireApproval && preApprovedUsers.length > 0) {
        const approvedMembersTags = [
          ["d", `34550:${user!.pubkey}:${communityIdentifier}`],
          ["t", "approved-members"],
        ];

        // Add pre-approved users
        preApprovedUsers.forEach(userPubkey => {
          approvedMembersTags.push(["p", userPubkey]);
        });

        await createEvent({
          kind: 34551,
          content: "",
          tags: approvedMembersTags,
        });
      }

      // Create default general channel with auto-generated identifier
      const channelDisplayName = 'general';
      const channelIdentifier = generateChannelIdentifier(channelDisplayName);
      const channelTags = [
        ["d", `34550:${user!.pubkey}:${communityIdentifier}:${channelIdentifier}`],
        ["a", `34550:${user!.pubkey}:${communityIdentifier}`],
        ["name", channelIdentifier],
        ["description", "General discussion"],
        ["channel_type", "text"],
        ["position", "0"],
        ["t", "channel"],
        ["alt", `Channel: ${channelIdentifier}`],
      ];

      await createEvent({
        kind: 32807,
        content: JSON.stringify({
          name: channelIdentifier,
          description: "General discussion",
          type: "text",
          position: 0,
        }),
        tags: channelTags,
      });

      return communityEvent;
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['communities'] });

      // Snapshot the previous value
      const previousCommunities = queryClient.getQueryData<Community[]>(['communities']);

      // Create optimistic community
      const communityId = `34550:${user!.pubkey}:${generateChannelIdentifier(formData.name)}`;
      setCreatedCommunityId(communityId);

      const optimisticCommunity: Community = {
        id: communityId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        creator: user!.pubkey,
        moderators: [],
        relays: [],
        event: {
          id: `optimistic-community-${Date.now()}`,
          pubkey: user!.pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: 34550,
          tags: [],
          content: "",
          sig: "",
        },
      };

      // Optimistically update to the new value
      queryClient.setQueryData<Community[]>(['communities'], old => {
        return [...(old || []), optimisticCommunity];
      });

      // Return a context object with the snapshotted value
      return { previousCommunities, optimisticCommunity };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousCommunities) {
        queryClient.setQueryData(['communities'], context.previousCommunities);
      }

      console.error("Failed to create space:", err);
      toast({
        title: "Error",
        description: "Failed to create space. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Space created successfully!",
      });

      // Move to success step after creation animation
      setTimeout(() => {
        setStep('success');
      }, 500);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || createCommunityMutation.isPending || isUploading) return;

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Space name is required",
        variant: "destructive",
      });
      return;
    }

    createCommunityMutation.mutate();
  };

  const getTitle = () => {
    if (step === 'welcome') return (
      <span className="flex items-center justify-center gap-2">
        <Plus className="w-5 h-5 text-primary" />
        Create Your Space
      </span>
    );
    if (step === 'details') return (
      <span className="flex items-center justify-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        Space Details
      </span>
    );
    if (step === 'quicksetup') return (
      <span className="flex items-center justify-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        Quick Setup
      </span>
    );
    if (step === 'create') return (
      <span className="flex items-center justify-center gap-2">
        <Wand2 className="w-5 h-5 text-primary" />
        Creating Space
      </span>
    );
    return (
      <span className="flex items-center justify-center gap-2">
        <Share className="w-5 h-5 text-primary" />
        Space Ready!
      </span>
    );
  };

  const getDescription = () => {
    if (step === 'welcome') return 'Start building your space';
    if (step === 'details') return 'Set up your space details';
    if (step === 'quicksetup') return 'Configure moderation and team settings';
    if (step === 'create') return 'Creating your space...';
    return 'Your space is ready to share!';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] max-h-[90dvh] p-0 overflow-hidden rounded-2xl flex flex-col bg-gradient-to-br from-indigo-900/95 via-purple-900/95 to-pink-900/95 backdrop-blur-sm border border-purple-500/20")}
      >
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>
        <DialogHeader className={cn('px-6 pt-6 pb-1 relative flex-shrink-0 z-10')}>
          <DialogTitle className={cn('font-bold text-center text-2xl text-white', step === 'welcome' && 'hidden')}>
            {getTitle()}
          </DialogTitle>
          <DialogDescription className={cn(`text-purple-200 text-center ${step === 'create' && 'hidden'}`, step === 'welcome' && 'hidden')}>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <div className='px-6 pt-2 pb-4 space-y-4 overflow-y-scroll flex-1 relative z-10'>
          {/* Welcome Step - Guided flow introduction */}
          {step === 'welcome' && (
            <div className='text-center space-y-6'>
              {/* Hero illustration with community focus */}
              <div className='relative p-8 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
                <div className='flex flex-col items-center space-y-4'>
                  {/* Central community icon */}
                  <div className='relative'>
                    <div className='w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30'>
                      <Users className='w-10 h-10 text-purple-400' />
                    </div>
                    <div className='absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center animate-bounce'>
                      <Sparkles className='w-3 h-3 text-white' />
                    </div>
                  </div>

                  {/* Orbiting elements */}
                  <div className='relative w-32 h-32'>
                    <MessageSquare className='absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-8 text-blue-400 animate-pulse' />
                    <Hash className='absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-8 text-purple-400 animate-pulse' style={{animationDelay: '0.5s'}} />
                    <Settings className='absolute left-0 top-1/2 transform -translate-y-1/2 w-8 h-8 text-pink-400 animate-pulse' style={{animationDelay: '1s'}} />
                    <Share className='absolute right-0 top-1/2 transform -translate-y-1/2 w-8 h-8 text-blue-400 animate-pulse' style={{animationDelay: '1.5s'}} />
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <div className='space-y-2'>
                  <h3 className='text-3xl font-bold text-white'>
                    CREATE YOUR SPACE
                  </h3>
                  <p className='text-purple-200 px-4 leading-relaxed text-lg'>
                    Build a dedicated space where your members can chat, share resources,
                    and collaborate. Your space will have organized channels,
                    moderation tools, and live on the decentralized Nostr network.
                  </p>
                </div>

                <div className='space-y-3'>
                  <Button
                    className='w-full rounded-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-purple-500/25'
                    onClick={() => setStep('details')}
                  >
                    <Plus className='w-5 h-5 mr-2' />
                    Create Space
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Details Step - Community-focused form */}
          {step === 'details' && (
            <div className='text-center space-y-4'>
              {/* Form illustration */}
              <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 overflow-hidden'>
                {/* Sparkles */}
                <div className='absolute inset-0 pointer-events-none'>
                  <Sparkles className='absolute top-3 left-4 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '0s'}} />
                  <Sparkles className='absolute top-6 right-6 w-3 h-3 text-yellow-500 animate-pulse' style={{animationDelay: '0.5s'}} />
                  <Sparkles className='absolute bottom-4 left-6 w-3 h-3 text-yellow-400 animate-pulse' style={{animationDelay: '1s'}} />
                </div>

                <div className='relative z-10 flex justify-center items-center mb-3'>
                  <div className='relative'>
                    <div className='w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30'>
                      <Settings className='w-8 h-8 text-purple-400' />
                    </div>
                    <div className='absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center animate-bounce'>
                      <Sparkles className='w-3 h-3 text-white' />
                    </div>
                  </div>
                </div>

                <div className='relative z-10 space-y-2'>
                  <p className='text-2xl font-bold text-white'>
                    CUSTOMIZE YOUR SPACE
                  </p>
                  <p className='text-purple-200'>
                    Give your space an identity that members will recognize
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                setStep('quicksetup');
              }} className="space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="community-icon" className="text-sm font-medium text-purple-200">Space Icon</Label>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={imagePreview || formData.image} />
                      <AvatarFallback className="text-lg">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
                      >
                        <Upload className="w-4 h-4" />
                        {isUploading ? "Uploading..." : "Upload Icon"}
                      </Button>
                      {(imagePreview || formData.image) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeImage}
                          className="flex items-center gap-2 bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
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
                  <p className="text-xs text-purple-300">
                    Upload a square image (recommended: 256x256px, max 5MB)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-purple-200">Space Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Awesome Space"
                    required
                    className="rounded-lg bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                  />
                </div>



                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-purple-200">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="A place for awesome discussions..."
                    rows={3}
                    className="rounded-lg resize-none bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-purple-500/20"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={createCommunityMutation.isPending || isUploading}
                    className="rounded-full bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCommunityMutation.isPending || isUploading}
                    className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/25"
                  >
                    Continue to Setup
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Quick Setup Step */}
          {step === 'quicksetup' && (
            <QuickSetupStep
              selectedModerators={selectedModerators}
              onModeratorsChange={setSelectedModerators}
              requireApproval={requireApproval}
              onRequireApprovalChange={setRequireApproval}
              preApprovedUsers={preApprovedUsers}
              onPreApprovedUsersChange={setPreApprovedUsers}
              onCreateCommunity={() => handleSubmit(new Event('submit') as unknown as React.FormEvent)}
              onPrevious={() => setStep('details')}
            />
          )}

          {/* Create Step - Community creation animation */}
          {step === 'create' && (
            <div className='text-center space-y-4'>
              <div className='relative p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950/50 dark:to-pink-950/50 overflow-hidden'>
                {/* Animated background elements */}
                <div className='absolute inset-0'>
                  {[...Array(12)].map((_, i) => (
                    <Sparkles
                      key={i}
                      className={`absolute w-4 h-4 text-yellow-400 animate-ping`}
                      style={{
                        left: `${Math.random() * 80 + 10}%`,
                        top: `${Math.random() * 80 + 10}%`,
                        animationDelay: `${Math.random() * 2}s`
                      }}
                    />
                  ))}
                </div>

                <div className='relative z-10'>
                  <div className='space-y-3'>
                    <div className='relative'>
                      <Users className='w-20 h-20 text-primary mx-auto animate-pulse' />
                      <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='w-24 h-24 border-4 border-purple-600 border-t-transparent rounded-full animate-spin'></div>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      <p className='text-lg font-semibold text-primary flex items-center justify-center gap-2'>
                        <Wand2 className='w-5 h-5' />
                        Creating your space...
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        Setting up your space and channels
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Step - Share prompt */}
          {step === 'success' && (
            <div className='text-center space-y-6'>
              {/* Success illustration */}
              <div className='relative p-8 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
                <div className='flex flex-col items-center space-y-4'>
                  {/* Success icon */}
                  <div className='relative'>
                    <div className='w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center shadow-lg border border-indigo-500/30'>
                      <Users className='w-10 h-10 text-indigo-400' />
                    </div>
                    <div className='absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center animate-bounce'>
                      <Sparkles className='w-3 h-3 text-white' />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <h3 className='text-2xl font-bold text-white'>
                      Space Created Successfully!
                    </h3>
                    <p className='text-indigo-200'>
                      {formData.name} is ready for members
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <p className='text-indigo-200 px-4'>
                  Your space is now live! Start by inviting members to join
                  and begin conversations in your space's channels.
                </p>

                <div className='space-y-3'>
                  <Button
                    className='w-full rounded-full py-6 text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-indigo-500/25'
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigate to the community using encoded naddr
                      if (createdCommunityId) {
                        // Notify parent that community was created and user wants to navigate to it
                        onCommunityCreated?.(createdCommunityId);

                        // Close dialog first
                        onOpenChange(false);

                        // Small delay to ensure dialog closes before navigation
                        setTimeout(() => {
                          try {
                            const naddr = communityIdToNaddr(createdCommunityId);
                            navigate(`/space/${naddr}`);
                          } catch (error) {
                            console.error('Failed to encode community ID:', error);
                            // Fallback to unencoded format if encoding fails
                            navigate(`/space/${createdCommunityId}`);
                          }
                        }, 100);
                      }
                    }}
                  >
                    <MessageSquare className='w-5 h-5 mr-2' />
                    Go to Space
                  </Button>

                  <Button
                    variant="outline"
                    className='w-full rounded-full py-4 bg-slate-800/50 border-slate-700/50 text-indigo-200 hover:bg-slate-700/50 hover:text-white'
                    onClick={(e) => {
                      e.preventDefault();
                      // Navigate to the community with share dialog open using encoded naddr
                      if (createdCommunityId) {
                        // Notify parent that community was created and user wants to navigate to it
                        onCommunityCreated?.(createdCommunityId);

                        // Close dialog first
                        onOpenChange(false);

                        // Small delay to ensure dialog closes before navigation
                        setTimeout(() => {
                          try {
                            const naddr = communityIdToNaddr(createdCommunityId);
                            navigate(`/space/${naddr}?share=true`);
                          } catch (error) {
                            console.error('Failed to encode community ID:', error);
                            // Fallback to unencoded format if encoding fails
                            navigate(`/space/${createdCommunityId}?share=true`);
                          }
                        }, 100);
                      }
                    }}
                  >
                    <Share className='w-4 h-4 mr-2' />
                    Share Space
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}