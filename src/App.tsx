// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createHead, UnheadProvider } from '@unhead/react/client';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NostrLoginProvider } from '@nostrify/react/login';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { VoiceProvider } from '@/contexts/VoiceContext.tsx';
import { MessageSystemProvider } from '@/contexts/MessageSystemContext';
import { NWCProvider } from '@/contexts/NWCContext';
import { MarketplaceProvider } from '@/contexts/MarketplaceContext.tsx';
import { QueryOptimizer } from '@/components/QueryOptimizer';
import { useFaviconBadge } from '@/hooks/useFaviconBadge';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { SettingsProvider } from '@/contexts/settings.tsx';
import { SettingsDialog } from '@/components/user/SettingsDialog';
import { DataManagerProvider } from '@/components/DataManagerProvider';

import AppRouter from './AppRouter';

const head = createHead({
  plugins: [
    InferSeoMetaPlugin(),
  ],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Allow refetch on mount but rely on staleTime
      refetchOnReconnect: 'always',
      staleTime: 10 * 60 * 1000, // 10 minutes - More aggressive caching (increased from 5)
      gcTime: 60 * 60 * 1000, // 1 hour - Keep data longer in memory (increased from 30)
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false; // Fail faster on first retry
        if (error instanceof Error && error.message.includes('timeout')) return false;
        if (error instanceof Error && error.message.includes('AbortError')) return false;
        return true;
      },
      retryDelay: (attemptIndex) => Math.min(300 * 2 ** attemptIndex, 3000), // Faster retry delays
      refetchInterval: false,
      // This is key for cache hits - keep previous data while fetching
      placeholderData: (previousData) => previousData,
      structuralSharing: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 500, // Faster retry for mutations
    },
  },
});

const defaultConfig: AppConfig = {
  theme: "dark",
  relayUrl: "wss://relay.chorus.community",
  showPerformanceDashboard: true, // Enable by default to show performance improvements
};

const presetRelays = [
  { url: 'wss://relay.chorus.community', name: 'Chorus' },
  //{ url: 'wss://ditto.pub/relay', name: 'Ditto' },
  //{ url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  //{ url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
];

function AppContent() {
  const unreadCount = useUnreadNotificationCount();
  useFaviconBadge(unreadCount);

  return (
    <SettingsProvider>
      <MessageSystemProvider>
        <TooltipProvider>
          <QueryOptimizer />
          <Toaster />
          <Sonner />
          <Suspense>
            <AppRouter />
          </Suspense>
          <SettingsDialog />
        </TooltipProvider>
      </MessageSystemProvider>
    </SettingsProvider>
  );
}

export function App() {
  return (
    <UnheadProvider head={head}>
      <AppProvider storageKey="nostr:app-config" defaultConfig={defaultConfig} presetRelays={presetRelays}>
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <NWCProvider>
                <VoiceProvider>
                  <MarketplaceProvider>
                    <DataManagerProvider>
                      <AppContent />
                    </DataManagerProvider>
                  </MarketplaceProvider>
                </VoiceProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </AppProvider>
    </UnheadProvider>
  );
}

export default App;
