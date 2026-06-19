"use client";

import { useCallback, useEffect, useState } from "react";

type GroveSession = {
  authenticated: boolean;
  walletAddress: string | null;
  token: string | null;
};

const emptySession: GroveSession = {
  authenticated: false,
  walletAddress: null,
  token: null,
};

let cachedSession: GroveSession = emptySession;
let sessionRequest: Promise<GroveSession> | null = null;

export const groveSessionChangedEvent = "grove:session-changed";

export function notifyGroveSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(groveSessionChangedEvent));
}

export function useGroveSession() {
  const [session, setSession] = useState<GroveSession>(cachedSession);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      sessionRequest ??= fetch("/api/auth/session", { cache: "no-store" })
        .then(async (response) => {
          const body = (await response.json()) as GroveSession;
          return {
            authenticated: Boolean(body.authenticated),
            walletAddress: body.walletAddress,
            token: body.token,
          };
        })
        .finally(() => {
          sessionRequest = null;
        });
      const nextSession = await sessionRequest;
      cachedSession = nextSession;
      setSession(nextSession);
      return nextSession;
    } catch {
      cachedSession = emptySession;
      setSession(emptySession);
      return emptySession;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    cachedSession = emptySession;
    setSession(emptySession);
    notifyGroveSessionChanged();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handleSessionChanged() {
      void refresh();
    }

    window.addEventListener(groveSessionChangedEvent, handleSessionChanged);
    return () => window.removeEventListener(groveSessionChangedEvent, handleSessionChanged);
  }, [refresh]);

  return {
    ...session,
    isLoading,
    refresh,
    clear,
  };
}
