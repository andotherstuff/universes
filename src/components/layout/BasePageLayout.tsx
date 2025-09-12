import { ReactNode, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { UserPanel } from "./UserPanel";

interface BasePageLayoutProps {
	mainContent: ReactNode;
	leftPanel?: ReactNode;
	rightPanel?: ReactNode;
	showUserPanel?: boolean;
}

// Base layout template that all pages can use - includes persistent sidebar
export function BasePageLayout({
	mainContent,
	leftPanel,
	rightPanel,
	showUserPanel = true
}: BasePageLayoutProps) {
	const location = useLocation();
	const navigate = useNavigate();
	const [showCommunitySelectionDialog, setShowCommunitySelectionDialog] = useState(false);
	const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);

	// Sync selectedCommunity with current route
	useEffect(() => {
		const path = location.pathname;
		if (path.startsWith('/space/') && path !== '/space') {
			// Extract community ID from URL
			const segments = path.split('/');
			const communityId = segments[2]; // /space/[communityId]/...
			if (communityId && communityId !== selectedCommunity) {
				setSelectedCommunity(decodeURIComponent(communityId));
			}
		} else if (path.startsWith('/dm') || path === '/space') {
			// DM routes or community list - no community selected
			setSelectedCommunity(null);
		}
	}, [location.pathname, selectedCommunity]);

	const handleCommunitySelect = (communityId: string | null) => {
		// Navigate to the appropriate route (selectedCommunity will be synced by useEffect)
		if (communityId) {
			navigate(`/space/${encodeURIComponent(communityId)}`);
		} else {
			// When no community is selected, go back to community list
			navigate('/space');
		}
	};

	return (
		<div className="flex h-screen bg-background text-foreground">
			{/* Persistent AppSidebar - never unmounts */}
			<div className="w-16 bg-background/50 flex flex-col h-full">
				<AppSidebar
					selectedCommunity={selectedCommunity}
					showCommunitySelectionDialog={showCommunitySelectionDialog}
					onShowCommunitySelectionDialogChange={setShowCommunitySelectionDialog}
					onSelectCommunity={handleCommunitySelect}
				/>
			</div>

			{/* Main content area with three-panel layout */}
			<div className="flex-1 flex h-full overflow-hidden">
				{/* Left Panel */}
				{leftPanel && (
					<div className="w-72 bg-secondary/30 flex flex-col h-full">
						{leftPanel}
						{showUserPanel && <UserPanel />}
					</div>
				)}

				{/* Main Content Area */}
				<div className="flex-1 flex flex-col min-h-0">
					{mainContent}
				</div>

				{/* Right Panel */}
				{rightPanel && (
					<div className="w-72 bg-secondary/30">
						{rightPanel}
					</div>
				)}
			</div>
		</div>
	);
}

export default BasePageLayout;
