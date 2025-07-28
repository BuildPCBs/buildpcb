import { useState, useCallback } from "react";
import type { ErrorState } from "@/types";

/**
 * Hook for managing error states
 */
export function useError() {
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
  });

  const setError = useCallback((error: Error | string, message?: string) => {
    setErrorState({
      hasError: true,
      error: typeof error === "string" ? new Error(error) : error,
      message: message || (typeof error === "string" ? error : error.message),
    });
  }, []);

  const clearError = useCallback(() => {
    setErrorState({ hasError: false });
  }, []);

  const retryWithErrorHandling = useCallback(
    async (fn: () => Promise<void> | void) => {
      try {
        clearError();
        await fn();
      } catch (error) {
        setError(error as Error);
      }
    },
    [setError, clearError]
  );

  return {
    ...errorState,
    setError,
    clearError,
    retryWithErrorHandling,
  };
}
