# Prompts.md — ENG-149204 (Real-Time Communication Portal)

This file documents my AI-assisted debugging sessions during this project.

## Bug 1 — stuck on "Disconnected"

First time I ran it locally (`npm run dev`), it never actually connected — sat on "Disconnected" with the reconnect banner looping. Sent Claude a screenshot. Turned out to be a real race condition: React StrictMode runs the mount effect twice in dev, and the `onclose` handler from the *first* (StrictMode-discarded) socket was firing after the second socket had already connected — nulling out the live connection reference and kicking off an unwanted reconnect. Fixed by tagging each socket instance and having every handler check it's still the current one before doing anything (`if (wsRef.current !== ws) return`).

## Bug 2 — still disconnected after the fix

Even after that fix it was still stuck. Turned out the actual issue was the WebSocket URL itself — the ticket's `wss://echo.websocket.events` is a stale endpoint. The original `echo.websocket.org` got shut down a while back, `.events` was a stopgap replacement, and Ably has since revived `echo.websocket.org` as the current maintained one. Swapped the URL and it connected immediately. Worth flagging in review in case anyone re-tests against the literal ticket URL and gets confused.

## Bug 3 — stray message on connect

Once it connected, the feed showed a message like "Request served by 4d896d95b55478" as if it were a real chat message — turned out to be a diagnostic frame the server sends on connect to identify which backend instance served the request. Added a filter so it doesn't show up in the feed.