import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { useCurrentUser } from "./hooks/useCurrentUser";

import { useParams } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { DMLayout } from "./components/layout/DMLayout";
import { CommunityPage } from "./pages/CommunityPage";
import { CommunityListPage } from "./pages/CommunityListPage";
import { CommunityManagementPage } from "./pages/CommunityManagementPage";
import { CommunityMarketplacePage } from "./pages/CommunityMarketplacePage";
import { CommunityResourcesPage } from "./pages/CommunityResourcesPage";
import { JoinPage } from "./pages/JoinPage";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import { Communities } from "./pages/Communities";
import { EmojiReactionsDemo } from "./pages/EmojiReactionsDemo";
import { VoiceDemo } from "./pages/VoiceDemo";
import { CommunitiesDebug } from "./pages/CommunitiesDebug";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";


// Simple root redirecter - shows landing page or redirects to /space
function RootRedirecter() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Logged in - redirect to space
      navigate('/space', { replace: true });
    }
  }, [user, navigate]);

  // Show landing page for logged-out users
  if (!user) {
    return <LandingPage />;
  }

  // Show brief loading while redirecting
  return null;
}

// Wrapper for DMLayout with URL params
function DMWithParams() {
  const { npub } = useParams<{ npub?: string }>();
  return <DMLayout targetPubkey={npub} />;
}

// Remove old wrapper components - now handled in AppWithSidebar

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRedirecter />} />
        <Route path="/search" element={<Search />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/profile/:npub" element={<Profile />} />
        <Route path="/profile/:npub/edit" element={<EditProfile />} />
        <Route path="/emoji-demo" element={<EmojiReactionsDemo />} />
        <Route path="/voice-demo" element={<VoiceDemo />} />
        <Route path="/communities-debug" element={<CommunitiesDebug />} />

        {/* App routes - each page handles its own layout */}
        <Route path="/dm" element={<DMLayout />} />
        <Route path="/dm/:npub" element={<DMWithParams />} />
        <Route path="/space" element={<CommunityListPage />} />
        <Route path="/space/:communityId" element={<CommunityPage />} />
        <Route path="/space/:communityId/:channelId" element={<CommunityPage />} />
        {/* TODO: Enable when marketplace/resources are ready */}
        {process.env.NODE_ENV === 'never' && (
          <>
            <Route path="/space/:communityId/marketplace" element={<CommunityMarketplacePage />} />
            <Route path="/space/:communityId/resources" element={<CommunityResourcesPage />} />
          </>
        )}
        <Route path="/space/:communityId/manage" element={<CommunityManagementPage />} />
        <Route path="/join/:naddr" element={<JoinPage />} />

        {/* NIP-19 identifier routes - handle at root level */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
