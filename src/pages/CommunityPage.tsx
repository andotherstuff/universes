import { useState, useEffect } from "react";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { ChatArea } from "@/components/layout/ChatArea";
import { MemberList } from "@/components/layout/MemberList";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useChannels } from "@/hooks/useChannels";
import { useNavigate, useParams } from "react-router-dom";
import { decodeNaddrFromUrl } from "@/lib/utils";

// Page component for Community pages
export function CommunityPage() {
	const { communityId, channelId } = useParams<{ communityId: string; channelId?: string }>();
	const { user } = useCurrentUser();
	const navigate = useNavigate();

	const [selectedChannel, setSelectedChannel] = useState<string | null>(channelId || null);
	const [showMemberList, setShowMemberList] = useState(true);

	// Decode naddr format if needed (handle undefined case)
	let decodedCommunityId = communityId || '';
	if (communityId && communityId.startsWith('naddr1')) {
		try {
			decodedCommunityId = decodeNaddrFromUrl(communityId);
		} catch {
			console.error('Failed to decode naddr');
			decodedCommunityId = communityId;
		}
	}

	const { data: channels } = useChannels(decodedCommunityId);

	// Auto-select default channel when community loads
	useEffect(() => {
		if (decodedCommunityId && channels && channels.length > 0) {
			let newSelectedChannel = selectedChannel;

			if (selectedChannel) {
				const currentChannelExists = channels.some((channel) => channel.id === selectedChannel);
				if (!currentChannelExists) {
					newSelectedChannel = null;
				}
			}

			if (!newSelectedChannel) {
				const generalChannel = channels.find((channel) =>
					channel.name.toLowerCase() === "general" && channel.type === "text"
				);

				if (generalChannel) {
					newSelectedChannel = generalChannel.id;
				} else {
					const firstTextChannel = channels.find((channel) =>
						channel.type === "text"
					);
					if (firstTextChannel) {
						newSelectedChannel = firstTextChannel.id;
					}
				}
			}

			if (newSelectedChannel !== selectedChannel) {
				setSelectedChannel(newSelectedChannel);
			}
		}
	}, [decodedCommunityId, channels, selectedChannel]);

	const handleCommunitySectionSelect = (sectionName: string) => {
		// Navigate to the appropriate community section page
		if (!communityId) return; // Guard against undefined

		if (sectionName === 'marketplace') {
			navigate(`/space/${encodeURIComponent(communityId)}/marketplace`);
		} else if (sectionName === 'resources') {
			navigate(`/space/${encodeURIComponent(communityId)}/resources`);
		}
	};

	// Always viewing channels on this page (spaces have separate routes now)
	const isShowingMemberList = showMemberList && selectedChannel;

	// Fail fast - login required
	if (!user) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access communities.
							</p>
						</div>
					</div>
				}
			/>
		);
	}

	// Fail fast - community ID required
	if (!communityId) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Community Not Found</h2>
							<p className="text-muted-foreground">
								The requested community could not be found.
							</p>
						</div>
					</div>
				}
			/>
		);
	}

	// At this point, communityId is guaranteed to exist, so decodedCommunityId is a string
	const finalCommunityId = decodedCommunityId || communityId;

	return (
		<BasePageLayout
			leftPanel={
				<CommunityPanel
					communityId={finalCommunityId}
					selectedChannel={selectedChannel}
					selectedSpace={null} // No spaces selected on channel page
					onSelectChannel={setSelectedChannel}
					onSelectSpace={handleCommunitySectionSelect}
				/>
			}
			mainContent={
				// CHANNEL CHAT: Always show chat interface (spaces have separate routes)
				<ChatArea
					communityId={finalCommunityId}
					channelId={selectedChannel}
					onToggleMemberList={() => setShowMemberList(!showMemberList)}
				/>
			}
			rightPanel={
				isShowingMemberList ? (
					<MemberList
						communityId={finalCommunityId}
						channelId={selectedChannel}
					/>
				) : undefined
			}
		/>
	);
}

export default CommunityPage;
