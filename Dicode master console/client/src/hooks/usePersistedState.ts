import { useCallback, useEffect, useState } from "react";

const isBrowser = typeof window !== "undefined";

const readFromStorage = <T>(key: string, fallback: T): T => {
  if (!isBrowser) return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored == null) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
};

const writeToStorage = <T>(key: string, value: T) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const usePersistedState = <T>(key: string, initialValue: T) => {
  const [state, setState] = useState<T>(() => readFromStorage(key, initialValue));

  useEffect(() => {
    writeToStorage(key, state);
  }, [key, state]);

  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const nextValue = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        writeToStorage(key, nextValue);
        return nextValue;
      });
    },
    [key],
  );

  return [state, setPersistedState] as const;
};

export default usePersistedState;

