import { useEffect, useRef } from 'react';

/**
 * Tracks which keys are held down.
 * Returns a ref so reading it in useFrame never causes re-renders.
 */
export function useControls() {
  const keys = useRef({});

  useEffect(() => {
    const down = e => { keys.current[e.code] = true; };
    const up   = e => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
    };
  }, []);

  return keys;
}
