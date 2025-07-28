import { useState, useEffect } from "react";

/**
 * Hook for managing loading states
 */
export function useLoading(initialState: boolean = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [message, setMessage] = useState<string>("");

  const startLoading = (loadingMessage?: string) => {
    setIsLoading(true);
    if (loadingMessage) setMessage(loadingMessage);
  };

  const stopLoading = () => {
    setIsLoading(false);
    setMessage("");
  };

  return {
    isLoading,
    message,
    startLoading,
    stopLoading,
  };
}
