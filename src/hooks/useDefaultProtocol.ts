import { useMemo } from 'react';
import { useDataManager } from '@/components/DataManagerProvider';
import { useUserSettings } from '@/hooks/useUserSettings';
import { MESSAGE_PROTOCOL } from '@/lib/dmConstants';
import { useDefaultProtocolSetting } from './useDefaultProtocolSetting';

/**
 * Hook to determine the default protocol for a conversation based on user settings
 * and conversation history.
 */
export function useDefaultProtocol(conversationId?: string) {
  const [defaultProtocolSetting] = useDefaultProtocolSetting();
  const { settings } = useUserSettings();
  const { messaging } = useDataManager();
  const { conversations } = messaging;
  const isNIP17Enabled = settings.enableNIP17;

  return useMemo(() => {
    // If NIP-17 is disabled or user explicitly prefers NIP-04, use NIP-04
    if (!isNIP17Enabled || defaultProtocolSetting === 'nip04') {
      return MESSAGE_PROTOCOL.NIP04;
    }

    // If user explicitly prefers NIP-17, use it
    if (defaultProtocolSetting === 'nip17') {
      return MESSAGE_PROTOCOL.NIP17;
    }

    // Auto mode: determine protocol based on conversation history
    if (defaultProtocolSetting === 'auto' && conversationId) {
      const conversation = conversations?.find(c => c.id === conversationId);

      // Prioritize NIP-17 if conversation has NIP-17 messages
      if (conversation?.hasNIP17Messages) {
        return MESSAGE_PROTOCOL.NIP17;
      }

      // Fall back to NIP-04 if conversation has NIP-4 messages
      if (conversation?.hasNIP4Messages) {
        return MESSAGE_PROTOCOL.NIP04;
      }
    }

    // Default to NIP-17 for new conversations or when NIP-17 is enabled
    return MESSAGE_PROTOCOL.NIP17;
  }, [defaultProtocolSetting, isNIP17Enabled, conversationId, conversations]);
}
