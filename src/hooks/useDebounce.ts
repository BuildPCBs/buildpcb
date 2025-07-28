import { useState, useEffect, useRef } from "react";
import { debounce } from "@/lib/utils";

/**
 * Hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debounced callbacks
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const debouncedFn = useRef<T | undefined>();

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  if (!debouncedFn.current) {
    debouncedFn.current = debounce((...args: any[]) => {
      callbackRef.current(...args);
    }, delay) as T;
  }

  return debouncedFn.current;
}
