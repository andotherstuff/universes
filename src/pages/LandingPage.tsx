import { LoginArea } from "@/components/auth/LoginArea";
import { MessageCircle, ShoppingCart, FolderOpen } from "lucide-react";

// Landing page for logged-out users
export function LandingPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
			{/* Animated background */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="stars"></div>
				<div className="stars2"></div>
				<div className="stars3"></div>
			</div>

			{/* Hero Section */}
			<div className="relative z-10 min-h-screen">
				<div className="container mx-auto px-4 pt-16 pb-24">
					{/* Welcome to Universes Hero */}
					<div className="text-center max-w-4xl mx-auto mb-16">
						<img
							src="/universes-logo.png"
							alt="Universes Logo"
							className="w-32 h-32 mx-auto mb-8"
							style={{ filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.6))' }}
						/>
						<h1 className="text-5xl md:text-7xl font-bold text-white mb-4 leading-tight">
							Welcome to Universes
						</h1>

						<p className="text-2xl md:text-3xl text-gray-300 mb-12 font-light">
							A space for all your spaces
						</p>

						{/* CTA Section */}
						<div className="flex flex-col items-center gap-6 mb-16">
							<p className="text-xl text-gray-400 text-center leading-relaxed">
								Ready to own your Space? <br />
								<span className="text-purple-300">Join thousands creating their worlds.</span>
							</p>
							<LoginArea className="max-w-xs" />
						</div>
					</div>

					{/* Tools Section Header */}
					<div className="text-center max-w-4xl mx-auto mb-16">
						<h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
							Each Space has three powerful tools:
						</h2>
					</div>

					{/* Feature Sections */}
					<div className="max-w-7xl mx-auto space-y-32">

						{/* Community Feature */}
						<div className="grid lg:grid-cols-2 gap-12 items-center">
							<div className="order-2 lg:order-1">
								<div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
									<div className="flex items-center space-x-4 mb-6">
										<div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
											<MessageCircle className="w-6 h-6 text-blue-400" />
										</div>
										<div>
											<h3 className="text-2xl font-bold text-white">Community</h3>
											<p className="text-gray-400">Connect & Create Together</p>
										</div>
									</div>
									<div className="space-y-4">
										<div className="bg-slate-700/50 rounded-lg p-4">
											<div className="flex items-center space-x-3">
												<div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
													<div className="w-2 h-2 bg-white rounded-full"></div>
												</div>
												<span className="text-white font-medium"># general</span>
											</div>
											<p className="text-gray-300 mt-2 text-sm">Welcome to our Space! Introduce yourself here.</p>
										</div>
										<div className="bg-slate-700/50 rounded-lg p-4">
											<div className="flex items-center space-x-3">
												<div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
													<div className="w-2 h-2 bg-white rounded-full"></div>
												</div>
												<span className="text-white font-medium">🎙️ Voice Hangout</span>
											</div>
											<p className="text-gray-300 mt-2 text-sm">3 members in voice chat</p>
										</div>
									</div>
								</div>
							</div>
							<div className="order-1 lg:order-2 text-center lg:text-left">
								<h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
									💬 Community
								</h2>
								<p className="text-xl text-gray-300 leading-relaxed">
									Connect with your people through text chats, voice channels, and live events. Build meaningful relationships, share ideas, and create the conversations that matter most to your community.
								</p>
							</div>
						</div>

						{/* Marketplace Feature */}
						<div className="grid lg:grid-cols-2 gap-12 items-center">
							<div className="text-center lg:text-left">
								<h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
									🛒 Marketplace
								</h2>
								<p className="text-xl text-gray-300 leading-relaxed">
									Turn your passion into profit with integrated commerce tools. Sell digital art, physical products, services, or exclusive content directly to your community members in a trusted, seamless environment.
								</p>
							</div>
							<div>
								<div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
									<div className="flex items-center space-x-4 mb-6">
										<div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
											<ShoppingCart className="w-6 h-6 text-green-400" />
										</div>
										<div>
											<h3 className="text-2xl font-bold text-white">Marketplace</h3>
											<p className="text-gray-400">Buy & Sell Anything</p>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div className="bg-slate-700/50 rounded-lg p-4">
											<div className="w-full h-24 bg-gradient-to-r from-orange-400 to-red-400 rounded-lg mb-3 flex items-center justify-center text-3xl">
												🎸
											</div>
											<h4 className="text-white font-medium text-sm">Vintage Guitar</h4>
											<p className="text-green-400 font-bold">250,000 sats</p>
										</div>
										<div className="bg-slate-700/50 rounded-lg p-4">
											<div className="w-full h-24 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg mb-3 flex items-center justify-center text-3xl">
												📚
											</div>
											<h4 className="text-white font-medium text-sm">Recipe Book</h4>
											<p className="text-green-400 font-bold">15,000 sats</p>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Resources Feature */}
						<div className="grid lg:grid-cols-2 gap-12 items-center">
							<div className="order-2 lg:order-1">
								<div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
									<div className="flex items-center space-x-4 mb-6">
										<div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
											<FolderOpen className="w-6 h-6 text-yellow-400" />
										</div>
										<div>
											<h3 className="text-2xl font-bold text-white">Resources</h3>
											<p className="text-gray-400">Shared Knowledge Base</p>
										</div>
									</div>
									<div className="space-y-3">
										<div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg">
											<div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center">
												<span className="text-blue-400 text-xs">📄</span>
											</div>
											<div className="flex-1">
												<p className="text-white font-medium text-sm">Community Guidelines.pdf</p>
												<p className="text-gray-400 text-xs">Updated 2 days ago</p>
											</div>
										</div>
										<div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg">
											<div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
												<span className="text-purple-400 text-xs">🎥</span>
											</div>
											<div className="flex-1">
												<p className="text-white font-medium text-sm">Welcome Video</p>
												<p className="text-gray-400 text-xs">3.2k views</p>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div className="order-1 lg:order-2 text-center lg:text-left">
								<h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
									📂 Resources
								</h2>
								<p className="text-xl text-gray-300 leading-relaxed">
									A shared library for your community. Easily upload, organize, and access files, documents, and media in one place, so everyone stays connected and informed.
								</p>
							</div>
						</div>
					</div>

					{/* Final CTA */}
					<div className="text-center max-w-4xl mx-auto mt-32 pt-16">
						<h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
							Ready to start your journey?
						</h2>
						<p className="text-xl text-gray-300 mb-12">
							No gatekeepers. No random shutdowns. <br />
							Just your people, your rules, your Space.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
							<LoginArea className="w-full max-w-xs" />
						</div>

						{/* Footer */}
						<div className="mt-16 pt-8 border-t border-slate-700/50">
							<div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 text-sm text-gray-400">
								<span className="flex items-center space-x-1">
									<span>🌌</span>
									<span>Powered by </span>
									<a
										href="https://nostr.org"
										target="_blank"
										rel="noopener noreferrer"
										className="hover:text-white transition-colors"
									>
										Nostr
									</a>
								</span>
								<a
									href="https://gitlab.com/soapbox-pub/universes"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition-colors"
								>
									Open Source
								</a>
								<a
									href="https://soapbox.pub/mkstack"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-white transition-colors"
								>
									Vibed with MKStack
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default LandingPage;
