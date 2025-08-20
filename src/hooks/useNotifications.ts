import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useLocalStorage } from './useLocalStorage';
import { PROTOCOL_CONSTANTS } from './useDirectMessages';
// import { logger } from '@/lib/logger';

// Notifications in this app
// - Include: kind 1111 mentions/replies, kind 7 reactions to your 1111 events, DMs to you (kind 4; kind 1059 if NIP‑17 enabled)
// - Exclude: generic kind 1 notes/replies/reactions, zaps (9734), and non‑app activity

export interface Notification {
  id: string;
  type: 'mention' | 'reply' | 'reaction' | 'dm' | 'friend_request';
  title: string;
  message: string;
  eventId?: string;
  fromPubkey?: string;
  timestamp: number;
  read: boolean;
  communityId?: string;
  channelId?: string;
}

/**
 * Hook to get notifications for the current user
 * This is a simplified implementation that tracks mentions and replies
 */
export function useNotifications() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  // Respect user setting from MessagingSettings (see UserSettingsDialog -> MessagingSettings)
  const [isNIP17Enabled] = useLocalStorage(PROTOCOL_CONSTANTS.NIP17_ENABLED_KEY, true);

  return useQuery({
    queryKey: ['notifications', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      /*
       * Notifications collected (app‑scoped):
       * - Mentions/replies in app content: kind 1111 that tag you or reply to your 1111 events
       * - Reactions to your app content: kind 7 where #e targets your 1111 events
       * - Direct messages addressed to you: NIP‑04 (kind 4) and, if enabled, NIP‑17 gift wraps (kind 1059)
       *
       * Excluded:
       * - Generic kind:1 notes/replies/reactions
       * - Zaps (9734) and other non‑app activity
       */
      const APP_CONTENT_KINDS = [1111];
      const REACTION_KIND = 7;
      // NIP-17 uses 1059 gift wraps on relays; actual kind 14 is derived client-side

      const since = Math.floor(Date.now() / 1000) - (14 * 24 * 60 * 60); // last 14 days

      // Fetch in parallel:
      const [
        mentionsInAppContent,
        userAppContent,
        dmIncoming,
        memberApprovals,
        memberDeclines,
        memberBans,
        ownedCommunities,
        pTaggedCommunities,
      ] = await Promise.all([
        // Mentions that tag the user in app content only
        nostr.query([
          { kinds: APP_CONTENT_KINDS, '#p': [user.pubkey], limit: 100, since },
        ], { signal }),

        // Your app content (for reactions/replies)
        nostr.query([
          { kinds: APP_CONTENT_KINDS, authors: [user.pubkey], limit: 100, since },
        ], { signal }),

        // Incoming DMs (respect NIP-17 setting). For NIP-17 we look for gift wraps (1059).
        nostr.query([
          { kinds: [4], '#p': [user.pubkey], limit: 100, since },
          ...(isNIP17Enabled ? [{ kinds: [1059] as number[], '#p': [user.pubkey], limit: 100, since }] : []),
        ], { signal }),

        // Membership list updates targeting the user (approved/declined/banned)
        nostr.query([{ kinds: [34551], '#p': [user.pubkey], limit: 100, since }], { signal }),
        nostr.query([{ kinds: [34552], '#p': [user.pubkey], limit: 100, since }], { signal }),
        nostr.query([{ kinds: [34553], '#p': [user.pubkey], limit: 100, since }], { signal }),

        // Moderator scoping: communities you own or moderate
        nostr.query([{ kinds: [34550], authors: [user.pubkey], limit: 200 }], { signal }),
        nostr.query([{ kinds: [34550], '#p': [user.pubkey], limit: 500 }], { signal }),
      ]);

      const userEventIds = userAppContent.map(e => e.id);

      // Get reactions to user's events if any exist
      const reactionEvents = userEventIds.length > 0 ? await nostr.query([
        { kinds: [REACTION_KIND], '#e': userEventIds, limit: 100 },
      ], { signal }) : [];

      // Replies to your app content
      const replyEvents = userEventIds.length > 0 ? await nostr.query([
        { kinds: APP_CONTENT_KINDS, '#e': userEventIds, limit: 100 },
      ], { signal }) : [];

      // Convert to notifications
      // Read the latest read list directly from localStorage so invalidations pick up changes immediately
      let readNotifications: string[] = [];
      try {
        readNotifications = JSON.parse(localStorage.getItem('read-notifications') || '[]');
      } catch {
        readNotifications = [];
      }

      const notifications: Notification[] = [];

      // Mentions in app content
      mentionsInAppContent.forEach(event => {
        // Skip if it's from the user themselves
        if (event.pubkey === user.pubkey) return;

        const isMention = event.tags.some(([name, value]) => name === 'p' && value === user.pubkey);
        const isReply = event.tags.some(([name, value]) => name === 'e' && userEventIds.includes(value));

        if (isMention || isReply) {
          notifications.push({
            id: `${event.id}-mention`,
            type: isReply ? 'reply' : 'mention',
            title: isReply ? 'New Reply' : 'You were mentioned',
            message: (event.content || '').slice(0, 140) + ((event.content || '').length > 140 ? '...' : ''),
            eventId: event.id,
            fromPubkey: event.pubkey,
            timestamp: event.created_at * 1000,
            read: readNotifications.includes(`${event.id}-mention`),
          });
        }
      });

      // Reactions to your app content
      reactionEvents.forEach(event => {
        // Skip if it's from the user themselves
        if (event.pubkey === user.pubkey) return;

        const reactionContent = event.content || '👍';
        notifications.push({
          id: `${event.id}-reaction`,
          type: 'reaction',
          title: 'New Reaction',
          message: `Reacted with ${reactionContent}`,
          eventId: event.id,
          fromPubkey: event.pubkey,
          timestamp: event.created_at * 1000,
          read: readNotifications.includes(`${event.id}-reaction`),
        });
      });

      // Replies to your app content (notifies only when others reply)
      replyEvents.forEach(event => {
        if (event.pubkey === user.pubkey) return;
        notifications.push({
          id: `${event.id}-reply`,
          type: 'reply',
          title: 'New Reply',
          message: (event.content || '').slice(0, 140) + ((event.content || '').length > 140 ? '...' : ''),
          eventId: event.id,
          fromPubkey: event.pubkey,
          timestamp: event.created_at * 1000,
          read: readNotifications.includes(`${event.id}-reply`),
        });
      });

      // Direct messages (NIP‑04 and optionally NIP‑17 gift wraps) to the user
      dmIncoming
        .filter(e => e.pubkey !== user.pubkey)
        .forEach(event => {
          const isNip04 = event.kind === 4;
          const isGiftWrap = event.kind === 1059; // NIP‑17 gift wrap (actual payload is unwrapped elsewhere)
          if (!isNip04 && !isGiftWrap) return;

          notifications.push({
            id: `${event.id}-dm`,
            type: 'dm',
            title: isNip04 ? 'New Direct Message' : 'Encrypted event',
            message: isNip04 ? '[Encrypted message]' : '[Requires decryption]',
            eventId: event.id,
            fromPubkey: event.pubkey,
            timestamp: event.created_at * 1000,
            read: readNotifications.includes(`${event.id}-dm`),
          });
        });

      // Sort by timestamp (newest first)
      // Membership list updates → notifications
      const pushMembershipNotification = (
        event: { id: string; pubkey: string; created_at: number; tags: string[][] },
        type: 'member_approved' | 'member_declined' | 'member_banned',
        title: string
      ) => {
        notifications.push({
          id: `${event.id}-${type}`,
          type: 'friend_request', // reuse existing union without expanding types; semantic: membership change
          title,
          message: '',
          eventId: event.id,
          fromPubkey: event.pubkey,
          timestamp: event.created_at * 1000,
          read: readNotifications.includes(`${event.id}-${type}`),
          communityId: event.tags.find(([n]) => n === 'a')?.[1] || undefined,
        });
      };

      memberApprovals.forEach(e => pushMembershipNotification(e, 'member_approved', 'Membership approved'));
      memberDeclines.forEach(e => pushMembershipNotification(e, 'member_declined', 'Membership declined'));
      memberBans.forEach(e => pushMembershipNotification(e, 'member_banned', 'Removed from community'));

      // Moderator-facing: Join requests (4552) for communities you own or moderate
      const getCommunityId = (evt: { pubkey: string; tags: string[][] }) => {
        const d = evt.tags.find(([n]) => n === 'd')?.[1];
        return d ? `34550:${evt.pubkey}:${d}` : undefined;
      };

      // Determine moderated/owned community IDs
      const ownedIds = (ownedCommunities || []).map(getCommunityId).filter(Boolean) as string[];
      const moderatedIds = (pTaggedCommunities || [])
        .filter(evt => evt.tags.some(t => t[0] === 'p' && t[1] === user.pubkey && t[3] === 'moderator'))
        .map(getCommunityId)
        .filter(Boolean) as string[];
      const allModeratedIds = Array.from(new Set([...ownedIds, ...moderatedIds]));

      if (allModeratedIds.length > 0) {
        // Batch '#a' filters to avoid very large arrays
        const CHUNK = 20;
        const joinFilters = [] as { kinds: number[]; '#a': string[]; limit: number; since: number }[];
        for (let i = 0; i < allModeratedIds.length; i += CHUNK) {
          joinFilters.push({ kinds: [4552], '#a': allModeratedIds.slice(i, i + CHUNK), limit: 50, since });
        }
        const joinRequests = joinFilters.length > 0 ? await nostr.query(joinFilters, { signal }) : [];

        joinRequests
          .filter(e => e.pubkey !== user.pubkey)
          .forEach(e => {
            notifications.push({
              id: `${e.id}-join_request`,
              type: 'friend_request',
              title: 'New join request',
              message: '',
              eventId: e.id,
              fromPubkey: e.pubkey,
              timestamp: e.created_at * 1000,
              read: readNotifications.includes(`${e.id}-join_request`),
              communityId: e.tags.find(([n]) => n === 'a')?.[1] || undefined,
            });
          });
      }

      return notifications.sort((a, b) => b.timestamp - a.timestamp);
    },
    enabled: !!user?.pubkey,
    staleTime: 60 * 1000, // 1 minute - Notifications don't need to be ultra real-time
    refetchInterval: 2 * 60 * 1000, // 2 minutes - Reduced frequency for better performance
  });
}

/**
 * Hook to mark notifications as read
 */
export function useMarkNotificationsRead() {
  const [readNotifications, setReadNotifications] = useLocalStorage<string[]>('read-notifications', []);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const newReadNotifications = [...new Set([...readNotifications, ...notificationIds])];
      setReadNotifications(newReadNotifications);
      return newReadNotifications;
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'], exact: false });

      const previousQueries = queryClient.getQueriesData({ queryKey: ['notifications'] }) as Array<[
        readonly unknown[],
        Notification[] | undefined
      ]>;

      previousQueries.forEach(([key, data]: [readonly unknown[], Notification[] | undefined]) => {
        if (!data) return;
        const updated = data.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
        queryClient.setQueryData(key, updated);
      });

      return { previousQueries };
    },
    onError: (_err, _ids, ctx) => {
      const previousQueries = ctx?.previousQueries as Array<[
        readonly unknown[],
        Notification[] | undefined
      ]> | undefined;
      previousQueries?.forEach(([key, data]) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      // Invalidate all notifications queries (with any additional key parts like pubkey)
      queryClient.invalidateQueries({ queryKey: ['notifications'], exact: false });
    },
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadNotificationCount() {
  const { data: notifications = [] } = useNotifications();
  return notifications.filter(n => !n.read).length;
}

/**
 * Hook to request browser notification permissions and show notifications
 */
export function useBrowserNotifications() {
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });
    }
    return null;
  };

  return {
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}