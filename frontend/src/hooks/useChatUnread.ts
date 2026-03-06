import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { chatApi } from "@/services/api";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polling leve para contagem global de mensagens não lidas.
 * Não ativa para o tenant "system" (admin mestre).
 */
export function useChatUnread(): { unread: number; refresh: () => void } {
  const { user, tenant } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user || !tenant || tenant.slug === "system") {
      setUnread(0);
      return;
    }
    try {
      const data = await chatApi.unreadCount();
      setUnread(data.unread);
    } catch {
      // silencioso — não bloquear UI por falha de polling
    }
  }, [user, tenant]);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchCount]);

  return { unread, refresh: fetchCount };
}
