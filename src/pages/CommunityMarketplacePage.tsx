import { useParams } from "react-router-dom";
import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { CommunityPanel } from "@/components/layout/CommunityPanel";
import { MarketplaceSpace } from "@/components/spaces/MarketplaceSpace";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { decodeNaddrFromUrl } from "@/lib/utils";

// Page component for Community Marketplace
export function CommunityMarketplacePage() {
	const { communityId } = useParams<{ communityId: string }>();
	const { user } = useCurrentUser();

	// Fail fast - login required
	if (!user) {
		return (
			<BasePageLayout
				mainContent={
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to access the marketplace.
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

	// Decode naddr format if needed
	let decodedCommunityId = communityId;
	if (communityId.startsWith('naddr1')) {
		try {
			decodedCommunityId = decodeNaddrFromUrl(communityId);
		} catch {
			console.error('Failed to decode naddr');
			decodedCommunityId = communityId;
		}
	}

	return (
		<BasePageLayout
			leftPanel={
				<CommunityPanel
					communityId={decodedCommunityId}
					selectedChannel={null}
					selectedSpace="marketplace"
				/>
			}
			mainContent={
				<MarketplaceSpace
					communityId={decodedCommunityId}
				/>
			}
		/>
	);
}

export default CommunityMarketplacePage;
