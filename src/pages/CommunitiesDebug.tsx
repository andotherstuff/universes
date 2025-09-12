import React from 'react';
import { useDataManager } from '@/components/DataManagerProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNowShort } from '@/lib/formatTime';

export function CommunitiesDebug() {
	const { communities } = useDataManager();
	const { communities: communitiesData, isLoading, loadingPhase, loadTime, loadBreakdown, getDebugInfo } = communities;

	const debugInfo = getDebugInfo();

	// Debug logging
	console.log('CommunitiesDebug render:', {
		isLoading,
		loadingPhase,
		communitiesDataSize: communitiesData.size,
		debugInfo,
		communitiesData: Array.from(communitiesData.entries())
	});

	// Debug permissions and members data specifically
	Array.from(communitiesData.entries()).forEach(([communityId, community]) => {
		console.log(`Community ${communityId}:`, {
			hasApprovedMembers: !!community.approvedMembers,
			approvedMembersData: community.approvedMembers,
			channels: Array.from(community.channels.entries()).map(([channelId, channel]) => ({
				channelId,
				hasPermissions: !!channel.permissions,
				permissionsData: channel.permissions
			}))
		});
	});


	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="space-y-2">
				<div className="flex items-center gap-3">
					<h1 className="text-3xl font-bold">Communities Debug</h1>
					{isLoading && (
						<Badge variant="secondary" className="animate-pulse">
							Loading...
						</Badge>
					)}
					{!isLoading && (
						<div className="flex flex-col gap-1">
							<Badge variant="outline" className="text-green-600">
								✓ Loading Complete {loadTime && `(${loadTime}ms)`}
							</Badge>
							{loadBreakdown && (
								<div className="text-xs text-muted-foreground space-y-1">
									<div>1. Communities: {loadBreakdown.step1_communities.total}ms</div>
									<div className="ml-4 space-y-0.5">
										<div>├─ Membership Query: {loadBreakdown.step1_communities.membershipQuery}ms</div>
										<div>└─ Definitions Query: {loadBreakdown.step1_communities.definitionsQuery}ms</div>
									</div>
									<div>2. Parallel Batch 1: {loadBreakdown.step2_parallel_batch1.total}ms</div>
									<div className="ml-4 space-y-0.5">
										<div>├─ Channels Query: {loadBreakdown.step2_parallel_batch1.channelsQuery}ms</div>
										<div>└─ Members Query: {loadBreakdown.step2_parallel_batch1.membersQuery}ms</div>
									</div>
									<div>3. Parallel Batch 2: {loadBreakdown.step3_parallel_batch2.total}ms</div>
									<div className="ml-4 space-y-0.5">
										<div>├─ Permissions Query: {loadBreakdown.step3_parallel_batch2.permissionsQuery}ms</div>
										<div>└─ Messages Query: {loadBreakdown.step3_parallel_batch2.messagesQuery}ms</div>
									</div>
									<div>4. Replies Batch: {loadBreakdown.step4_replies_batch.total}ms</div>
									<div className="ml-4 space-y-0.5">
										<div>└─ Replies Query: {loadBreakdown.step4_replies_batch.repliesQuery}ms</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
				<p className="text-muted-foreground">
					Real-time view of loaded community data from DataManager
				</p>
			</div>

			{/* Debug Stats */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Debug Statistics
						<Badge variant="outline">{loadingPhase}</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-4 gap-4 text-center">
						<div>
							<div className="text-2xl font-bold text-blue-600">{debugInfo.communityCount}</div>
							<div className="text-sm text-muted-foreground">Communities</div>
						</div>
						<div>
							<div className="text-2xl font-bold text-green-600">{debugInfo.channelCount}</div>
							<div className="text-sm text-muted-foreground">Channels</div>
						</div>
						<div>
							<div className="text-2xl font-bold text-purple-600">{debugInfo.messageCount}</div>
							<div className="text-sm text-muted-foreground">Messages</div>
						</div>
						<div>
							<div className="text-2xl font-bold text-orange-600">{debugInfo.replyCount}</div>
							<div className="text-sm text-muted-foreground">Replies</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Communities List */}
			{communitiesData.size === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-muted-foreground">No communities loaded yet</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{Array.from(communitiesData.entries()).map(([communityId, community]) => (
						<Card key={communityId}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div>
										<CardTitle className="text-lg flex items-center gap-2">
											{community.info.name}
											{community.isLoadingChannels && (
												<Badge variant="secondary" className="animate-pulse text-xs">
													Loading channels...
												</Badge>
											)}
										</CardTitle>
										<div className="text-sm text-muted-foreground space-y-1">
											<div>ID: {communityId}</div>
											<div>Owner: {community.pubkey}</div>
											<div>Status: {community.membershipStatus}</div>
										</div>
									</div>
									<div className="text-right text-sm text-muted-foreground space-y-1">
										<div>Last Activity: {formatDistanceToNowShort(new Date(community.lastActivity * 1000))}</div>
										<div>
											{community.channels.size} channels
											{community.isLoadingChannels && (
												<span className="text-orange-500 ml-1">(loading...)</span>
											)}
										</div>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<div className="space-y-4">
									{/* Community Info */}
									<div className="space-y-2">
										{community.info.description && (
											<div>
												<h4 className="font-medium mb-2">Description</h4>
												<p className="text-sm text-muted-foreground">
													{community.info.description}
												</p>
											</div>
										)}
										{community.info.image && (
											<div>
												<h4 className="font-medium mb-2">Image</h4>
												<div className="text-sm text-muted-foreground break-all">
													{community.info.image}
												</div>
											</div>
										)}
										{community.info.banner && (
											<div>
												<h4 className="font-medium mb-2">Banner</h4>
												<div className="text-sm text-muted-foreground break-all">
													{community.info.banner}
												</div>
											</div>
										)}
										{community.info.moderators.length > 0 && (
											<div>
												<h4 className="font-medium mb-2">Moderators</h4>
												<ol className="text-xs space-y-1 list-decimal list-inside">
													{community.info.moderators.map((pubkey, i) => (
														<li key={i} className="bg-muted/30 rounded px-2 py-1 break-all">
															{pubkey}
														</li>
													))}
												</ol>
											</div>
										)}
										{community.info.relays.length > 0 && (
											<div>
												<h4 className="font-medium mb-2">Relays</h4>
												<ol className="text-xs space-y-1 list-decimal list-inside">
													{community.info.relays.map((url, i) => (
														<li key={i} className="bg-muted/30 rounded px-2 py-1 break-all">
															{url}
														</li>
													))}
												</ol>
											</div>
										)}
									</div>

									{/* Approved Members */}
									{community.approvedMembers && (
										<div>
											<h4 className="font-medium mb-2">Approved Members ({community.approvedMembers.members.length})</h4>
											<div className="text-xs text-muted-foreground space-y-1">
												<div>Event ID: {community.approvedMembers.event.id.slice(0, 16)}...</div>
												<div>Created: {formatDistanceToNowShort(new Date(community.approvedMembers.event.created_at * 1000))}</div>
												{community.approvedMembers.members.length > 0 && (
													<div>
														<div className="font-medium mt-2 mb-1">Member List:</div>
														<ol className="text-xs space-y-1 list-decimal list-inside">
															{community.approvedMembers.members.map((pubkey, i) => (
																<li key={i} className="bg-muted/30 rounded px-2 py-1 break-all">
																	{pubkey}
																</li>
															))}
														</ol>
													</div>
												)}
											</div>
										</div>
									)}

									<Separator />

									{/* Channels */}
									<div>
										<h4 className="font-medium mb-3 flex items-center gap-2">
											Channels ({community.channels.size})
											{community.isLoadingChannels && (
												<Badge variant="outline" className="text-xs animate-pulse">
													Loading...
												</Badge>
											)}
										</h4>
										{community.isLoadingChannels && community.channels.size === 0 ? (
											<div className="text-center py-8 text-muted-foreground">
												<div className="animate-pulse">Loading channels...</div>
											</div>
										) : (
											<div className="space-y-3">
												{Array.from(community.channels.entries()).map(([channelId, channel]) => (
													<div key={channelId} className="border rounded-lg p-3">
														<div className="flex items-start justify-between mb-2">
															<div>
																<h5 className="font-medium">
																	{channel.info.name}
																</h5>
																<p className="text-xs text-muted-foreground">
																	ID: {channelId}
																</p>
															</div>
															<div className="text-right text-xs text-muted-foreground space-y-1">
																<div>{channel.messages.length} messages</div>
																<div>{channel.replies.size} messages with replies</div>
																<div>{Array.from(channel.replies.values()).reduce((sum, replies) => sum + replies.length, 0)} total replies</div>
																<div>Last Activity: {formatDistanceToNowShort(new Date(channel.lastActivity * 1000))}</div>
															</div>
														</div>

														{/* Channel Description */}
														{channel.info.description && (
															<p className="text-xs text-muted-foreground mb-2">
																{channel.info.description}
															</p>
														)}

														{/* Permissions */}
														{channel.permissions && (
															<div className="mb-2">
																<div className="text-xs font-medium mb-1">Channel Permissions:</div>
																<div className="text-xs text-muted-foreground space-y-1">
																	<div>Event ID: {channel.permissions.id.slice(0, 16)}...</div>
																	<div>Created: {formatDistanceToNowShort(new Date(channel.permissions.created_at * 1000))}</div>
																	{channel.permissions.content && (
																		<div className="bg-muted/30 rounded p-2 mt-1">
																			<pre className="text-xs whitespace-pre-wrap">
																				{channel.permissions.content}
																			</pre>
																		</div>
																	)}
																</div>
															</div>
														)}

														{/* Recent Messages */}
														{channel.messages.length > 0 && (
															<div>
																<h6 className="text-xs font-medium mb-2">Recent Messages:</h6>
																<div className="space-y-2">
																	{channel.messages.slice(-3).map((message) => (
																		<div key={message.id} className="text-xs bg-muted/50 rounded p-2">
																			<div className="space-y-1 mb-2">
																				<div>Author: {message.pubkey}</div>
																				<div>Time: {formatDistanceToNowShort(new Date(message.created_at * 1000))}</div>
																				<div>Kind: {message.kind}</div>
																			</div>
																			<p className="break-words">
																				{message.content}
																			</p>
																		</div>
																	))}
																</div>
															</div>
														)}
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

