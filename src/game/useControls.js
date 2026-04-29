import { useEffect, useRef } from 'react';

/**
 * Tracks which keys are held down.
 * Returns a ref so reading it in useFrame never causes re-renders.
 */
export function useControls() {
  const keys = useRef({});

  useEffect(() => {
    const down  = e => { keys.current[e.code] = true; };
    const up    = e => { keys.current[e.code] = false; };
    const clear = () => { keys.current = {}; };
    // Pointer lock release and window blur both stop delivering keyup events,
    // which leaves held keys stuck as true. Clear them so movement doesn't
    // ghost after restart or alt-tab.
    const onLockChange = () => { if (!document.pointerLockElement) clear(); };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    window.addEventListener('blur',    clear);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
      window.removeEventListener('blur',    clear);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, []);

  return keys;
}
