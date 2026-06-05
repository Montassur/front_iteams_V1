import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { loadSession } from '../utils/session';
import type { MessageDto } from '../types/chat';

interface UseStompChatOptions {
  activeConversationId: number | null;
  onMessage: (msg: MessageDto) => void;
  onUnreadUpdate?: () => void;
}

export function useStompChat({ activeConversationId, onMessage, onUnreadUpdate }: UseStompChatOptions) {
  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Keep latest callbacks in refs so the STOMP handlers never capture stale closures
  const onMessageRef = useRef(onMessage);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onUnreadUpdateRef.current = onUnreadUpdate; }, [onUnreadUpdate]);

  // Keep latest active conversation ID in a ref so subscribe() always uses current value
  const activeConvIdRef = useRef(activeConversationId);
  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);

  const subscribe = useCallback((client: Client) => {
    // Always tear down the previous subscription before creating a new one
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    const convId = activeConvIdRef.current;
    if (convId == null) return;
    subscriptionRef.current = client.subscribe(
      `/topic/conversation/${convId}`,
      (frame) => {
        const msg = JSON.parse(frame.body) as MessageDto;
        onMessageRef.current(msg);
        onUnreadUpdateRef.current?.();
      }
    );
  }, []);

  // Create the STOMP client once on mount
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL as string),
      connectHeaders: { Authorization: `Bearer ${loadSession()?.token ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        onUnreadUpdateRef.current?.();
        subscribe(client);
      },
    });
    client.activate();
    clientRef.current = client;
    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      client.deactivate();
    };
  }, [subscribe]);

  // Re-subscribe when the active conversation changes (client already connected)
  useEffect(() => {
    const client = clientRef.current;
    if (client?.connected) {
      subscribe(client);
    }
    // cleanup handled inside subscribe() on the next call
  }, [activeConversationId, subscribe]);

  const sendMessage = useCallback((conversationId: number, content: string) => {
    const client = clientRef.current;
    if (!client?.connected) return;
    client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ conversationId, content }),
    });
  }, []);

  return { sendMessage };
}
