import { useEffect, useRef, useState, useCallback } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { sanitizeText, isBlank } from '../utils/sanitize';
import './LiveFeedEngine.css';

const SOCKET_URL = 'wss://echo.websocket.org';
const MAX_BACKOFF_MS = 10000;
const BASE_BACKOFF_MS = 1000;

let idCounter = 0;
const nextId = () => `msg-${Date.now()}-${idCounter++}`;

export default function LiveFeedEngine() {
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
  const [messageLog, setMessageLog] = useState([]);
  const [draft, setDraft] = useState('');
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);

  const wsRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const feedEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const manualCloseRef = useRef(false);

  const { track } = useAnalytics();

  // connect/scheduleReconnect call each other, so a plain useCallback pair
  // would need one to close over the other before it exists. Keeping a ref
  // to "connect" sidesteps the chicken-and-egg dependency problem.
  const connectRef = useRef(null);

  const scheduleReconnect = useCallback(() => {
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    reconnectAttemptRef.current = attempt + 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current?.();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    setConnectionStatus((prev) => (prev === 'CONNECTED' ? prev : 'CONNECTING'));

    const ws = new WebSocket(SOCKET_URL);
    wsRef.current = ws;

    // Every handler below checks `wsRef.current === ws` first. Without this,
    // a socket that StrictMode's double-effect discarded (or any other
    // superseded connection) can still fire its close/error events *after*
    // a newer socket has taken over — and unconditionally nulling wsRef or
    // triggering a reconnect from a stale event was causing the UI to get
    // stuck flipping between Connecting/Disconnected even while the real
    // connection was fine.
    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setConnectionStatus('CONNECTED');
      setShowReconnectBanner(false);
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const raw = typeof event.data === 'string' ? event.data : '';

      // The server sends a one-off "Request served by <instance-id>" frame
      // on connect to identify which backend handled the request. It's
      // infra diagnostics, not a chat message, so don't show it in the feed.
      if (raw.startsWith('Request served by')) return;

      const clean = sanitizeText(raw);
      if (!clean) return;

      setMessageLog((prev) => [
        ...prev,
        { id: nextId(), text: clean, sender: 'them', ts: Date.now() },
      ]);
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      // Don't throw — just let onclose handle the reconnect flow.
      // Logging so we can still see it while debugging locally.
      console.error('[LiveFeedEngine] WebSocket error');
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // a newer socket already took over
      wsRef.current = null;
      if (manualCloseRef.current) return; // unmounting, not a real drop

      setConnectionStatus('DISCONNECTED');
      setShowReconnectBanner(true);
      scheduleReconnect();
    };
  }, [scheduleReconnect]);

  connectRef.current = connect;

  useEffect(() => {
    manualCloseRef.current = false;
    connectRef.current?.();

    return () => {
      manualCloseRef.current = true;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Auto-scroll only if the user was already at the bottom — otherwise
  // leave their scroll position alone while they're reading history.
  useEffect(() => {
    if (isAtBottomRef.current) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageLog]);

  const handleFeedScroll = () => {
    const el = feedContainerRef.current;
    if (!el) return;
    const threshold = 48;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const handleSend = () => {
    if (isBlank(draft) || connectionStatus !== 'CONNECTED') return;

    const clean = sanitizeText(draft);
    wsRef.current?.send(clean);

    setMessageLog((prev) => [
      ...prev,
      { id: nextId(), text: clean, sender: 'me', ts: Date.now() },
    ]);
    track('User emitted payload', { length: clean.length });
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sendDisabled = isBlank(draft) || connectionStatus !== 'CONNECTED';

  return (
    <div className="lfe-shell">
      <header className="lfe-header">
        <h1 className="lfe-title">Communication Portal</h1>
        <StatusPill status={connectionStatus} />
      </header>

      {showReconnectBanner && (
        <div className="lfe-banner" role="status">
          Connection lost. Attempting to reconnect…
        </div>
      )}

      <div
        className="lfe-feed"
        role="log"
        aria-live="polite"
        aria-label="Message feed"
        ref={feedContainerRef}
        onScroll={handleFeedScroll}
      >
        {connectionStatus === 'CONNECTING' && messageLog.length === 0 && (
          <LoadingState />
        )}

        {connectionStatus !== 'CONNECTING' && messageLog.length === 0 && (
          <EmptyState />
        )}

        {messageLog.map((msg) => (
          <div key={msg.id} className={`lfe-message lfe-message--${msg.sender}`}>
            <span className="lfe-message-text">{msg.text}</span>
          </div>
        ))}
        <div ref={feedEndRef} />
      </div>

      <form
        className="lfe-composer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <label htmlFor="composer-input" className="lfe-visually-hidden">
          Message
        </label>
        <input
          id="composer-input"
          type="text"
          className="lfe-input"
          placeholder={
            connectionStatus === 'CONNECTED'
              ? 'Type a message…'
              : 'Waiting for connection…'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={connectionStatus !== 'CONNECTED'}
          aria-label="Message input"
        />
        <button
          type="submit"
          className="lfe-send-btn"
          disabled={sendDisabled}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function StatusPill({ status }) {
  const label = {
    CONNECTING: 'Connecting',
    CONNECTED: 'Connected',
    DISCONNECTED: 'Disconnected',
  }[status];

  return (
    <span
      className={`lfe-status-pill lfe-status-pill--${status.toLowerCase()}`}
      role="status"
      aria-label={`Connection status: ${label}`}
    >
      <span className="lfe-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="lfe-placeholder">
      <div className="lfe-spinner" aria-hidden="true" />
      <p>Connecting to the live feed…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="lfe-placeholder">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden="true"
      >
        <rect x="6" y="12" width="44" height="30" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M6 16L28 32L50 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>No messages yet</p>
      <span className="lfe-placeholder-sub">New activity will show up here as it happens.</span>
    </div>
  );
}
