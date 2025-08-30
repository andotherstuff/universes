import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface UrlParameters {
  tab: string | null;
  highlight: string | null;
  channelId: string | null;
}

/**
 * Hook to handle URL parameters like tab and highlight, plus channel ID from path
 */
export function useUrlParameters() {
  const location = useLocation();
  const [parameters, setParameters] = useState<UrlParameters>({
    tab: null,
    highlight: null,
    channelId: null,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);

    // Extract channel name from URL path (format: /space/naddr1.../channel-name)
    const pathSegments = location.pathname.split('/');
    const channelName = pathSegments.length >= 4 ? pathSegments[3] : null;

    setParameters({
      tab: searchParams.get('tab'),
      highlight: searchParams.get('highlight'),
      channelId: channelName,
    });
  }, [location.pathname, location.search]);

  return parameters;
}