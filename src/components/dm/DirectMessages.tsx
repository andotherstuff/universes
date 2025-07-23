import { useState, useEffect } from "react";
import { Search, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DMConversationList } from "./DMConversationList";
import { DMChatArea } from "./DMChatArea";
import { NewDMDialog } from "./NewDMDialog";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface DirectMessagesProps {
  targetPubkey?: string | null;
  onTargetHandled?: () => void;
  onNavigateToDMs?: (targetPubkey: string) => void;
}

export function DirectMessages({ targetPubkey, onTargetHandled, onNavigateToDMs }: DirectMessagesProps = {}) {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { user } = useCurrentUser();
  const { data: conversations } = useDirectMessages();

  // Auto-select conversation when targetPubkey is provided
  useEffect(() => {
    if (targetPubkey) {
      // Always set the selected conversation to the target pubkey
      // This works for both existing conversations and new ones
      setSelectedConversation(targetPubkey);
      // Mark the target as handled
      onTargetHandled?.();
    }
  }, [targetPubkey, onTargetHandled]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <p>You must be logged in to view direct messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-60 bg-gray-700 flex flex-col border-r border-gray-600">
        {/* Header */}
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Messages</h2>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 hover:bg-gray-800/60"
              onClick={() => setShowNewDM(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-600 border-gray-500 text-gray-100 placeholder:text-gray-400 focus:bg-gray-800/60 transition-colors"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <DMConversationList
              conversations={conversations || []}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              searchQuery={searchQuery}
            />
          </ScrollArea>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1">
        {selectedConversation ? (
          <DMChatArea
            conversationId={selectedConversation}
            onNavigateToDMs={onNavigateToDMs}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
              <p className="text-sm mb-4">Choose a conversation to start messaging!</p>
              <Button onClick={() => setShowNewDM(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Start New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New DM Dialog */}
      <NewDMDialog
        open={showNewDM}
        onOpenChange={setShowNewDM}
        onConversationCreated={(pubkey) => {
          setSelectedConversation(pubkey);
          setShowNewDM(false);
        }}
      />
    </div>
  );
}