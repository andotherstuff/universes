import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useSendDM } from '@/hooks/useSendDM';
import { useNostr } from '@nostrify/react';
import { validateDMEvent } from '@/lib/dmUtils';
import { logger } from '@/lib/logger';
import { LOADING_PHASES, type LoadingPhase } from '@/lib/constants';
import type { NostrEvent } from '@/types/nostr';
import type { MessageProtocol } from '@/lib/dmConstants';
import { MESSAGE_PROTOCOL } from '@/lib/dmConstants';

// ============================================================================
// DataManager Types and Constants (co-located for better maintainability)
// ============================================================================

// Core participant data structure used throughout DataManager
interface ParticipantData {
  messages: DecryptedMessage[];
  lastActivity: number;
  lastMessage: DecryptedMessage | null;
  hasNIP4: boolean;
  hasNIP17: boolean;
}

// Messages state structure
type MessagesState = Map<string, ParticipantData>;

// Last sync timestamps for each protocol
interface LastSyncData {
  nip4: number | null;
  nip17: number | null;
}

// Subscription status for each protocol
interface SubscriptionStatus {
  nip4: boolean;
  nip17: boolean;
}

// Scan progress tracking
interface ScanProgress {
  current: number;
  status: string;
}

interface ScanProgressState {
  nip4: ScanProgress | null;
  nip17: ScanProgress | null;
}

// Debug information structure
interface DebugInfo {
  messageCount: number;
  nip4Count: number;
  nip17Count: number;
  nip4Sync: Date | null;
  nip17Sync: Date | null;
  nip17Enabled: boolean;
}

// Conversation summary structure
interface ConversationSummary {
  id: string;
  pubkey: string;
  lastMessage: DecryptedMessage | null;
  lastActivity: number;
  hasNIP4Messages: boolean;
  hasNIP17Messages: boolean;
  isKnown: boolean;
  isRequest: boolean;
  lastMessageFromUser: boolean;
}

// Message processing result
interface MessageProcessingResult {
  lastMessageTimestamp?: number;
  messageCount: number;
}

// Decryption result
interface DecryptionResult {
  decryptedContent: string;
  error?: string;
}

// Extended DecryptedMessage type
interface DecryptedMessage extends NostrEvent {
  decryptedContent?: string;
  error?: string;
  isSending?: boolean;
  clientFirstSeen?: number;
}

// NIP-17 processing result
interface NIP17ProcessingResult {
  processedMessage: DecryptedMessage;
  conversationPartner: string;
  error?: string;
}

// Constants for DataManager operations
const DATA_MANAGER_CONSTANTS = {
  // Logging prefixes
  LOG_PREFIX: 'DMS: DataManager:',
  CONVERSATION_LOG_PREFIX: 'DMS: useConversationMessages:',

  // Timing constants (in milliseconds)
  DEBOUNCED_WRITE_DELAY: 15000, // 15 seconds
  RECENT_MESSAGE_THRESHOLD: 5000, // 5 seconds
  SUBSCRIPTION_OVERLAP_SECONDS: 60, // 60 seconds
  NIP17_SETTING_CHANGE_DELAY: 500, // 500ms

  // Scanning limits
  SCAN_TOTAL_LIMIT: 20000,
  SCAN_BATCH_SIZE: 1000,

  // Query timeouts (in milliseconds)
  NIP4_QUERY_TIMEOUT: 15000, // 15 seconds
  NIP17_QUERY_TIMEOUT: 30000, // 30 seconds

  // Error logging debounce
  ERROR_LOG_DEBOUNCE_DELAY: 2000, // 2 seconds
} as const;

// Status messages for scan progress
const SCAN_STATUS_MESSAGES = {
  NIP4_STARTING: 'Starting NIP-4 scan...',
  NIP17_STARTING: 'Starting NIP-17 scan...',
  BATCH_COMPLETE: (batchNumber: number, messageCount: number) =>
    `Batch ${batchNumber} complete: ${messageCount} messages`,
} as const;



// Simple utility for debounced error logging
const createErrorLogger = (name: string) => {
  let count = 0;
  let timeout: NodeJS.Timeout | null = null;

  return (_error: Error) => {
    count++;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      if (count > 0) {
        logger.error(`${DATA_MANAGER_CONSTANTS.LOG_PREFIX} ${name} processing complete with ${count} errors`);
        count = 0;
      }
    }, DATA_MANAGER_CONSTANTS.ERROR_LOG_DEBOUNCE_DELAY);
  };
};

// Create error loggers outside component to prevent recreation
const nip17ErrorLogger = createErrorLogger('NIP-17');

// Messaging domain interface
interface MessagingDomain {
  messages: MessagesState;
  isLoading: boolean;
  loadingPhase: LoadingPhase;
  isDoingInitialLoad: boolean;
  lastSync: LastSyncData;
  subscriptions: SubscriptionStatus;
  conversations: ConversationSummary[];
  getDebugInfo: () => DebugInfo;
  writeAllMessagesToStore: () => Promise<void>;
  resetMessageDataAndCache: () => Promise<void>;
  handleNIP17SettingChange: (enabled: boolean) => Promise<void>;
  sendMessage: (params: { recipientPubkey: string; content: string; protocol?: MessageProtocol }) => Promise<void>;
  isNIP17Enabled: boolean;
  isDebugging: boolean;
  scanProgress: ScanProgressState;
}

// Community data structures
interface CommunityInfo {
  name: string; // from name tag
  description?: string; // from description tag
  image?: string; // from image tag
  banner?: string; // from banner tag
  moderators: string[]; // from p tags with role=moderator
  relays: string[]; // from relay tags
}

interface CommunityData {
  id: string; // community identifier (d tag)
  pubkey: string; // community creator/owner
  info: CommunityInfo; // metadata from community definition
  definitionEvent: NostrEvent; // original kind 34550 community definition
  channels: Map<string, ChannelData>; // channelId -> channel data
  approvedMembers: NostrEvent | null; // kind 34551 approved members list
  pendingMembers: NostrEvent | null; // kind 34552 pending members list
  membershipStatus: 'approved' | 'pending' | 'blocked'; // user's membership status
  lastActivity: number;
}

interface ChannelData {
  id: string; // channel identifier (d tag)
  communityId: string; // parent community id
  definition: NostrEvent; // original kind 32807 channel definition
  messages: NostrEvent[]; // kind 9411 messages (and kind 1 for general)
  permissions: NostrEvent | null; // kind 30143 permissions settings
  lastActivity: number;
}

// Communities state structure
type CommunitiesState = Map<string, CommunityData>; // communityId -> community data

// Communities domain interface
interface CommunitiesDomain {
  communities: CommunitiesState;
  isLoading: boolean;
  loadingPhase: LoadingPhase;
  loadTime: number | null;
  loadBreakdown: {
    communities: number;
    channels: number;
    permissions: number;
    messages: number;
    total: number;
  } | null;
  getDebugInfo: () => {
    communityCount: number;
    channelCount: number;
    messageCount: number;
  };
}

// Main DataManager interface - organized by domain
interface DataManagerContextType {
  messaging: MessagingDomain;
  communities: CommunitiesDomain;
}

const DataManagerContext = createContext<DataManagerContextType | null>(null);

export function useDataManager(): DataManagerContextType {
  const context = useContext(DataManagerContext);
  if (!context) {
    throw new Error('useDataManager must be used within DataManagerProvider');
  }
  return context;
}

// Hook for conversation-specific message subscriptions to avoid unnecessary re-renders
export function useConversationMessages(conversationId: string) {
  const { messaging } = useDataManager();
  const { messages: allMessages } = messaging;

  logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Hook called for conversation ${conversationId}, total conversations in state: ${allMessages.size}`);

  return useMemo(() => {
    const conversationData = allMessages.get(conversationId);

    if (!conversationData) {
      logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} No data for conversation ${conversationId}`);
      return {
        messages: [],
        hasMoreMessages: false,
        totalCount: 0,
        lastMessage: null,
        lastActivity: 0,
      };
    }

    logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Returning ${conversationData.messages.length} messages for conversation ${conversationId}`);

    // Log the last few messages to help debug
    if (conversationData.messages.length > 0) {
      const lastMessages = conversationData.messages.slice(-3);
      logger.log(`${DATA_MANAGER_CONSTANTS.CONVERSATION_LOG_PREFIX} Last 3 messages:`, lastMessages.map(m => ({
        id: m.id.slice(0, 8) + '...',
        content: m.content.slice(0, 30) + (m.content.length > 30 ? '...' : ''),
        created_at: new Date(m.created_at * 1000).toISOString()
      })));
    }

    return {
      messages: conversationData.messages,
      hasMoreMessages: false, // This will be handled by pagination logic
      totalCount: conversationData.messages.length,
      lastMessage: conversationData.lastMessage,
      lastActivity: conversationData.lastActivity,
    };
  }, [allMessages, conversationId]);
}

interface DataManagerProviderProps {
  children: ReactNode;
}

export function DataManagerProvider({ children }: DataManagerProviderProps) {
  const { user } = useCurrentUser();
  const { settings } = useUserSettings();
  const { nostr } = useNostr();
  const { sendNIP4Message, sendNIP17Message } = useSendDM();

  // Memoize the user pubkey to prevent unnecessary re-renders
  const userPubkey = useMemo(() => user?.pubkey, [user?.pubkey]);

  const [messages, setMessages] = useState<MessagesState>(new Map());
  const [lastSync, setLastSync] = useState<LastSyncData>({
    nip4: null,
    nip17: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(LOADING_PHASES.IDLE);
  const [subscriptions, setSubscriptions] = useState<SubscriptionStatus>({
    nip4: false,
    nip17: false
  });

  // Track whether initial load has already completed
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);

  // Track whether we should save immediately (for relay messages)
  const [shouldSaveImmediately, setShouldSaveImmediately] = useState(false);

  // Track scan progress for user feedback
  const [scanProgress, setScanProgress] = useState<ScanProgressState>({
    nip4: null,
    nip17: null
  });

  // Subscription refs for real-time message processing
  const nip4SubscriptionRef = useRef<{ close: () => void } | null>(null);
  const nip17SubscriptionRef = useRef<{ close: () => void } | null>(null);

  // Communities state
  const [communities, setCommunities] = useState<CommunitiesState>(new Map());
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesLoadingPhase, setCommunitiesLoadingPhase] = useState<LoadingPhase>(LOADING_PHASES.IDLE);
  const [communitiesLoadTime, setCommunitiesLoadTime] = useState<number | null>(null);
  const [communitiesLoadBreakdown, setCommunitiesLoadBreakdown] = useState<{
    communities: number;
    channels: number;
    permissions: number;
    messages: number;
    total: number;
  } | null>(null);

  // Single, deterministic message loading - happens exactly once when provider initializes
  useEffect(() => {
    logger.log('DMS: DataManager: Main effect triggered with:', { userPubkey, hasInitialLoadCompleted, isLoading });

    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return;
    }

    if (hasInitialLoadCompleted) {
      logger.log('DMS: DataManager: Initial load already completed, skipping duplicate request');
      return;
    }

    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }

    logger.log('DMS: DataManager: Starting initial message loading process');
    startMessageLoading();
  }, [userPubkey, hasInitialLoadCompleted, isLoading]); // Only depend on user pubkey - settings are handled separately

  // Separate effect for cleanup when user changes
  useEffect(() => {
    return () => {
      // Only clean up subscriptions when the user pubkey changes (component unmounts or user switches)
      if (nip4SubscriptionRef.current) {
        nip4SubscriptionRef.current.close();
        nip4SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Cleaned up NIP-4 subscription during user change cleanup');
      }
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        nip17SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Cleaned up NIP-17 subscription during user change cleanup');
      }
    };
  }, [userPubkey]); // Only depend on userPubkey for cleanup



  // Load past NIP-4 messages from relays (following useNIP4DirectMessages pattern)
  const loadPastNIP4Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-4 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);
    logger.log(`DMS: DataManager: NIP-4 Debug - User pubkey: ${user?.pubkey?.slice(0, 8)}..., Signer available: ${!!user?.signer?.nip04}`);

    // Note: We'll fetch messages even without a signer, but they won't be decrypted
    if (!user?.pubkey) {
      logger.error('DMS: DataManager: No user pubkey available');
      return;
    }

    let allMessages: NostrEvent[] = [];
    let processedMessages = 0;
    let currentSince = sinceTimestamp || 0;
    const SCAN_TOTAL_LIMIT = DATA_MANAGER_CONSTANTS.SCAN_TOTAL_LIMIT;
    const SCAN_BATCH_SIZE = DATA_MANAGER_CONSTANTS.SCAN_BATCH_SIZE;

    logger.log(`DMS: DataManager: Starting NIP-4 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);

    // Initialize scan progress
    setScanProgress(prev => ({ ...prev, nip4: { current: 0, status: SCAN_STATUS_MESSAGES.NIP4_STARTING } }));

    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);

      // Build filters for this batch - same as useNIP4DirectMessages
      const filters = [
        {
          kinds: [4],
          '#p': [user.pubkey],
          limit: batchLimit,
          since: currentSince
        },
        {
          kinds: [4],
          authors: [user.pubkey],
          limit: batchLimit,
          since: currentSince
        }
      ];

      logger.log(`DMS: DataManager: NIP-4 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} messages since ${new Date(currentSince * 1000).toISOString()}`);

      try {
        logger.log(`DMS: DataManager: NIP-4 Querying filters:`, JSON.stringify(filters, null, 2));
        const batchDMs = await nostr.query(filters, { signal: AbortSignal.timeout(DATA_MANAGER_CONSTANTS.NIP4_QUERY_TIMEOUT) });
        logger.log(`DMS: DataManager: NIP-4 Raw response: ${batchDMs.length} events`);

        const validBatchDMs = batchDMs.filter(validateDMEvent);
        logger.log(`DMS: DataManager: NIP-4 After validation: ${validBatchDMs.length} valid events`);

        if (validBatchDMs.length === 0) {
          logger.log('DMS: DataManager: NIP-4 No more messages available, stopping scan');
          break;
        }

        allMessages = [...allMessages, ...validBatchDMs];
        processedMessages += validBatchDMs.length;

        // Update scan progress
        setScanProgress(prev => ({
          ...prev,
          nip4: {
            current: allMessages.length,
            status: `Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1} complete: ${validBatchDMs.length} messages`
          }
        }));

        // Update currentSince for next batch using the correct timestamp coordination logic
        // Find the OLDEST timestamp from EACH query separately
        const oldestToMe = validBatchDMs.filter(m => m.pubkey !== user.pubkey).length > 0
          ? Math.min(...validBatchDMs.filter(m => m.pubkey !== user.pubkey).map(m => m.created_at))
          : Infinity;
        const oldestFromMe = validBatchDMs.filter(m => m.pubkey === user.pubkey).length > 0
          ? Math.min(...validBatchDMs.filter(m => m.pubkey === user.pubkey).map(m => m.created_at))
          : Infinity;

        // Use the EARLIER timestamp to ensure no gaps between batches
        const oldestInBatch = Math.min(oldestToMe, oldestFromMe);
        if (oldestInBatch !== Infinity) {
          currentSince = oldestInBatch; // Next batch starts from the EARLIER timestamp
          logger.log(`DMS: DataManager: NIP-4 Batch timestamp coordination: oldestToMe: ${oldestToMe !== Infinity ? new Date(oldestToMe * 1000).toISOString() : 'none'}, oldestFromMe: ${oldestFromMe !== Infinity ? new Date(oldestFromMe * 1000).toISOString() : 'none'}, next batch since: ${new Date(currentSince * 1000).toISOString()}`);
        }

        logger.log(`DMS: DataManager: NIP-4 Batch complete: ${validBatchDMs.length} messages, total: ${allMessages.length}`);

        // Stop if we got fewer messages than requested (end of data)
        if (validBatchDMs.length < batchLimit * 2) { // *2 because we have 2 filters
          logger.log('DMS: DataManager: NIP-4 Reached end of available messages');
          break;
        }
      } catch (error) {
        logger.error('DMS: DataManager: NIP-4 Error in batch query:', error);
        break;
      }
    }

    logger.log(`DMS: DataManager: NIP-4 Scan complete: ${allMessages.length} total messages processed`);

    // Clear scan progress when complete
    setScanProgress(prev => ({ ...prev, nip4: null }));

    return allMessages;
  }, [user, nostr]);

  // Load past NIP-17 messages from relays (following useNIP17DirectMessages pattern)
  const loadPastNIP17Messages = useCallback(async (sinceTimestamp?: number) => {
    logger.log(`DMS: DataManager: Loading past NIP-17 messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);

    // Note: We'll fetch messages even without a signer, but they won't be decrypted
    if (!user?.pubkey) {
      logger.error('DMS: DataManager: No user pubkey available');
      return;
    }

    let allNIP17Events: NostrEvent[] = [];
    let processedMessages = 0;
    let currentSince = sinceTimestamp || 0;
    const SCAN_TOTAL_LIMIT = DATA_MANAGER_CONSTANTS.SCAN_TOTAL_LIMIT;
    const SCAN_BATCH_SIZE = DATA_MANAGER_CONSTANTS.SCAN_BATCH_SIZE;

    logger.log(`DMS: DataManager: Starting NIP-17 batch processing (limit: ${SCAN_TOTAL_LIMIT}, batch: ${SCAN_BATCH_SIZE})`);

    // Initialize scan progress
    setScanProgress(prev => ({ ...prev, nip17: { current: 0, status: SCAN_STATUS_MESSAGES.NIP17_STARTING } }));

    while (processedMessages < SCAN_TOTAL_LIMIT) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, SCAN_TOTAL_LIMIT - processedMessages);

      // NIP-17: Query Kind 1059 (Gift Wrap) messages where we're the recipient
      const filters = [
        {
          kinds: [1059],
          '#p': [user.pubkey], // We are the recipient
          limit: batchLimit,
          since: currentSince
        }
      ];

      logger.log(`DMS: DataManager: NIP-17 Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1}: requesting ${batchLimit} Gift Wrap messages since ${new Date(currentSince * 1000).toISOString()}`);

      try {
        logger.log(`DMS: DataManager: NIP-17 Querying filters:`, JSON.stringify(filters, null, 2));
        const batchEvents = await nostr.query(filters, { signal: AbortSignal.timeout(DATA_MANAGER_CONSTANTS.NIP17_QUERY_TIMEOUT) });
        logger.log(`DMS: DataManager: NIP-17 Raw response: ${batchEvents.length} events`);

        if (batchEvents.length === 0) {
          logger.log('DMS: DataManager: NIP-17 No more Gift Wrap messages available, stopping scan');
          break;
        }

        allNIP17Events = [...allNIP17Events, ...batchEvents];
        processedMessages += batchEvents.length;

        // Update scan progress
        setScanProgress(prev => ({
          ...prev,
          nip17: {
            current: allNIP17Events.length,
            status: `Batch ${Math.floor(processedMessages / SCAN_BATCH_SIZE) + 1} complete: ${batchEvents.length} messages`
          }
        }));

        // Update currentSince for next batch (NIP-17 only has one filter, so simpler)
        if (batchEvents.length > 0) {
          const oldestInBatch = Math.min(...batchEvents.map(m => m.created_at));
          currentSince = oldestInBatch; // Next batch starts from where this one ended
          logger.log(`DMS: DataManager: NIP-17 Batch timestamp coordination: oldest in batch: ${new Date(oldestInBatch * 1000).toISOString()}, next batch since: ${new Date(currentSince * 1000).toISOString()}`);
        }

        logger.log(`DMS: DataManager: NIP-17 Batch complete: ${batchEvents.length} Gift Wrap messages, total: ${allNIP17Events.length}`);

        // Stop if we got fewer messages than requested (end of data)
        if (batchEvents.length < batchLimit) {
          logger.log('DMS: DataManager: NIP-17 Reached end of available Gift Wrap messages');
          break;
        }
      } catch (error) {
        logger.error('DMS: DataManager: NIP-17 Error in batch query:', error);
        break;
      }
    }

    logger.log(`DMS: DataManager: NIP-17 Scan complete: ${allNIP17Events.length} total Gift Wrap messages processed`);

    // Clear scan progress when complete
    setScanProgress(prev => ({ ...prev, nip17: null }));

    return allNIP17Events;
  }, [user, nostr]);

  // Stage 1: Read all past messages from storage for a specific protocol
  const loadPreviousCachedMessages = useCallback(async (protocol: MessageProtocol): Promise<number | undefined> => {
    const startTime = Date.now();
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 - Loading past messages from storage`);

    // Skip NIP-17 if it's disabled
    if (protocol === MESSAGE_PROTOCOL.NIP17 && !settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 disabled, skipping message loading');
      return undefined;
    }

    // Ensure we have a user pubkey
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping message loading');
      return undefined;
    }

    try {
      // First, read any cached messages from IndexedDB to get the newest timestamp
      let sinceTimestamp: number | undefined;
      let dbReadTime: number;
      try {
        const dbStartTime = Date.now();
        const { readMessagesFromDB } = await import('@/lib/messageStore');
        const cachedStore = await readMessagesFromDB(userPubkey);
        dbReadTime = Date.now() - dbStartTime;

        if (cachedStore && Object.keys(cachedStore.participants).length > 0) {
          logger.log(`DMS: DataManager: ✅ Found cached store with ${Object.keys(cachedStore.participants).length} participants (${dbReadTime}ms)`);

          // Filter participants based on NIP-17 setting
          const filteredParticipants = settings.enableNIP17
            ? cachedStore.participants
            : Object.fromEntries(
              Object.entries(cachedStore.participants).filter(([_, participant]) =>
                !participant.hasNIP17
              )
            );

          // Use the actual lastSync timestamps from the stored data, not recalculated from messages
          if (protocol === MESSAGE_PROTOCOL.NIP04 && cachedStore.lastSync.nip4) {
            sinceTimestamp = cachedStore.lastSync.nip4;
            logger.log(`DMS: DataManager: Using stored NIP-4 lastSync timestamp: ${new Date(sinceTimestamp * 1000).toISOString()}`);
          } else if (protocol === MESSAGE_PROTOCOL.NIP17 && cachedStore.lastSync.nip17) {
            sinceTimestamp = cachedStore.lastSync.nip17;
            logger.log(`DMS: DataManager: Using stored NIP-17 lastSync timestamp: ${new Date(sinceTimestamp * 1000).toISOString()}`);
          }

          let totalMessages = 0;
          let filteredOutCount = 0;

          Object.values(filteredParticipants).forEach(participant => {
            totalMessages += participant.messages.length;
          });

          filteredOutCount = Object.keys(cachedStore.participants).length - Object.keys(filteredParticipants).length;

          logger.log(`DMS: DataManager: Found ${totalMessages} cached messages (${filteredOutCount} NIP-17 participants filtered out)`);

          // Load filtered cached messages into state
          const newState = new Map();
          for (const [participantPubkey, participant] of Object.entries(filteredParticipants)) {
            // Messages from IndexedDB are encrypted - decrypt them on read
            const processedMessages = await Promise.all(participant.messages.map(async (msg) => {
              // Check if this is an encrypted message that needs decryption
              if (msg.kind === 4) {
                // NIP-4 message - decrypt it
                const isFromUser = msg.pubkey === user?.pubkey;
                const recipientPTag = msg.tags?.find(([name]) => name === 'p')?.[1];
                const otherPubkey = isFromUser ? recipientPTag : msg.pubkey;

                if (otherPubkey && otherPubkey !== user?.pubkey) {
                  const { decryptedContent, error } = await decryptNIP4Message(msg, otherPubkey);
                  return {
                    ...msg,
                    content: msg.content, // Keep original encrypted content
                    decryptedContent: decryptedContent,
                    error: error,
                  } as NostrEvent & { decryptedContent?: string; error?: string };
                }
              } else if (msg.kind === 1059) {
                // NIP-17 Gift Wrap message - decrypt it
                const { processedMessage, error } = await processNIP17GiftWrap(msg);
                return {
                  ...msg, // Keep original Gift Wrap event structure
                  decryptedContent: processedMessage.decryptedContent, // Store decrypted content
                  error: error,
                } as NostrEvent & { decryptedContent?: string; error?: string };
              }

              // For non-encrypted messages, just return as-is
              return msg;
            }));

            newState.set(participantPubkey, {
              messages: processedMessages,
              lastActivity: participant.lastActivity,
              lastMessage: processedMessages.length > 0 ? processedMessages[processedMessages.length - 1] : null, // Last after sorting (newest)
              hasNIP4: participant.hasNIP4,
              hasNIP17: participant.hasNIP17,
            });
          }

          // Update state with cached messages
          setMessages(newState);
          logger.log(`DMS: DataManager: ✅ Loaded ${totalMessages} cached messages for ${newState.size} participants into state`);

          // Also update lastSync from the cached data
          if (cachedStore.lastSync) {
            setLastSync(cachedStore.lastSync);
            logger.log(`DMS: DataManager: Updated lastSync from cached data: NIP-4: ${cachedStore.lastSync.nip4 ? new Date(cachedStore.lastSync.nip4 * 1000).toISOString() : 'Never'}, NIP-17: ${cachedStore.lastSync.nip17 ? new Date(cachedStore.lastSync.nip17 * 1000).toISOString() : 'Never'}`);
          }
        } else {
          logger.log(`DMS: DataManager: No cached messages found in IndexedDB (${dbReadTime}ms)`);
        }
      } catch (error) {
        logger.error('DMS: DataManager: Error reading from IndexedDB:', error);
      }

      // Log total time for Stage 1
      const totalTime = Date.now() - startTime;
      logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 1 complete in ${totalTime}ms`);

      return sinceTimestamp;
    } catch (error) {
      logger.error(`DMS: DataManager: Error in Stage 1 for ${protocol}:`, error);
      return undefined;
    }
  }, [settings.enableNIP17, userPubkey]);

  // Stage 2: Query for messages between last sync and now for a specific protocol
  const queryRelaysForMessagesSince = useCallback(async (protocol: MessageProtocol, sinceTimestamp?: number): Promise<MessageProcessingResult> => {
    logger.log(`DMS: DataManager: [${protocol.toUpperCase()}] Stage 2 - Querying for missed messages since ${sinceTimestamp ? new Date(sinceTimestamp * 1000).toISOString() : 'beginning'}`);

    // Skip NIP-17 if it's disabled
    if (protocol === MESSAGE_PROTOCOL.NIP17 && !settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 disabled, skipping relay querying');
      return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
    }

    // Ensure we have a user pubkey
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available, skipping relay querying');
      return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
    }

    if (protocol === MESSAGE_PROTOCOL.NIP04) {
      const relayStartTime = Date.now();
      const messages = await loadPastNIP4Messages(sinceTimestamp);
      const relayTime = Date.now() - relayStartTime;
      logger.log(`DMS: DataManager: NIP-4 Stage 2 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);

      // Store NIP-4 messages organized by participant
      if (messages && messages.length > 0) {
        // Build up new state
        const newState = new Map();

        // Process messages and decrypt them
        for (const message of messages) {
          const isFromUser = message.pubkey === user?.pubkey;
          const recipientPTag = message.tags?.find(([name]) => name === 'p')?.[1];
          const otherPubkey = isFromUser ? recipientPTag : message.pubkey;

          if (!otherPubkey || otherPubkey === user?.pubkey) continue;

          // Decrypt the NIP-4 message content using reusable method
          const { decryptedContent, error } = await decryptNIP4Message(message, otherPubkey);

          // Create decrypted message
          const decryptedMessage: DecryptedMessage = {
            ...message,
            content: message.content, // Keep original encrypted content
            decryptedContent: decryptedContent, // Store decrypted content
            error: error, // Add error field
          };

          // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
          const messageAge = Date.now() - (message.created_at * 1000);
          if (messageAge < 5000) { // 5 seconds
            decryptedMessage.clientFirstSeen = Date.now();
          }

          // Add to new state or create new participant
          if (!newState.has(otherPubkey)) {
            newState.set(otherPubkey, createEmptyParticipant());
          }

          const participant = newState.get(otherPubkey)!;
          participant.messages.push(decryptedMessage);
          participant.hasNIP4 = true;
        }

        // Sort all participants' messages once after adding all messages
        newState.forEach(participant => {
          sortAndUpdateParticipantState(participant);
        });

        // Update state with new data - preserve existing protocol flags
        mergeMessagesIntoState(newState);

        // Update lastSync for NIP-4 to the current time since we just processed new messages
        const currentTime = Math.floor(Date.now() / 1000);
        setLastSync(prev => ({ ...prev, nip4: currentTime }));
        logger.log(`DMS: DataManager: Updated lastSync.nip4 to ${new Date(currentTime * 1000).toISOString()}`);

        logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-4 messages for ${newState.size} participants`);

        // Return the timestamp of the newest message processed
        const newestMessage = messages.reduce((newest, msg) =>
          msg.created_at > newest.created_at ? msg : newest
        );
        return { lastMessageTimestamp: newestMessage.created_at, messageCount: messages.length };
      } else {
        return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
      }
    } else if (protocol === MESSAGE_PROTOCOL.NIP17) {
      const relayStartTime = Date.now();
      const messages = await loadPastNIP17Messages(sinceTimestamp);
      const relayTime = Date.now() - relayStartTime;
      logger.log(`DMS: DataManager: NIP-17 Stage 2 complete: ${messages?.length || 0} messages loaded from relays (${relayTime}ms)`);

      // Store NIP-17 messages organized by participant
      if (messages && messages.length > 0) {
        // Build up new state
        const newState = new Map();

        // Process messages and decrypt them
        for (const giftWrap of messages) {
          // Process the Gift Wrap message using reusable method
          const { processedMessage, conversationPartner } = await processNIP17GiftWrap(giftWrap);

          // Store the original Gift Wrap event with decrypted content for display
          const messageWithAnimation: DecryptedMessage = {
            ...giftWrap, // Keep original Gift Wrap event structure
            decryptedContent: processedMessage.decryptedContent, // Store decrypted content
            error: processedMessage.error, // Store any decryption errors
          };

          const messageAge = Date.now() - (giftWrap.created_at * 1000);
          if (messageAge < 5000) { // 5 seconds
            messageWithAnimation.clientFirstSeen = Date.now();
          }

          // Add message to state
          if (!newState.has(conversationPartner)) {
            newState.set(conversationPartner, createEmptyParticipant());
          }

          newState.get(conversationPartner)!.messages.push(messageWithAnimation);
          newState.get(conversationPartner)!.hasNIP17 = true;
        }

        // Sort all participants' messages once after adding all messages
        newState.forEach(participant => {
          sortAndUpdateParticipantState(participant);
        });

        // Update state with new data - preserve existing protocol flags
        mergeMessagesIntoState(newState);

        // Update lastSync for NIP-17 to the current time since we just processed new messages
        const currentTime = Math.floor(Date.now() / 1000);
        setLastSync(prev => ({ ...prev, nip17: currentTime }));
        logger.log(`DMS: DataManager: Updated lastSync.nip17 to ${new Date(currentTime * 1000).toISOString()}`);

        logger.log(`DMS: DataManager: Stored ${messages.length} decrypted NIP-17 messages for ${newState.size} participants`);

        // Return the timestamp of the newest message processed
        const newestMessage = messages.reduce((newest, msg) =>
          msg.created_at > newest.created_at ? msg : newest
        );
        return { lastMessageTimestamp: newestMessage.created_at, messageCount: messages.length };
      } else {
        return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
      }
    }

    // If no messages were processed, return the input timestamp
    return { lastMessageTimestamp: sinceTimestamp, messageCount: 0 };
  }, [settings.enableNIP17, userPubkey, loadPastNIP4Messages, loadPastNIP17Messages]);

  // Reusable method to decrypt NIP-4 message content
  const decryptNIP4Message = useCallback(async (event: NostrEvent, otherPubkey: string): Promise<DecryptionResult> => {
    try {
      if (user?.signer?.nip04) {
        const decryptedContent = await user.signer.nip04.decrypt(otherPubkey, event.content);
        return { decryptedContent };
      } else {
        logger.log(`DMS: DataManager: No NIP-04 decryption available for message ${event.id}`);
        return {
          decryptedContent: '',
          error: 'No NIP-04 decryption available'
        };
      }
    } catch (error) {
      logger.error(`DMS: DataManager: Failed to decrypt NIP-4 message ${event.id}:`, error);
      return {
        decryptedContent: '',
        error: 'Decryption failed'
      };
    }
  }, [user]);

  // Helper to create an empty participant with default values
  const createEmptyParticipant = useCallback(() => ({
    messages: [],
    lastActivity: 0,
    lastMessage: null,
    hasNIP4: false,
    hasNIP17: false,
  }), []);

  // Helper to sort messages and update participant state
  const sortAndUpdateParticipantState = useCallback((participant: { messages: DecryptedMessage[]; lastActivity: number; lastMessage: DecryptedMessage | null }) => {
    participant.messages.sort((a, b) => a.created_at - b.created_at); // Oldest first
    if (participant.messages.length > 0) {
      participant.lastActivity = participant.messages[participant.messages.length - 1].created_at; // Last after sorting (newest)
      participant.lastMessage = participant.messages[participant.messages.length - 1];
    }
  }, []);

  // Helper to merge new messages into existing state
  const mergeMessagesIntoState = useCallback((newState: MessagesState) => {
    setMessages(prev => {
      const finalMap = new Map(prev);

      // Merge with new data
      newState.forEach((value, key) => {
        const existing = finalMap.get(key);
        if (existing) {
          // Merge with existing participant, preserving protocol flags and deduplicating messages
          const existingMessageIds = new Set(existing.messages.map(msg => msg.id));
          const newMessages = value.messages.filter(msg => !existingMessageIds.has(msg.id));

          if (newMessages.length > 0) {
            logger.log(`DMS: DataManager: Merging ${newMessages.length} new messages for ${key} (${value.messages.length - newMessages.length} duplicates filtered out)`);
          }

          const mergedMessages = [...existing.messages, ...newMessages];
          mergedMessages.sort((a, b) => a.created_at - b.created_at); // Keep oldest first

          finalMap.set(key, {
            ...existing,
            messages: mergedMessages,
            hasNIP4: existing.hasNIP4 || value.hasNIP4,
            hasNIP17: existing.hasNIP17 || value.hasNIP17,
          });
        } else {
          finalMap.set(key, value);
        }
      });

      return finalMap;
    });
  }, []);

  // Debounced write ref for IndexedDB persistence
  const debouncedWriteRef = useRef<NodeJS.Timeout | null>(null);

  // Reusable method to add a message to the state
  const addMessageToState = useCallback((message: DecryptedMessage, conversationPartner: string, protocol: MessageProtocol) => {
    setMessages(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(conversationPartner);

      if (existing) {
        // Check if message already exists to prevent duplicates
        if (existing.messages.some(msg => msg.id === message.id)) {
          logger.log(`DMS: DataManager: ${protocol} message ${message.id} already exists in conversation, skipping`);
          return prev; // Return unchanged state
        }

        // Check if this real message should replace an optimistic message
        const optimisticIndex = existing.messages.findIndex(msg =>
          msg.isSending &&
          msg.pubkey === message.pubkey &&
          msg.decryptedContent === message.decryptedContent && // Both have decryptedContent
          Math.abs(msg.created_at - message.created_at) <= 30 // 30 second window
        );

        let updatedMessages: DecryptedMessage[];
        if (optimisticIndex !== -1) {
          // Replace the optimistic message with the real one (preserve animation timestamp)
          logger.log(`DMS: DataManager: Replacing optimistic message at index ${optimisticIndex} with real message ${message.id}`);
          const existingMessage = existing.messages[optimisticIndex];
          updatedMessages = [...existing.messages];
          updatedMessages[optimisticIndex] = {
            ...message,
            created_at: existingMessage.created_at, // Preserve optimistic timestamp to maintain position
            clientFirstSeen: existingMessage.clientFirstSeen // Preserve animation timestamp
          };
        } else {
          // Add as new message
          updatedMessages = [...existing.messages, message];
        }

        updatedMessages.sort((a, b) => a.created_at - b.created_at); // Keep oldest first

        newMap.set(conversationPartner, {
          ...existing,
          messages: updatedMessages,
          lastActivity: message.created_at,
          lastMessage: message,
          hasNIP4: protocol === MESSAGE_PROTOCOL.NIP04 ? true : existing.hasNIP4,
          hasNIP17: protocol === MESSAGE_PROTOCOL.NIP17 ? true : existing.hasNIP17,
        });

        logger.log(`DMS: DataManager: Updated existing conversation with ${conversationPartner}, now has ${updatedMessages.length} messages`);
      } else {
        // Create new conversation
        const newConversation = {
          messages: [message],
          lastActivity: message.created_at,
          lastMessage: message,
          hasNIP4: protocol === MESSAGE_PROTOCOL.NIP04,
          hasNIP17: protocol === MESSAGE_PROTOCOL.NIP17,
        };

        newMap.set(conversationPartner, newConversation);
        logger.log(`DMS: DataManager: Created new conversation with ${conversationPartner}`);
      }

      logger.log(`DMS: DataManager: State update complete. Total conversations: ${newMap.size}`);

      return newMap;
    });
  }, []);

  // Process incoming NIP-4 messages and add them to the data structure
  const processIncomingNIP4Message = useCallback(async (event: NostrEvent) => {
    if (!user?.pubkey) return;

    logger.log(`DMS: DataManager: Processing incoming NIP-4 message: ${event.id}`);

    // Validate the DM event
    if (!validateDMEvent(event)) {
      logger.warn(`DMS: DataManager: Invalid NIP-4 event received: ${event.id}`);
      return;
    }

    // Determine conversation partner
    const isFromUser = event.pubkey === user.pubkey;
    const recipientPTag = event.tags?.find(([name]) => name === 'p')?.[1];
    const otherPubkey = isFromUser ? recipientPTag : event.pubkey;

    if (!otherPubkey || otherPubkey === user.pubkey) {
      logger.warn(`DMS: DataManager: Invalid conversation partner in NIP-4 event: ${event.id}`);
      return;
    }

    // Decrypt the message content
    const { decryptedContent, error } = await decryptNIP4Message(event, otherPubkey);

    // Create decrypted message with clientFirstSeen for animation
    const decryptedMessage: DecryptedMessage = {
      ...event,
      content: event.content, // Keep original encrypted content
      decryptedContent: decryptedContent, // Store decrypted content
      error: error, // Add error field
    };

    // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
    const messageAge = Date.now() - (event.created_at * 1000);
    if (messageAge < 5000) { // 5 seconds
      decryptedMessage.clientFirstSeen = Date.now();
    }

    // Add to messages state using reusable method
    addMessageToState(decryptedMessage, otherPubkey, MESSAGE_PROTOCOL.NIP04);

    logger.log(`DMS: DataManager: Added incoming NIP-4 message to conversation with ${otherPubkey}`);
  }, [user, decryptNIP4Message, addMessageToState]);

  // Reusable method to process NIP-17 Gift Wrap messages
  const processNIP17GiftWrap = useCallback(async (event: NostrEvent): Promise<NIP17ProcessingResult> => {
    if (!user?.signer?.nip44) {
      // No decryption available - store with error
      return {
        processedMessage: {
          ...event,
          content: '', // Keep original encrypted content
          decryptedContent: '', // No decrypted content
          error: 'No NIP-44 decryption available',
        },
        conversationPartner: event.pubkey,
      };
    }

    try {
      // Decrypt Gift Wrap → Seal → Private DM
      const sealContent = await user.signer.nip44.decrypt(event.pubkey, event.content);
      const sealEvent = JSON.parse(sealContent) as NostrEvent;

      if (sealEvent.kind !== 13) {
        // Invalid Seal format - store with error
        return {
          processedMessage: {
            ...event,
            content: '', // Keep original encrypted content
            decryptedContent: '', // No decrypted content
            error: `Invalid Seal format - expected kind 13, got ${sealEvent.kind}`,
          },
          conversationPartner: event.pubkey,
        };
      }

      const messageContent = await user.signer.nip44.decrypt(sealEvent.pubkey, sealEvent.content);
      const messageEvent = JSON.parse(messageContent) as NostrEvent;

      if (messageEvent.kind !== 14) {
        // Invalid message format - store with error
        return {
          processedMessage: {
            ...event,
            content: '', // Keep original encrypted content
            decryptedContent: '', // No decrypted content
            error: `Invalid message format - expected kind 14, got ${messageEvent.kind}`,
          },
          conversationPartner: event.pubkey,
        };
      }

      // Determine conversation partner
      let conversationPartner: string;
      if (sealEvent.pubkey === user.pubkey) {
        const recipient = messageEvent.tags.find(([name]) => name === 'p')?.[1];
        if (!recipient || recipient === user.pubkey) {
          // Invalid recipient - store with error
          return {
            processedMessage: {
              ...event,
              content: '', // Keep original encrypted content
              decryptedContent: '', // No decrypted content
              error: 'Invalid recipient - malformed p tag',
            },
            conversationPartner: event.pubkey,
          };
        } else {
          conversationPartner = recipient;
        }
      } else {
        conversationPartner = sealEvent.pubkey;
      }

      return {
        processedMessage: {
          ...messageEvent,
          content: event.content, // Keep original encrypted content
          decryptedContent: messageEvent.content, // Store decrypted content
        },
        conversationPartner,
      };
    } catch (error) {
      // Decryption/parsing failed - store with error
      nip17ErrorLogger(error);
      return {
        processedMessage: {
          ...event,
          content: '', // Keep original encrypted content
          decryptedContent: '', // No decrypted content
          error: 'Failed to decrypt or parse NIP-17 message',
        },
        conversationPartner: event.pubkey,
      };
    }
  }, [user]);

  // Reusable method to process NIP-17 Gift Wrap messages
  const processIncomingNIP17Message = useCallback(async (event: NostrEvent) => {
    if (!user?.pubkey) return;

    logger.log(`DMS: DataManager: Processing incoming NIP-17 message: ${event.id}`);

    // NIP-17 messages are kind 1059 (Gift Wrap)
    if (event.kind !== 1059) {
      logger.warn(`DMS: DataManager: Invalid NIP-17 event kind: ${event.kind} for event ${event.id}`);
      return;
    }

    // Process the Gift Wrap message using reusable method
    const { processedMessage, conversationPartner } = await processNIP17GiftWrap(event);

    // Store the original Gift Wrap event with decrypted content for display
    const messageWithAnimation: DecryptedMessage = {
      ...event, // Keep original Gift Wrap event structure
      decryptedContent: processedMessage.decryptedContent, // Store decrypted content
      error: processedMessage.error, // Store any decryption errors
    };

    // Add clientFirstSeen for genuinely recent messages (created in last 5 seconds)
    const messageAge = Date.now() - (event.created_at * 1000);
    if (messageAge < 5000) { // 5 seconds
      messageWithAnimation.clientFirstSeen = Date.now();
    }

    // Add to messages state using reusable method
    addMessageToState(messageWithAnimation, conversationPartner, MESSAGE_PROTOCOL.NIP17);

    logger.log(`DMS: DataManager: Added incoming NIP-17 message to conversation with ${conversationPartner}`);
  }, [user, processNIP17GiftWrap, addMessageToState]);

  // Start NIP-4 subscription for all conversations
  const startNIP4Subscription = useCallback(async (sinceTimestamp?: number) => {
    if (!user?.pubkey || !nostr) return;

    // Close existing subscription
    if (nip4SubscriptionRef.current) {
      nip4SubscriptionRef.current.close();
      logger.log('DMS: DataManager: Closed existing NIP-4 subscription');
    }

    try {
      // Use provided timestamp or fall back to lastSync
      let subscriptionSince = sinceTimestamp || Math.floor(Date.now() / 1000);
      if (!sinceTimestamp && lastSync.nip4) {
        // Subtract 60 seconds to ensure we don't miss messages due to optimistic updates
        subscriptionSince = lastSync.nip4 - 60;
      }

      const filters = [
        {
          kinds: [4], // NIP-4 DMs sent to us
          '#p': [user.pubkey],
          since: subscriptionSince,
        },
        {
          kinds: [4], // NIP-4 DMs sent by us
          authors: [user.pubkey],
          since: subscriptionSince,
        }
      ];

      logger.log(`DMS: DataManager: Starting NIP-4 subscription since ${new Date(subscriptionSince * 1000).toISOString()}`);
      logger.log(`DMS: DataManager: NIP-4 subscription filters:`, JSON.stringify(filters, null, 2));
      logger.log(`DMS: DataManager: User pubkey: ${user.pubkey}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              logger.log(`DMS: DataManager: Received NIP-4 event: ${msg[2].id} from ${msg[2].pubkey}`);
              await processIncomingNIP4Message(msg[2]);
            } else {
              logger.log(`DMS: DataManager: Received non-event message:`, msg);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('DMS: DataManager: NIP-4 subscription error:', error);
          }
        }
      })();

      nip4SubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('DMS: DataManager: NIP-4 subscription closed');
        }
      };

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip4: true }));
      logger.log('DMS: DataManager: NIP-4 subscription started successfully');
      logger.log('DMS: DataManager: NIP-4 subscription ref:', !!nip4SubscriptionRef.current);

    } catch (error) {
      logger.error('DMS: DataManager: Failed to start NIP-4 subscription:', error);
      setSubscriptions(prev => ({ ...prev, nip4: false }));
    }
  }, [user, nostr, lastSync.nip4, processIncomingNIP4Message]);

  // Start NIP-17 subscription for all conversations
  const startNIP17Subscription = useCallback(async (sinceTimestamp?: number) => {
    if (!user?.pubkey || !nostr || !settings.enableNIP17) return;

    // Close existing subscription
    if (nip17SubscriptionRef.current) {
      nip17SubscriptionRef.current.close();
      logger.log('DMS: DataManager: Closed existing NIP-17 subscription');
    }

    try {
      // Use provided timestamp or fall back to lastSync
      let subscriptionSince = sinceTimestamp || Math.floor(Date.now() / 1000);
      if (!sinceTimestamp && lastSync.nip17) {
        // Subtract 60 seconds to ensure we don't miss messages due to optimistic updates
        subscriptionSince = lastSync.nip17 - 60;
      }

      const filters = [{
        kinds: [1059], // NIP-17 Gift Wrap messages
        '#p': [user.pubkey], // We are the recipient
        since: subscriptionSince,
      }];

      logger.log(`DMS: DataManager: Starting NIP-17 subscription since ${new Date(subscriptionSince * 1000).toISOString()}`);
      logger.log(`DMS: DataManager: NIP-17 subscription filters:`, JSON.stringify(filters, null, 2));
      logger.log(`DMS: DataManager: User pubkey: ${user.pubkey}`);

      const subscription = nostr.req(filters);
      let isActive = true;

      // Process messages
      (async () => {
        try {
          for await (const msg of subscription) {
            if (!isActive) break;
            if (msg[0] === 'EVENT') {
              logger.log(`DMS: DataManager: Received NIP-17 event: ${msg[2].id} from ${msg[2].pubkey}`);
              await processIncomingNIP17Message(msg[2]);
            } else {
              logger.log(`DMS: DataManager: Received non-event message:`, msg);
            }
          }
        } catch (error) {
          if (isActive) {
            logger.error('DMS: DataManager: NIP-17 subscription error:', error);
          }
        }
      })();

      nip17SubscriptionRef.current = {
        close: () => {
          isActive = false;
          logger.log('DMS: DataManager: NIP-17 subscription closed');
        }
      };

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip17: true }));
      logger.log('DMS: DataManager: NIP-17 subscription started successfully');
      logger.log('DMS: DataManager: NIP-17 subscription ref:', !!nip17SubscriptionRef.current);

    } catch (error) {
      logger.error('DMS: DataManager: Failed to start NIP-17 subscription:', error);
      setSubscriptions(prev => ({ ...prev, nip17: false }));
    }
  }, [user, nostr, lastSync.nip17, settings.enableNIP17, processIncomingNIP17Message]);





  // Main method to start message loading for all enabled protocols
  const startMessageLoading = useCallback(async () => {
    // Prevent multiple simultaneous executions
    if (isLoading) {
      logger.log('DMS: DataManager: Message loading already in progress, skipping duplicate request');
      return;
    }

    logger.log('DMS: DataManager: Starting message loading for all enabled protocols');
    setIsLoading(true);
    setLoadingPhase(LOADING_PHASES.CACHE);

    try {
      // Stage 1: Load from cache for all protocols
      logger.log('DMS: DataManager: Stage 1: Loading cached messages for all protocols');
      const nip4SinceTimestamp = await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP04);
      const nip17SinceTimestamp = settings.enableNIP17 ? await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP17) : undefined;

      // Stage 2: Query relays for all protocols
      logger.log('DMS: DataManager: Stage 2: Querying relays for new messages');
      setLoadingPhase(LOADING_PHASES.RELAYS);

      // Always query NIP-4 relays for new messages (even if no cached messages)
      const nip4Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP04, nip4SinceTimestamp);

      // Query NIP-17 relays if enabled (even if no cached messages)
      let nip17Result: { lastMessageTimestamp?: number; messageCount: number } | undefined;
      if (settings.enableNIP17) {
        nip17Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP17, nip17SinceTimestamp);
      }

      // If we got new messages from either protocol, trigger immediate save
      const totalNewMessages = nip4Result.messageCount + (nip17Result?.messageCount || 0);
      if (totalNewMessages > 0) {
        logger.log(`DMS: DataManager: Found ${totalNewMessages} new messages from relays (NIP-4: ${nip4Result.messageCount}, NIP-17: ${nip17Result?.messageCount || 0}), will save to IndexedDB after state update`);

        // Set a flag to trigger immediate save when state updates
        setShouldSaveImmediately(true);
      }

      // Stage 3: Set up subscriptions for all protocols
      logger.log('DMS: DataManager: Stage 3: Setting up real-time subscriptions');
      setLoadingPhase(LOADING_PHASES.SUBSCRIPTIONS);

      // Use the timestamp of the last processed message for subscriptions
      // This ensures no gaps between relay queries and subscriptions
      await startNIP4Subscription(nip4Result.lastMessageTimestamp);
      if (settings.enableNIP17) {
        await startNIP17Subscription(nip17Result?.lastMessageTimestamp);
      }

      logger.log('DMS: DataManager: All protocol loading complete');
      setHasInitialLoadCompleted(true);
      setLoadingPhase(LOADING_PHASES.READY);
    } catch (error) {
      logger.error('DMS: DataManager: Error in message loading:', error);
      setLoadingPhase(LOADING_PHASES.READY);
    } finally {
      setIsLoading(false);
    }
  }, [loadPreviousCachedMessages, queryRelaysForMessagesSince, startNIP4Subscription, startNIP17Subscription, settings.enableNIP17]);

  // Handle NIP-17 setting changes explicitly
  const handleNIP17SettingChange = useCallback(async (enabled: boolean) => {
    if (!userPubkey) {
      logger.log('DMS: DataManager: No user pubkey available for NIP-17 setting change');
      return;
    }

    if (enabled) {
      // User enabled NIP-17 - load messages now using 3-stage approach
      logger.log('DMS: DataManager: NIP-17 enabled by user, loading messages now');
      const sinceTimestamp = await loadPreviousCachedMessages(MESSAGE_PROTOCOL.NIP17);
      let nip17Result: { lastMessageTimestamp?: number; messageCount: number } | undefined;
      if (sinceTimestamp !== undefined) {
        nip17Result = await queryRelaysForMessagesSince(MESSAGE_PROTOCOL.NIP17, sinceTimestamp);
      }
      await startNIP17Subscription(nip17Result?.lastMessageTimestamp);
    } else {
      // User disabled NIP-17 - clear NIP-17 data and reset sync timestamp
      logger.log('DMS: DataManager: NIP-17 disabled by user, clearing data');
      setLastSync(prev => ({ ...prev, nip17: null }));

      // Close NIP-17 subscription
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        nip17SubscriptionRef.current = null;
        logger.log('DMS: DataManager: Closed NIP-17 subscription due to setting change');
      }

      // Update subscription status
      setSubscriptions(prev => ({ ...prev, nip17: false }));

      // Clear NIP-17 messages from state
      setMessages(prev => {
        const newMap = new Map(prev); // This is fine - just don't mutate objects

        // Process each participant
        prev.forEach((participant, key) => {
          if (participant.hasNIP17) {
            // Remove NIP-17 messages, keep NIP-4 messages
            const nip4Messages = participant.messages.filter(msg => msg.kind === 4);
            if (nip4Messages.length > 0) {
              newMap.set(key, {
                ...participant,
                messages: nip4Messages, // New array reference
                hasNIP17: false,
                lastMessage: nip4Messages[0] || null,
                lastActivity: nip4Messages[0]?.created_at || 0,
              });
            } else {
              // No NIP-4 messages, keep participant but with empty messages
              newMap.set(key, {
                ...participant,
                messages: [], // Empty array instead of deleting
                hasNIP17: false,
                lastMessage: null,
                lastActivity: 0,
              });
            }
          }
          // If no NIP-17 messages, keep as-is (no change needed)
        });

        logger.log(`DMS: DataManager: Cleared NIP-17 data, remaining conversations: ${newMap.size}`);
        return newMap;
      });

      // persist to db, but wait for the state to be updated
      setTimeout(() => {
        writeAllMessagesToStore();
      }, 500);
    }
  }, [loadPreviousCachedMessages, queryRelaysForMessagesSince, startNIP17Subscription, userPubkey]);

  // Track previous NIP-17 setting to detect actual changes
  const prevNIP17Setting = useRef(settings.enableNIP17);

  // Watch for NIP-17 setting changes and handle them explicitly
  useEffect(() => {
    if (!hasInitialLoadCompleted) {
      // Don't handle setting changes until initial load is complete
      return;
    }

    // Only run if the setting actually changed (not on initial mount)
    if (prevNIP17Setting.current !== settings.enableNIP17) {
      logger.log('DMS: DataManager: NIP-17 setting changed from', prevNIP17Setting.current, 'to', settings.enableNIP17);
      handleNIP17SettingChange(settings.enableNIP17);
      prevNIP17Setting.current = settings.enableNIP17;
    }
  }, [settings.enableNIP17, hasInitialLoadCompleted, handleNIP17SettingChange]);

  // ============================================================================
  // Communities Management Functions
  // ============================================================================

  // Load communities the user is a member of with their membership status
  const loadUserCommunities = useCallback(async (): Promise<Array<{
    id: string;
    pubkey: string;
    info: CommunityInfo;
    definitionEvent: NostrEvent;
    membershipStatus: 'approved' | 'pending' | 'blocked';
    membershipEvent: NostrEvent;
  }>> => {
    if (!user?.pubkey) {
      logger.log('Communities: No user pubkey available');
      return [];
    }

    logger.log('Communities: Loading user communities...');

    try {
      // Step 1: Find membership lists that include this user (approved + pending + blocked)
      const membershipFilters = [
        {
          kinds: [34551, 34552, 34553], // Approved + Pending + Blocked members events
          '#p': [user.pubkey], // User is mentioned in the member list
          limit: 1000,
        }
      ];

      logger.log('Communities: Querying for user memberships...');
      const membershipEvents = await nostr.query(membershipFilters, {
        signal: AbortSignal.timeout(15000)
      });

      logger.log(`Communities: Found ${membershipEvents.length} membership records`);

      if (membershipEvents.length === 0) {
        logger.log('Communities: User is not a member of any communities');
        return [];
      }

      // Extract community IDs and their membership status from events
      const membershipStatusMap = new Map(
        membershipEvents
          // Extract community ID and determine status
          .map(event => {
            const communityRef = event.tags.find(([name]) => name === 'd')?.[1];
            if (!communityRef) return null;

            const [kind, pubkey, id] = communityRef.split(':');
            if (!kind || !pubkey || !id) {
              logger.warn(`Communities: Invalid community reference format: ${communityRef}`);
              return null;
            }

            const status = (() => {
              switch (event.kind) {
                case 34551: return 'approved' as const;
                case 34552: return 'pending' as const;
                case 34553: return 'blocked' as const;
                default:
                  logger.warn(`Communities: Unknown membership event kind ${event.kind}, skipping`);
                  return null;
              }
            })();

            if (status === null) return null;

            logger.log(`Communities: Extracted community ID "${id}" from ref "${communityRef}" with status "${status}"`);
            return [id, { status, event }] as const;
          })
          // Remove invalid entries
          .filter((entry) => !!entry)
      );

      // Get unique community IDs for querying
      const communityIds = new Set(membershipStatusMap.keys());

      logger.log(`Communities: User is member of ${communityIds.size} communities`);

      // Step 3: Load community definitions using efficient batch query
      const communityIdArray = Array.from(communityIds);

      if (communityIdArray.length === 0) {
        logger.log('Communities: No community IDs to query');
        return [];
      }

      logger.log(`Communities: Querying for ${communityIdArray.length} community definitions in single batch...`);

      // Query all community definitions in a single batch for efficiency
      const communityDefinitions = await nostr.query([{
        kinds: [34550],
        '#d': communityIdArray, // Query specific community IDs
        // No limit needed since we're querying specific IDs
      }], {
        signal: AbortSignal.timeout(15000)
      });

      logger.log(`Communities: Found ${communityDefinitions.length} community definitions`);
      if (communityDefinitions.length === 0 && communityIdArray.length > 0) {
        logger.log('Communities: No community definitions found despite having membership records. This could mean:');
        logger.log('Communities: 1. Community definitions are on different relays');
        logger.log('Communities: 2. Community definitions have been deleted');
        logger.log('Communities: 3. Query filters are too restrictive');
      }
      // Step 4: Parse community definitions and combine with membership status
      const communitiesWithStatus = communityDefinitions.map(definition => {
        const communityId = definition.tags.find(([name]) => name === 'd')?.[1];
        const membershipInfo = membershipStatusMap.get(communityId!);

        // Parse community metadata from tags
        const name = definition.tags.find(([name]) => name === 'name')?.[1] || communityId!;
        const description = definition.tags.find(([name]) => name === 'description')?.[1];
        const image = definition.tags.find(([name]) => name === 'image')?.[1];
        const banner = definition.tags.find(([name]) => name === 'banner')?.[1];

        // Get moderators and relays
        const moderators = definition.tags
          .filter(([name, , , role]) => name === 'p' && role === 'moderator')
          .map(([, pubkey]) => pubkey);

        const relays = definition.tags
          .filter(([name]) => name === 'relay')
          .map(([, url]) => url);

        return {
          id: communityId!,
          pubkey: definition.pubkey,
          info: {
            name,
            description,
            image,
            banner,
            moderators,
            relays,
          },
          definitionEvent: definition,
          membershipStatus: membershipInfo!.status,
          membershipEvent: membershipInfo!.event,
        };
      });

      return communitiesWithStatus;
    } catch (error) {
      logger.error('Communities: Error loading communities:', error);
      return [];
    }
  }, [user?.pubkey, nostr]);

  // Load channels for a specific community (kind 32807) - DEPRECATED: Now using batch loading
  const _loadCommunityChannels = useCallback(async (communityId: string, communityPubkey: string): Promise<NostrEvent[]> => {
    logger.log(`Communities: Loading channels for community ${communityId}...`);

    try {
      const filters = [
        {
          kinds: [32807], // Channel definition events
          authors: [communityPubkey], // Channels created by community owner
          '#a': [`34550:${communityPubkey}:${communityId}`], // Reference to parent community
          limit: 50, // Reasonable limit for channels per community
        }
      ];

      const channelDefinitions = await nostr.query(filters, {
        signal: AbortSignal.timeout(15000)
      });

      logger.log(`Communities: Found ${channelDefinitions.length} channels for community ${communityId}`);
      return channelDefinitions;
    } catch (error) {
      logger.error(`Communities: Error loading channels for community ${communityId}:`, error);
      return [];
    }
  }, [nostr]);

  // Load permissions and members for a community/channel - DEPRECATED: Now using batch loading
  const _loadPermissionsAndMembers = useCallback(async (communityId: string, communityPubkey: string, channelId?: string) => {
    const results = {
      permissions: null as NostrEvent | null,
      members: null as NostrEvent | null,
    };

    try {
      // Load channel permissions if channelId provided
      if (channelId) {
        const permissionFilters = [
          {
            kinds: [30143], // Channel permissions events
            authors: [communityPubkey],
            '#d': [`${communityId}/${channelId}`], // Channel-specific permissions
            limit: 1,
          }
        ];

        logger.log(`Communities: Querying for channel permissions with filters:`, permissionFilters);
        const permissionSettings = await nostr.query(permissionFilters, {
          signal: AbortSignal.timeout(10000)
        });

        logger.log(`Communities: Found ${permissionSettings.length} permission events for channel ${channelId}`);
        if (permissionSettings.length > 0) {
          results.permissions = permissionSettings[0];
          logger.log(`Communities: Found permissions for channel ${channelId}`);
        }
      }

      // Load approved members for community
      // Note: kind 34551 events use the full community reference format
      const communityRef = `34550:${communityPubkey}:${communityId}`;
      const memberFilters = [
        {
          kinds: [34551], // Approved members events
          authors: [communityPubkey],
          '#d': [communityRef], // Community-specific members with full reference
          limit: 1,
        }
      ];

      logger.log(`Communities: Querying for approved members with filters:`, memberFilters);
      const memberLists = await nostr.query(memberFilters, {
        signal: AbortSignal.timeout(10000)
      });

      logger.log(`Communities: Found ${memberLists.length} approved member events for community ${communityId}`);
      if (memberLists.length > 0) {
        results.members = memberLists[0];
        logger.log(`Communities: Found approved members for community ${communityId}`);
      }

    } catch (error) {
      logger.error(`Communities: Error loading permissions/members for ${communityId}/${channelId}:`, error);
    }

    return results;
  }, [nostr]);

  // Load messages for all channels in all communities - DEPRECATED: Now using batch loading
  const _loadAllChannelMessages = useCallback(async (communitiesData: Map<string, { id: string; pubkey: string; channels: Map<string, { id: string }> }>) => {
    logger.log('Communities: Loading messages for all channels...');

    // Build filters for all community/channel combinations
    const filters: { kinds: number[]; '#a'?: string[]; '#t'?: string[]; limit: number }[] = [];

    communitiesData.forEach((community, communityId) => {
      const communityRef = `34550:${community.pubkey}:${communityId}`;

      community.channels.forEach((channel, channelId) => {
        if (channelId === 'general') {
          // For general channel, query both kinds
          filters.push({
            kinds: [1, 9411],
            '#a': [communityRef],
            limit: 20,
          });
        } else {
          // For specific channels, only query kind 9411
          filters.push({
            kinds: [9411],
            '#t': [channelId],
            '#a': [communityRef],
            limit: 20,
          });
        }
      });
    });

    if (filters.length === 0) {
      logger.log('Communities: No channels to load messages for');
      return new Map();
    }

    try {
      logger.log(`Communities: Querying messages with ${filters.length} filters...`);
      const channelMessages = await nostr.query(filters, {
        signal: AbortSignal.timeout(30000)
      });

      logger.log(`Communities: Found ${channelMessages.length} total messages`);

      // Organize messages by community/channel
      const messagesByChannel = new Map<string, NostrEvent[]>(); // key: "communityId/channelId"

      channelMessages.forEach(message => {
        // Extract community reference from #a tag
        const communityRef = message.tags.find(([name]) => name === 'a')?.[1];
        if (!communityRef) return;

        const [, , communityId] = communityRef.split(':');
        if (!communityId) return;

        // Determine channel ID
        let channelId = 'general'; // default
        if (message.kind === 9411) {
          // Look for #t tag for channel reference
          const channelRef = message.tags.find(([name]) => name === 't')?.[1];
          if (channelRef) channelId = channelRef;
        }

        const key = `${communityId}/${channelId}`;
        if (!messagesByChannel.has(key)) {
          messagesByChannel.set(key, []);
        }
        messagesByChannel.get(key)!.push(message);
      });

      // Sort messages in each channel by timestamp
      messagesByChannel.forEach(messages => {
        messages.sort((a, b) => a.created_at - b.created_at);
      });

      logger.log(`Communities: Organized messages into ${messagesByChannel.size} channels`);
      return messagesByChannel;

    } catch (error) {
      logger.error('Communities: Error loading channel messages:', error);
      return new Map();
    }
  }, [nostr]);

  // Main communities loading function
  const startCommunitiesLoading = useCallback(async () => {
    if (!user?.pubkey) {
      logger.log('Communities: No user pubkey available, skipping communities loading');
      return;
    }

    if (communitiesLoading) {
      logger.log('Communities: Loading already in progress, skipping duplicate request');
      return;
    }

    const startTime = Date.now();
    logger.log('Communities: Starting communities loading process');
    setCommunitiesLoading(true);
    setCommunitiesLoadingPhase(LOADING_PHASES.RELAYS);

    try {
      // Step 1: Load communities with membership status
      const step1Start = Date.now();
      const communitiesWithStatus = await loadUserCommunities();
      const step1Time = Date.now() - step1Start;

      if (communitiesWithStatus.length === 0) {
        logger.log('Communities: No communities found for user');
        const totalTime = Date.now() - startTime;
        setCommunitiesLoadTime(totalTime);
        setCommunitiesLoadBreakdown({
          communities: step1Time,
          channels: 0,
          permissions: 0,
          messages: 0,
          total: totalTime,
        });
        setHasCommunitiesInitialLoadCompleted(true);
        setCommunitiesLoading(false);
        setCommunitiesLoadingPhase(LOADING_PHASES.READY);
        return;
      }

      // Step 2: Load ALL channels for APPROVED communities only
      logger.log('Communities: Loading all channels for approved communities...');
      const step2Start = Date.now();

      // Filter to only approved communities first, then create channel filters
      const approvedCommunities = communitiesWithStatus.filter(({ membershipStatus }) => membershipStatus === 'approved');
      const allChannelFilters = approvedCommunities.map(({ definitionEvent }) => {
        const communityId = definitionEvent.tags.find(([name]) => name === 'd')?.[1];
        if (!communityId) return null;

        return {
          kinds: [32807], // Channel definitions
          authors: [definitionEvent.pubkey],
          '#a': [`34550:${definitionEvent.pubkey}:${communityId}`], // Reference to parent community
          limit: 50, // Max channels per community
        };
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null); // Remove null filters (missing communityId)

      const allChannelDefinitions = await nostr.query(allChannelFilters, {
        signal: AbortSignal.timeout(15000)
      });
      const step2Time = Date.now() - step2Start;
      logger.log(`Communities: Found ${allChannelDefinitions.length} total channel definitions in ${step2Time}ms`);

      // Step 3: Load ALL permissions and members at once
      logger.log('Communities: Loading all permissions and members...');
      const step3Start = Date.now();
      const allMemberFilters = communitiesWithStatus.map(({ definitionEvent }) => {
        const communityId = definitionEvent.tags.find(([name]) => name === 'd')?.[1];
        const communityRef = `34550:${definitionEvent.pubkey}:${communityId}`;
        return {
          kinds: [34551], // Approved members events
          authors: [definitionEvent.pubkey],
          '#d': [communityRef],
          limit: 1,
        };
      });

      const allPermissionFilters = allChannelDefinitions.map(channelDef => {
        const communityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
        const channelId = channelDef.tags.find(([name]) => name === 'd')?.[1];
        if (!communityRef || !channelId) return null;

        const [, communityPubkey, communityId] = communityRef.split(':');
        return {
          kinds: [30143], // Channel permissions events
          authors: [communityPubkey],
          '#d': [`${communityId}/${channelId}`],
          limit: 1,
        };
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null);

      const [allMemberLists, allPermissionSettings] = await Promise.all([
        nostr.query(allMemberFilters, { signal: AbortSignal.timeout(15000) }),
        allPermissionFilters.length > 0 ? nostr.query(allPermissionFilters, { signal: AbortSignal.timeout(15000) }) : Promise.resolve([])
      ]);
      const step3Time = Date.now() - step3Start;

      logger.log(`Communities: Found ${allMemberLists.length} member lists and ${allPermissionSettings.length} permission settings in ${step3Time}ms`);

      // Step 4: Load ALL channel messages at once
      logger.log('Communities: Loading all channel messages...');
      const step4Start = Date.now();
      const allMessageFilters = allChannelDefinitions.map(channelDef => {
        const communityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
        const channelId = channelDef.tags.find(([name]) => name === 'd')?.[1];
        if (!communityRef || !channelId) return null;

        // We don't need to extract communityPubkey and communityId since we use communityRef directly
        return {
          kinds: [9411], // Channel messages (no special case for "general")
          '#a': [communityRef],
          '#t': [channelId],
          limit: 20,
        };
      }).filter((filter): filter is NonNullable<typeof filter> => filter !== null);

      const allChannelMessages = allMessageFilters.length > 0
        ? await nostr.query(allMessageFilters, { signal: AbortSignal.timeout(15000) })
        : [];
      const step4Time = Date.now() - step4Start;

      logger.log(`Communities: Found ${allChannelMessages.length} total channel messages in ${step4Time}ms`);

      // Step 5: Build final communities state
      const newCommunitiesState = new Map<string, CommunityData>();

      for (const community of communitiesWithStatus) {
        const isApproved = community.membershipStatus === 'approved';
        const channelsMap = new Map<string, ChannelData>();

        // Only load channels/messages for approved communities
        if (isApproved) {
          // Find channels for this community
          const communityChannels = allChannelDefinitions.filter(channelDef => {
            const communityRef = channelDef.tags.find(([name]) => name === 'a')?.[1];
            return communityRef && communityRef.includes(`:${community.id}`);
          });

          for (const channelDef of communityChannels) {
            const channelId = channelDef.tags.find(([name]) => name === 'd')?.[1];
            if (!channelId) continue;

            // Find messages for this channel
            const channelMessages = allChannelMessages.filter(msg => {
              const msgCommunityRef = msg.tags.find(([name]) => name === 'a')?.[1];
              const msgChannelId = msg.tags.find(([name]) => name === 't')?.[1];
              return msgCommunityRef && msgCommunityRef.includes(`:${community.id}`) && msgChannelId === channelId;
            });

            // Find permissions for this channel
            const channelPermissions = allPermissionSettings.find(perm => {
              const permRef = perm.tags.find(([name]) => name === 'd')?.[1];
              return permRef === `${community.id}/${channelId}`;
            });

            channelsMap.set(channelId, {
              id: channelId,
              communityId: community.id,
              definition: channelDef,
              messages: channelMessages,
              permissions: channelPermissions || null,
              lastActivity: channelMessages.length > 0 ? channelMessages[channelMessages.length - 1].created_at : channelDef.created_at,
            });
          }
        }

        // Find member lists for this community
        const communityRef = `34550:${community.pubkey}:${community.id}`;
        const approvedMembers = allMemberLists.find(memberList => {
          const memberRef = memberList.tags.find(([name]) => name === 'd')?.[1];
          return memberRef === communityRef && memberList.kind === 34551;
        });
        const pendingMembers = allMemberLists.find(memberList => {
          const memberRef = memberList.tags.find(([name]) => name === 'd')?.[1];
          return memberRef === communityRef && memberList.kind === 34552;
        });

        const communityData: CommunityData = {
          id: community.id,
          pubkey: community.pubkey,
          info: community.info,
          definitionEvent: community.definitionEvent,
          channels: channelsMap,
          approvedMembers: approvedMembers || null,
          pendingMembers: pendingMembers || null,
          membershipStatus: community.membershipStatus,
          lastActivity: isApproved && channelsMap.size > 0
            ? Math.max(community.definitionEvent.created_at, ...Array.from(channelsMap.values()).map(c => c.lastActivity))
            : community.definitionEvent.created_at,
        };

        newCommunitiesState.set(community.id, communityData);
      }

      setCommunities(newCommunitiesState);

      const totalTime = Date.now() - startTime;
      setCommunitiesLoadTime(totalTime);
      setCommunitiesLoadBreakdown({
        communities: step1Time,
        channels: step2Time,
        permissions: step3Time,
        messages: step4Time,
        total: totalTime,
      });
      logger.log(`Communities: Successfully loaded ${newCommunitiesState.size} communities in ${totalTime}ms (communities: ${step1Time}ms, channels: ${step2Time}ms, permissions: ${step3Time}ms, messages: ${step4Time}ms)`);

      setHasCommunitiesInitialLoadCompleted(true);
      setCommunitiesLoadingPhase(LOADING_PHASES.READY);
    } catch (error) {
      logger.error('Communities: Error in communities loading:', error);
      const totalTime = Date.now() - startTime;
      setCommunitiesLoadTime(totalTime);
      setCommunitiesLoadingPhase(LOADING_PHASES.READY);
    } finally {
      setCommunitiesLoading(false);
    }
  }, [user?.pubkey, communitiesLoading, loadUserCommunities, nostr]);

  // Communities debug info
  const getCommunitiesDebugInfo = useCallback(() => {
    let totalChannels = 0;
    let totalMessages = 0;

    communities.forEach((community) => {
      totalChannels += community.channels.size;
      community.channels.forEach((channel) => {
        totalMessages += channel.messages.length;
      });
    });

    return {
      communityCount: communities.size,
      channelCount: totalChannels,
      messageCount: totalMessages,
    };
  }, [communities]);

  // Track whether communities initial load has completed
  const [hasCommunitiesInitialLoadCompleted, setHasCommunitiesInitialLoadCompleted] = useState(false);

  // Start communities loading when user is available
  useEffect(() => {
    if (!userPubkey) {
      logger.log('Communities: No user pubkey available, skipping communities loading');
      return;
    }

    if (hasCommunitiesInitialLoadCompleted) {
      logger.log('Communities: Initial load already completed, skipping duplicate request');
      return;
    }

    if (communitiesLoading) {
      logger.log('Communities: Communities loading already in progress');
      return;
    }

    logger.log('Communities: Starting communities loading for user');
    startCommunitiesLoading();
  }, [userPubkey, hasCommunitiesInitialLoadCompleted, communitiesLoading, startCommunitiesLoading]);

  // Cleanup subscriptions when component unmounts or user changes
  useEffect(() => {
    return () => {
      // Close all subscriptions on cleanup
      if (nip4SubscriptionRef.current) {
        nip4SubscriptionRef.current.close();
        logger.log('DMS: DataManager: Cleaned up NIP-4 subscription');
      }
      if (nip17SubscriptionRef.current) {
        nip17SubscriptionRef.current.close();
        logger.log('DMS: DataManager: Cleaned up NIP-17 subscription');
      }

      // Clear debounced write timeout
      if (debouncedWriteRef.current) {
        clearTimeout(debouncedWriteRef.current);
        logger.log('DMS: DataManager: Cleaned up debounced write timeout');
      }

      // Reset subscription status
      setSubscriptions({ nip4: false, nip17: false });
    };
  }, []);

  // Memoized conversation summary - now much simpler since messages are already organized by participant
  const conversations = useMemo(() => {
    const conversationsList: ConversationSummary[] = [];

    messages.forEach((participant, participantPubkey) => {
      if (!participant.messages.length) return;

      // Analyze messages to determine if user has sent any messages to this participant
      const userHasSentMessage = participant.messages.some(msg => msg.pubkey === user?.pubkey);
      const isKnown = userHasSentMessage; // User has sent at least one message
      const isRequest = !userHasSentMessage; // User hasn't sent any messages (only received)

      // Get the most recent message to determine who sent it
      const lastMessage = participant.messages[participant.messages.length - 1]; // Last in chronological order
      const isFromUser = lastMessage.pubkey === user?.pubkey;

      conversationsList.push({
        id: participantPubkey,
        pubkey: participantPubkey,
        lastMessage: participant.lastMessage,
        lastActivity: participant.lastActivity,
        hasNIP4Messages: participant.hasNIP4,
        hasNIP17Messages: participant.hasNIP17,
        isKnown: isKnown,
        isRequest: isRequest,
        lastMessageFromUser: isFromUser,
      });
    });

    return conversationsList.sort((a, b) => b.lastActivity - a.lastActivity);
  }, [messages, user?.pubkey]);

  const getDebugInfo = useCallback(() => {
    // Count total messages from all participants
    let totalMessageCount = 0;
    let nip4Count = 0;
    let nip17Count = 0;

    messages.forEach((participant) => {
      totalMessageCount += participant.messages.length;
      if (participant.hasNIP4) {
        const nip4Messages = participant.messages.filter((msg: DecryptedMessage) => msg.kind === 4);
        nip4Count += nip4Messages.length;
      }
      if (participant.hasNIP17) {
        const nip17Messages = participant.messages.filter((msg: DecryptedMessage) => msg.kind === 1059 || msg.kind === 14);
        nip17Count += nip17Messages.length;
      }
    });

    return {
      messageCount: totalMessageCount,
      nip4Count,
      nip17Count,
      nip4Sync: lastSync.nip4 ? new Date(lastSync.nip4 * 1000) : null,
      nip17Sync: lastSync.nip17 ? new Date(lastSync.nip17 * 1000) : null,
      nip17Enabled: settings.enableNIP17,
    };
  }, [messages, lastSync.nip4, lastSync.nip17, settings.enableNIP17]);

  // Debug method to write all current messages to IndexedDB
  const writeAllMessagesToStore = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for writing to store');
      return;
    }

    logger.log(`DMS: DataManager: writeAllMessagesToStore called with ${messages.size} participants`);

    try {
      const { writeMessagesToDB } = await import('@/lib/messageStore');

      // Convert current messages state to MessageStore format
      // Store the ORIGINAL encrypted messages, not decrypted content
      const messageStore = {
        participants: {} as Record<string, {
          messages: {
            id: string;
            pubkey: string;
            content: string; // This will be the ORIGINAL encrypted content
            created_at: number;
            kind: number;
            tags: string[][];
            sig: string;
            isOriginallyEncrypted?: boolean; // Flag to indicate if this was decrypted
            originalEncryptedContent?: string; // Store original encrypted content
          }[];
          lastActivity: number;
          hasNIP4: boolean;
          hasNIP17: boolean;
        }>,
        lastSync: {
          nip4: lastSync.nip4,
          nip17: lastSync.nip17,
        }
      };

      messages.forEach((participant, participantPubkey) => {
        messageStore.participants[participantPubkey] = {
          messages: participant.messages.map(msg => {
            // SECURITY: Store only the original encrypted content, not decrypted
            // Drop decryptedContent and error when saving to IndexedDB

            return {
              id: msg.id,
              pubkey: msg.pubkey,
              content: msg.content, // Keep original encrypted content
              created_at: msg.created_at,
              kind: msg.kind,
              tags: msg.tags,
              sig: msg.sig,
              // Drop decryptedContent and error when saving to IndexedDB
            } as NostrEvent;
          }),
          lastActivity: participant.lastActivity,
          hasNIP4: participant.hasNIP4,
          hasNIP17: participant.hasNIP17,
        };
      });

      logger.log(`DMS: DataManager: About to write ${Object.keys(messageStore.participants).length} participants to IndexedDB`);
      await writeMessagesToDB(userPubkey, messageStore);
      logger.log(`DMS: DataManager: writeMessagesToDB completed successfully`);

      // Update lastSync timestamps to current time after successful save
      const currentTime = Math.floor(Date.now() / 1000); // Convert to Unix timestamp
      setLastSync(prev => ({
        nip4: prev.nip4 || currentTime, // Keep existing if set, otherwise use current time
        nip17: prev.nip17 || currentTime
      }));

      logger.log(`DMS: DataManager: Successfully wrote message store to IndexedDB with ${Object.keys(messageStore.participants).length} participants. Updated lastSync timestamps.`);
    } catch (error) {
      logger.error('DMS: DataManager: Error writing messages to IndexedDB:', error);
    }
  }, [messages, userPubkey, lastSync]);


  // Trigger debounced write to IndexedDB
  const triggerDebouncedWrite = useCallback(() => {
    if (debouncedWriteRef.current) {
      clearTimeout(debouncedWriteRef.current);
    }
    debouncedWriteRef.current = setTimeout(() => {
      writeAllMessagesToStore();
      debouncedWriteRef.current = null;
    }, DATA_MANAGER_CONSTANTS.DEBOUNCED_WRITE_DELAY);
  }, [writeAllMessagesToStore]);

  // Watch messages state and handle debounced saves
  useEffect(() => {
    if (messages.size === 0) return; // Don't save empty state

    if (shouldSaveImmediately) {
      // Clear the flag and save immediately
      setShouldSaveImmediately(false);
      logger.log('DMS: DataManager: Triggering immediate save after relay message processing');
      writeAllMessagesToStore();
    } else {
      // Normal debounced save for real-time messages
      triggerDebouncedWrite();
    }
  }, [messages, shouldSaveImmediately, writeAllMessagesToStore, triggerDebouncedWrite]);



  // Debug method to reset all message data and cache for current user
  const resetMessageDataAndCache = useCallback(async () => {
    if (!userPubkey) {
      logger.error('DMS: DataManager: No user pubkey available for resetting data');
      return;
    }

    try {
      const { clearMessagesFromDB } = await import('@/lib/messageStore');
      await clearMessagesFromDB(userPubkey);

      // Clear local state
      setMessages(new Map());
      setLastSync({ nip4: null, nip17: null });
      setHasInitialLoadCompleted(false);

      logger.log('DMS: DataManager: Successfully reset message data and cache');
    } catch (error) {
      logger.error('DMS: DataManager: Error resetting message data and cache:', error);
    }
  }, [userPubkey]);

  // Derived state for cleaner loading logic
  const isDoingInitialLoad = isLoading && (loadingPhase === LOADING_PHASES.CACHE || loadingPhase === LOADING_PHASES.RELAYS);

  // Send message function with optimistic updates
  const sendMessage = useCallback(async (params: { recipientPubkey: string; content: string; protocol?: MessageProtocol }) => {
    const { recipientPubkey, content, protocol = MESSAGE_PROTOCOL.NIP04 } = params;
    if (!userPubkey) {
      logger.error('DMS: DataManager: Cannot send message, no user pubkey');
      return;
    }

    logger.log(`DMS: DataManager: Sending ${protocol} message to ${recipientPubkey}`);

    // Create optimistic message with consistent structure
    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMessage: DecryptedMessage = {
      id: optimisticId, // Temporary ID for optimistic message
      kind: protocol === MESSAGE_PROTOCOL.NIP04 ? 4 : 1059, // NIP-4 DM or NIP-17 Gift Wrap for display
      pubkey: userPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: '', // Empty encrypted content (will be filled when real message arrives)
      decryptedContent: content, // Plain text content for display
      sig: '',
      isSending: true, // Mark as optimistic
      clientFirstSeen: Date.now(), // Mark as just created for animation
    };

    // Add to messages state using reusable method
    addMessageToState(optimisticMessage, recipientPubkey, protocol === MESSAGE_PROTOCOL.NIP04 ? MESSAGE_PROTOCOL.NIP04 : MESSAGE_PROTOCOL.NIP17);

    try {
      // Use the existing working send functions
      if (protocol === MESSAGE_PROTOCOL.NIP04) {
        await sendNIP4Message.mutateAsync({
          recipientPubkey,
          content,
        });
      } else if (protocol === MESSAGE_PROTOCOL.NIP17) {
        await sendNIP17Message.mutateAsync({
          recipientPubkey,
          content,
        });
      }

      logger.log(`DMS: DataManager: Successfully sent ${protocol} message to ${recipientPubkey}`);
    } catch (error) {
      logger.error(`DMS: DataManager: Failed to send ${protocol} message to ${recipientPubkey}:`, error);
    }
  }, [userPubkey, addMessageToState, sendNIP4Message, sendNIP17Message]);

  // Organize messaging functionality into its own domain
  const messaging: MessagingDomain = {
    messages,
    isLoading,
    loadingPhase,
    isDoingInitialLoad,
    lastSync,
    conversations,
    getDebugInfo,
    writeAllMessagesToStore,
    resetMessageDataAndCache,
    handleNIP17SettingChange,
    sendMessage,
    isNIP17Enabled: settings.enableNIP17,
    isDebugging: true, // Hardcoded for now
    scanProgress,
    subscriptions,
  };

  // Organize communities functionality into its own domain
  const communitiesDomain: CommunitiesDomain = {
    communities,
    isLoading: communitiesLoading,
    loadingPhase: communitiesLoadingPhase,
    loadTime: communitiesLoadTime,
    loadBreakdown: communitiesLoadBreakdown,
    getDebugInfo: getCommunitiesDebugInfo,
  };

  const contextValue: DataManagerContextType = {
    messaging,
    communities: communitiesDomain,
  };

  return (
    <DataManagerContext.Provider value={contextValue}>
      {children}
    </DataManagerContext.Provider>
  );
}
