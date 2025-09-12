import { useMemo } from 'react';
import { useDataManager } from '@/components/DataManagerProvider';
import { MESSAGE_PROTOCOL } from '@/lib/dmConstants';

/**
 * Hook to automatically determine the best protocol for a conversation.
 * Uses NIP-17 by default, falls back to NIP-04 when needed.
 * Only re-runs when the specific conversation's protocol flags change.
 */
export function useAutoProtocol(conversationId?: string) {
  const { messaging } = useDataManager();
  const { messages } = messaging;

  // Extract just the protocol flags for this specific conversation
  const conversationData = conversationId ? messages.get(conversationId) : null;
  const hasNIP4 = conversationData?.hasNIP4 ?? false;
  const hasNIP17 = conversationData?.hasNIP17 ?? false;

  return useMemo(() => {
    // Auto mode: determine protocol based on conversation history
    if (conversationId) {
      // If conversation has NIP-17 messages, continue using NIP-17
      if (hasNIP17) {
        return MESSAGE_PROTOCOL.NIP17;
      }

      // If conversation only has NIP-04 messages, use NIP-04 for compatibility
      if (hasNIP4 && !hasNIP17) {
        return MESSAGE_PROTOCOL.NIP04;
      }
    }

    // Default to NIP-17 for new conversations
    return MESSAGE_PROTOCOL.NIP17;
  }, [conversationId, hasNIP4, hasNIP17]);
}