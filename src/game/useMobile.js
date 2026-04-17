import { useState, useEffect } from 'react';

export const isMobileDevice = () =>
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Returns stable bool — only re-evaluates on mount
export function useMobile() {
  const [mobile] = useState(() => isMobileDevice());
  return mobile;
}
