# Live Feed Portal

A real-time communication portal built with React and native WebSockets — persistent connection, automatic reconnection with exponential backoff, and full edge-case handling for flaky networks.

**Live:** https://live-feed-portal.vercel.app
**Repo:** https://github.com/ashish-bisht-iot/live-feed-portal

## Features

- Persistent WebSocket connection established on load
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s, capped at 10s) if the connection drops
- Connection status indicator (Connecting / Connected / Disconnected)
- Non-blocking "Connection lost, reconnecting…" banner
- Auto-scroll on new messages, but only if the user is already at the bottom of the feed
- Empty state and loading state for the message feed
- Input is disabled and Send is blocked while whitespace-only or disconnected
- Accessible: `role="log"` + `aria-live="polite"` on the feed, labeled input/button, keyboard navigable, respects `prefers-reduced-motion`
- Input sanitized before rendering — no `dangerouslySetInnerHTML` anywhere
- Simulated analytics hook (`useAnalytics`) logging key user actions to the console

## Tech Stack

React 18, native WebSocket API, Vite, plain CSS.

## Local Setup

```bash
npm install
npm run dev
```

## Notes

- Uses the public echo server at `wss://echo.websocket.org` (the current Ably-run endpoint) as the WebSocket backend for this POC — sent messages are echoed straight back.
- Deployed on Vercel with auto-deploy on push to `main`.