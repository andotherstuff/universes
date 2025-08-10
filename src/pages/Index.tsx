import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { DiscordLayout } from "@/components/layout/DiscordLayout";
import { Badge } from "@/components/ui/badge";
import { Users, MessageCircle, Globe } from "lucide-react";
import { useEffect } from "react";
import { nip19 } from "nostr-tools";
import { communityIdToNaddr, naddrToCommunityId } from "@/lib/utils";

interface IndexProps {
  dmTargetPubkey?: string;
  spaceCommunityId?: string;
}

const Index = ({ dmTargetPubkey, spaceCommunityId }: IndexProps) => {
  const { user } = useCurrentUser();


  // If dmTargetPubkey is provided, ensure user is logged in and handle URL updates
  useEffect(() => {
    if (dmTargetPubkey && user) {
      // Update URL to remove the npub parameter after handling
      // This prevents the parameter from persisting in the URL unnecessarily
      const url = new URL(window.location.href);
      url.pathname = '/dm';
      window.history.replaceState({}, '', url.toString());
    }
  }, [dmTargetPubkey, user]);

  // If spaceCommunityId is provided, ensure user is logged in and handle URL updates
  useEffect(() => {
    if (spaceCommunityId && user) {
      // Check if the communityId is already in naddr format
      if (spaceCommunityId.startsWith('naddr1')) {
        // Already in naddr format, check if URL needs to be updated
        const currentPath = window.location.pathname;
        const expectedPath = `/space/${spaceCommunityId}`;

        // Only update URL if it's not already correct (prevents unnecessary redirects)
        if (currentPath !== expectedPath) {
          const url = new URL(window.location.href);
          url.pathname = expectedPath;
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // Convert community ID to naddr format for the URL
        try {
          const naddr = communityIdToNaddr(spaceCommunityId);
          const url = new URL(window.location.href);
          url.pathname = `/space/${naddr}`;
          window.history.replaceState({}, '', url.toString());
        } catch {
          console.error('Failed to encode community ID as naddr');
          // Fallback to original format
          const url = new URL(window.location.href);
          url.pathname = `/space/${spaceCommunityId}`;
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
  }, [spaceCommunityId, user]);

  if (!user) {
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
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="flex items-center justify-center space-x-2 mb-8">
                <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-sm px-4 py-2">
                  🌌 Powered by Nostr
                </Badge>
              </div>

              {/* Main Heading */}
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
                IMAGINE A PLACE...
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
                ...where you can belong to a Space, a community, or a galaxy full of friends—where it's easy to talk every day and hang out more often. Where your world is truly yours.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                <LoginArea className="w-full max-w-xs" />
                <p className="text-sm text-gray-400">
                  New to decentralized communities? <br />
                  <span className="text-purple-300">Join millions exploring the galaxy.</span>
                </p>
              </div>
            </div>

            {/* Feature Sections */}
            <div className="max-w-7xl mx-auto space-y-32 mt-32">
              
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
                    Create an invite-only place where you belong
                  </h2>
                  <p className="text-xl text-gray-300 leading-relaxed">
                    Universes Spaces are organized into topic-based channels where you can collaborate, share, and just talk about your day without clogging up a group chat.
                  </p>
                </div>
              </div>

              {/* Marketplace Feature */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="text-center lg:text-left">
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Where hanging out is easy
                  </h2>
                  <p className="text-xl text-gray-300 leading-relaxed">
                    Grab a seat in a voice channel when you're free. Friends in your Space can see you're around and instantly pop in to talk without having to call.
                  </p>
                </div>
                <div>
                  <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Marketplace</h3>
                        <p className="text-gray-400">Buy & Sell with Bitcoin</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-700/50 rounded-lg p-4">
                        <div className="w-full h-24 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg mb-3"></div>
                        <h4 className="text-white font-medium text-sm">Digital Art NFT</h4>
                        <p className="text-green-400 font-bold">₿0.001</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-4">
                        <div className="w-full h-24 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg mb-3"></div>
                        <h4 className="text-white font-medium text-sm">Course Access</h4>
                        <p className="text-green-400 font-bold">₿0.005</p>
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
                        <Globe className="w-6 h-6 text-yellow-400" />
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
                    From few to a fandom
                  </h2>
                  <p className="text-xl text-gray-300 leading-relaxed">
                    Get any community running with moderation tools and custom member access. Give members special powers, set up private channels, and more.
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

  // Decode spaceCommunityId if it's in naddr format
  let decodedSpaceCommunityId: string | null = null;
  if (spaceCommunityId) {
    if (spaceCommunityId.startsWith('naddr1')) {
      try {
        decodedSpaceCommunityId = naddrToCommunityId(spaceCommunityId);
      } catch {
        console.error('Failed to decode naddr');
        decodedSpaceCommunityId = null;
      }
    } else {
      decodedSpaceCommunityId = spaceCommunityId;
    }
  }

  // Check if we're in DM mode
  if (dmTargetPubkey !== undefined) {
    // We're in DM mode - either /dm or /dm/:npub was accessed
    let targetHexPubkey: string | null = null;

    if (dmTargetPubkey) {
      try {
        // Try to decode the npub to get the hex pubkey
        const decoded = nip19.decode(dmTargetPubkey);
        if (decoded.type === 'npub') {
          targetHexPubkey = decoded.data;
        }
      } catch (error) {
        console.error('Invalid npub format:', error);
        // Fallback: treat as hex pubkey if it's 64 hex characters
        if (dmTargetPubkey.match(/^[a-f0-9]{64}$/i)) {
          targetHexPubkey = dmTargetPubkey;
        }
      }
    }

    return <DiscordLayout initialDMTargetPubkey={targetHexPubkey} initialSpaceCommunityId={decodedSpaceCommunityId} />;
  }

  return <DiscordLayout initialSpaceCommunityId={decodedSpaceCommunityId} />;
};

export default Index;
