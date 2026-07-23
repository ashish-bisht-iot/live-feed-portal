// Basic sanitizer for anything coming off the socket before we render it.
// We never use dangerouslySetInnerHTML anywhere, so React is already
// escaping text nodes for us — but the payload can still carry things
// like <script> tags or event-handler strings that look scary in the
// DevTools console or in a future refactor, so we strip tag-looking
// characters here as a second layer of defense.
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

// Whitespace-only / empty check used to gate the send button.
export function isBlank(input) {
  return !input || !input.trim().length;
}
