import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateCommunityDialog } from "./CreateCommunityDialog";
import { CommunityDiscovery } from "@/components/discovery/CommunityDiscovery";

interface CommunitySelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommunitySelect?: (communityId: string) => void;
}

export function CommunitySelectionDialog({
  open,
  onOpenChange,
  onCommunitySelect
}: CommunitySelectionDialogProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Reset showCreateDialog when the main dialog is closed
  useEffect(() => {
    if (!open) {
      setShowCreateDialog(false);
    }
  }, [open]);

  const handleCreateCommunity = () => {
    setShowCreateDialog(true);
  };

  const handleCommunitySelect = (communityId: string) => {
    // Reset the create dialog state when selecting a community
    setShowCreateDialog(false);
    onCommunitySelect?.(communityId);
    onOpenChange(false);
  };

  const handleCreateDialogClose = (open: boolean) => {
    setShowCreateDialog(open);
  };

  const handleCommunityCreated = (communityId: string) => {
    // Reset the create dialog state when a community is created
    setShowCreateDialog(false);
    // When a community is created, close this dialog entirely
    onOpenChange(false);
    // Also select the newly created community so the user can see it
    onCommunitySelect?.(communityId);
  };

  // If create dialog is open, show it instead
  if (showCreateDialog) {
    return (
      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={handleCreateDialogClose}
        onCommunityCreated={handleCommunityCreated}
        initialStep="details"
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-background/95 backdrop-blur-sm border border-border">
        <div className="relative z-10">
          <DialogHeader className="pb-6">
            <DialogTitle className="sr-only">Discover and Join Communities</DialogTitle>
            <div className="mt-6 space-y-6">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground text-left mb-4">
                  DISCOVER YOUR SPACE
                  </h1>
                  <p className="text-muted-foreground leading-relaxed text-lg">
                    Explore existing communities to join and connect with like-minded people.
                    Find vibrant discussions, share interests, and become part of growing communities
                    on the decentralized Nostr network.
                  </p>
                </div>

                <div className="lg:w-128">
                  <div className="relative p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-card-foreground mb-2">
                          Can't find what you're looking for?
                        </h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          Create your own community and build the space you've always wanted.
                        </p>
                      </div>
                      <Button
                        onClick={handleCreateCommunity}
                        className="w-full rounded-full py-6 text-lg font-bold text-white bg-gradient-to-r from-nostr-purple to-pink-600 hover:from-nostr-purple/80 hover:to-pink-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-nostr-purple/25"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Space
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <CommunityDiscovery onCommunitySelect={handleCommunitySelect} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}