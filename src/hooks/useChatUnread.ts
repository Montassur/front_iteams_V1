import { useState, useEffect, useCallback } from 'react';
import { getConversations } from '../api/chat';
import { loadSession } from '../utils/session';

export function useChatUnread() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!loadSession()?.token) return;
    try {
      const convs = await getConversations();
      setUnreadCount(convs.reduce((sum, c) => sum + c.unreadCount, 0));
    } catch {
      // ignore — user may be on chat page with no conversations yet
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { unreadCount, refresh };
}
