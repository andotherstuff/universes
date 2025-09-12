import { useState, useEffect } from "react";
import { nip19 } from "nostr-tools";
import { DirectMessages } from "@/components/dm/DirectMessages";
import { BasePageLayout } from "./BasePageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutualFriends } from "@/hooks/useFollowers";
import { useNavigate } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";
import { FriendItem } from "@/components/friends/FriendsList";

interface DMLayoutProps {
	targetPubkey?: string;
}

// Layout specifically for Direct Messages
export function DMLayout({ targetPubkey }: DMLayoutProps = {}) {
	const { user } = useCurrentUser();
	const { data: mutualFriends } = useMutualFriends();
	const navigate = useNavigate();
	const [dmTargetPubkey, setDmTargetPubkey] = useState<string | null>(null);
	const [selectedDMConversation, setSelectedDMConversation] = useState<string | null>(null);

	// Convert npub to hex if needed
	useEffect(() => {
		if (targetPubkey) {
			let targetHexPubkey: string | null = null;
			try {
				const decoded = nip19.decode(targetPubkey);
				if (decoded.type === 'npub') {
					targetHexPubkey = decoded.data;
				}
			} catch (error) {
				console.error('Invalid npub format:', error);
				// Fallback: treat as hex pubkey if it's 64 hex characters
				if (targetPubkey.match(/^[a-f0-9]{64}$/i)) {
					targetHexPubkey = targetPubkey;
				}
			}

			setDmTargetPubkey(targetHexPubkey);
			setSelectedDMConversation(targetHexPubkey);
		}
	}, [targetPubkey]);

	const handleNavigateToDMs = (targetPubkey?: string) => {
		if (targetPubkey) {
			setDmTargetPubkey(targetPubkey);
			setSelectedDMConversation(targetPubkey);
		} else {
			setSelectedDMConversation(null);
		}
	};


	const friendsPanel = (
		<Virtuoso
			data={mutualFriends || []}
			itemContent={(index, friend) => (
				<div className="p-4 pt-0">
					<FriendItem
						friend={friend}
						onMessage={(pubkey) => navigate(`/dm/${pubkey}`)}
					/>
				</div>
			)}
			components={{
				Header: () => (
					<div className="p-4">
						<h3 className="font-semibold text-sm text-muted-foreground mb-3">FRIENDS</h3>
					</div>
				),
				EmptyPlaceholder: () => (
					<div className="p-4">
						<p className="text-sm text-muted-foreground">No mutual friends yet</p>
						<p className="text-xs text-muted-foreground mt-1">
							Friends appear when you follow each other
						</p>
					</div>
				),
				Footer: () => <div className="h-2" />,
			}}
			className="flex-1 scrollbar-thin"
		/>
	);

	const mainContent = (
		<DirectMessages
			targetPubkey={dmTargetPubkey}
			selectedConversation={selectedDMConversation}
			onTargetHandled={() => {
				setDmTargetPubkey(null);
				setSelectedDMConversation(null);
			}}
			onNavigateToDMs={handleNavigateToDMs}
			onConversationSelect={setSelectedDMConversation}
		/>
	);

	return (
		<BasePageLayout
			mainContent={
				user ? mainContent : (
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access direct messages.
							</p>
						</div>
					</div>
				)
			}
			rightPanel={user ? friendsPanel : undefined}
			showUserPanel={false}
		/>
	);
}

export default DMLayout;
