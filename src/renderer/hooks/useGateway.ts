import { useState, useCallback } from 'react';

// Compat shim. The gateway WebSocket is gone and chat now lives in
// `useAgiChat`, which talks to /api/agi/chat directly via the AI SDK.
// This hook survives only because `isConnected` is destructured in several
// places; it always reports true once auth has stored a token.

interface AgiStatus {
  connected: boolean;
}

export function useGateway() {
  // The desktop has no separate gateway connection anymore. The hook stays
  // around so existing UI keeps compiling; `isConnected` reflects "we have
  // an HTTP client to talk to the web app", which is always true once the
  // auth handshake has stored a token.
  const [isConnected] = useState(true);
  const [status] = useState<AgiStatus>({ connected: true });
  const [error] = useState<string | null>(null);

  const connect = useCallback(async () => true, []);
  const disconnect = useCallback(async () => {}, []);
  const refreshStatus = useCallback(async () => {}, []);

  return {
    isConnected,
    isConnecting: false,
    status,
    error,
    connect,
    disconnect,
    refreshStatus,
    // Legacy field — kept so existing destructures don't break. Always
    // true now (there is no "indirect" mode anymore).
    useDirectApi: true,
  };
}
