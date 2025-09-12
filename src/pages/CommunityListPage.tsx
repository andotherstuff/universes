import { BasePageLayout } from "@/components/layout/BasePageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Page component for Community List page (/space with no community selected)
export function CommunityListPage() {
	const { user } = useCurrentUser();

	return (
		<BasePageLayout
			mainContent={
				user ? (
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Select a Community</h2>
							<p className="text-muted-foreground mb-6">
								Choose a community from the sidebar to start chatting, or click the DM button to send direct messages.
							</p>
							<div className="space-y-2 text-sm text-muted-foreground">
								<p>💬 Communities - Group conversations</p>
								<p>📨 Direct Messages - Private conversations</p>
							</div>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center bg-background h-full">
						<div className="text-center max-w-md p-8">
							<h2 className="text-2xl font-bold mb-4">Login Required</h2>
							<p className="text-muted-foreground">
								Please log in to view communities.
							</p>
						</div>
					</div>
				)
			}
		/>
	);
}

export default CommunityListPage;
