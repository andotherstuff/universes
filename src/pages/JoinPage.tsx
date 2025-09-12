import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUrlNavigation } from "@/hooks/useUrlNavigation";
import { CommunityListPage } from "./CommunityListPage";

// Page component for Join flow pages
export function JoinPage() {
	const { user } = useCurrentUser();
	const { communityId, isJoinRequest } = useUrlNavigation();

	// Show message if not logged in
	if (!user) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center max-w-md p-8">
					<h2 className="text-2xl font-bold mb-4">Join Community</h2>
					<p className="text-muted-foreground mb-6">
						Please log in to join this community.
					</p>
				</div>
			</div>
		);
	}

	if (!isJoinRequest || !communityId) {
		return <div>Invalid join link.</div>;
	}

	// For now, use the community list layout (already has AppWithSidebar)
	// The join dialog will be handled by the existing useUrlNavigation logic
	return <CommunityListPage />;
}

export default JoinPage;
