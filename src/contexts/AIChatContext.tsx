"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useAuth } from "../hooks/useAuth";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  circuitChanges?: any[];
  status?: "sending" | "receiving" | "parsing" | "complete" | "error";
}

interface AIChatContextType {
  messages: ChatMessage[];
  isThinking: boolean;
  currentMessageIndex: number;
  addMessage: (message: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsThinking: (thinking: boolean) => void;
  setCurrentMessageIndex: (index: number) => void;
  handlePromptSubmit: (prompt: string, canvasState?: any) => Promise<void>;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error("useAIChat must be used within an AIChatProvider");
  }
  return context;
}

interface AIChatProviderProps {
  children: ReactNode;
  onCircuitUpdate?: (changes: any) => void;
}

export function AIChatProvider({
  children,
  onCircuitUpdate,
}: AIChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  
  // Get auth token for API calls
  const { getToken, isAuthenticated } = useAuth();  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handlePromptSubmit = async (prompt: string, canvasState?: any) => {
    if (!prompt.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: prompt,
      timestamp: new Date(),
      status: "complete",
    };

    addMessage(userMessage);
    setIsThinking(true);

    // Add placeholder AI message for receiving state
    const aiMessageId = `ai-${Date.now()}`;
    const receivingMessage: ChatMessage = {
      id: aiMessageId,
      type: "assistant",
      content: "Thinking...",
      timestamp: new Date(),
      status: "receiving",
    };

    addMessage(receivingMessage);

    try {
      // Check authentication
      if (!isAuthenticated) {
        throw new Error("Authentication required");
      }

      // Get auth token
      const token = await getToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }

      // Call our AI Agent API with authentication
      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: prompt,
          canvasState: canvasState || null, // Use passed canvas state or null
          conversationHistory: messages,
          sessionId: "main-session",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Update to parsing state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "Processing your request...",
                status: "parsing" as const,
              }
            : msg
        )
      );

      const aiResponseData = await response.json();

      // Simulate parsing delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update with final response
      const finalContent =
        aiResponseData.textResponse ||
        aiResponseData.metadata?.explanation ||
        "I've processed your request.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: finalContent,
                status: "complete" as const,
                circuitChanges: aiResponseData.circuit
                  ? [aiResponseData.circuit]
                  : [],
              }
            : msg
        )
      );

      // If there are circuit changes, notify parent component
      if (aiResponseData.circuit && onCircuitUpdate) {
        onCircuitUpdate(aiResponseData.circuit);
      }

      setIsThinking(false);
    } catch (error) {
      console.error("AI request failed:", error);

      // Update with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `Sorry, I encountered an error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }. Please try again.`,
                status: "error" as const,
              }
            : msg
        )
      );

      setIsThinking(false);
    }
  };

  // Update current message index when new messages are added
  useEffect(() => {
    if (messages.length > 0) {
      setCurrentMessageIndex(messages.length - 1);
    }
  }, [messages.length]);

  const value: AIChatContextType = {
    messages,
    isThinking,
    currentMessageIndex,
    addMessage,
    setMessages,
    setIsThinking,
    setCurrentMessageIndex,
    handlePromptSubmit,
  };

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
}
