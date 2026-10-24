"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";

export type RealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

type TicketResponse = {
  ticket: string;
  wsUrl: string;
  expiresInSeconds: number;
};

/**
 * Subscribe to live site events over WebSocket. Falls back silently when the
 * realtime server is unavailable (SWR polling continues).
 */
export function useSiteRealtime(
  siteId: string | null,
  onEvent?: (event: { type: string; [key: string]: unknown }) => void,
) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!siteId) {
      setStatus("idle");
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    async function connect() {
      if (closed) return;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      try {
        const ticket = await apiFetch<TicketResponse>("/api/v1/realtime/ticket", {
          method: "POST",
          body: JSON.stringify({ siteId }),
        });
        if (closed) return;

        const url = `${ticket.wsUrl}?ticket=${encodeURIComponent(ticket.ticket)}&siteId=${encodeURIComponent(siteId!)}`;
        ws = new WebSocket(url);

        ws.onopen = () => {
          attempt = 0;
          setStatus("live");
          // Refresh ticket before expiry so reconnect stays authenticated
          refreshTimer = setTimeout(
            () => {
              try {
                ws?.close();
              } catch {
                // ignore
              }
            },
            Math.max(30_000, (ticket.expiresInSeconds - 20) * 1000),
          );
        };

        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as { type?: string };
            if (data.type === "welcome" || data.type === "pong") return;
            onEventRef.current?.(data as { type: string });
          } catch {
            // ignore malformed
          }
        };

        ws.onclose = () => {
          setStatus("reconnecting");
          scheduleReconnect();
        };

        ws.onerror = () => {
          // onclose will fire
        };
      } catch {
        setStatus("offline");
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (closed) return;
      attempt += 1;
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4));
      reconnectTimer = setTimeout(() => void connect(), delay);
    }

    void connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [siteId]);

  return { status };
}
