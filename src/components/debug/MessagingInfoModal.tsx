import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useDataManager } from "@/components/DataManagerProvider";
import { format } from "date-fns";

interface MessagingInfoModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function MessagingInfoModal({ open, onOpenChange }: MessagingInfoModalProps) {
	const { messaging } = useDataManager();
	const debugInfo = messaging.getDebugInfo();
	const { subscriptions } = messaging;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<MessageSquare className="w-5 h-5" />
						Messages Summary
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Total Messages */}
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Total Messages:</span>
						<span className="text-sm font-bold text-blue-600">
							{debugInfo.messageCount}
						</span>
					</div>

					{/* NIP-4 Section */}
					<div className="border-t pt-3">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium text-orange-600">NIP-4 Messages:</span>
							<span className="text-sm font-bold text-orange-600">
								{debugInfo.nip4Count}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs mb-1">
							<span className="text-muted-foreground">Last Sync:</span>
							<span className="text-muted-foreground">
								{debugInfo.nip4Sync ? format(debugInfo.nip4Sync, 'h:mm a do MMMM yyyy') : 'Never'}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Subscribed:</span>
							<span className={`text-xs px-1.5 py-0.5 rounded ${subscriptions.nip4 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
								{subscriptions.nip4 ? 'Yes' : 'No'}
							</span>
						</div>
					</div>

					{/* NIP-17 Section */}
					<div className="border-t pt-3">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium text-purple-600">NIP-17 Messages:</span>
							<span className="text-sm font-bold text-purple-600">
								{debugInfo.nip17Count}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs mb-1">
							<span className="text-muted-foreground">Last Sync:</span>
							<span className="text-muted-foreground">
								{debugInfo.nip17Sync ? format(debugInfo.nip17Sync, 'h:mm a do MMMM yyyy') : 'Never'}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs mb-1">
							<span className="text-muted-foreground">Enabled:</span>
							<span className={`text-xs px-1.5 py-0.5 rounded ${debugInfo.nip17Enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
								{debugInfo.nip17Enabled ? 'Yes' : 'No'}
							</span>
						</div>
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Subscribed:</span>
							<span className={`text-xs px-1.5 py-0.5 rounded ${subscriptions.nip17 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
								{subscriptions.nip17 ? 'Yes' : 'No'}
							</span>
						</div>
					</div>

					{/* Refresh Messages Button */}
					<div className="border-t pt-3">
						<Button
							onClick={messaging.resetMessageDataAndCache}
							className="w-full"
							variant="outline"
							size="sm"
						>
							<RefreshCw className="w-4 h-4 mr-2" />
							Refresh All Messages
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
