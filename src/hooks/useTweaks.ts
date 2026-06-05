import { useState, useCallback } from 'react';

export function useTweaks<T extends Record<string, unknown>>(defaults: T) {
  const [values, setValues] = useState<T>(defaults);

  const setTweak = useCallback(
    (keyOrEdits: Partial<T> | keyof T, val?: T[keyof T]) => {
      const edits: Partial<T> =
        typeof keyOrEdits === 'object' && keyOrEdits !== null
          ? (keyOrEdits as Partial<T>)
          : ({ [keyOrEdits]: val } as Partial<T>);
      setValues((prev) => ({ ...prev, ...edits }));
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    },
    [],
  );

  return [values, setTweak] as const;
}
