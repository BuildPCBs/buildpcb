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
  isEditing?: boolean;
}

interface AIChatContextType {
  messages: ChatMessage[];
  isThinking: boolean;
  currentMessageIndex: number;
  addMessage: (message: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsThinking: (thinking: boolean) => void;
  setCurrentMessageIndex: (index: number) => void;
  handlePromptSubmit: (
    prompt: string,
    canvasState?: any,
    canvas?: any
  ) => Promise<void>;
  startEditingMessage: (messageId: string) => void;
  saveEditedMessage: (messageId: string, newContent: string) => void;
  cancelEditingMessage: (messageId: string) => void;
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
  const { getToken, isAuthenticated } = useAuth();
  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const handlePromptSubmit = async (
    prompt: string,
    canvasState?: any,
    canvas?: any
  ) => {
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
          Authorization: `Bearer ${token}`,
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

      // Debug logging
      console.log("🤖 Raw AI API response:", aiResponseData);
      console.log("📊 Response mode:", aiResponseData.mode);
      console.log("📦 Has circuit:", !!aiResponseData.circuit);
      console.log("📝 Has text response:", !!aiResponseData.textResponse);
      console.log("📋 Metadata:", aiResponseData.metadata);

      // Simulate parsing delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Import circuit response parser
      const { parseCircuitResponse, applyCircuitToCanvas } = await import(
        "../lib/circuitResponseParser"
      );

      // Parse the circuit response
      const parsedResponse = parseCircuitResponse(aiResponseData);

      console.log("🔧 Parsed response result:", parsedResponse);
      console.log("✅ Is valid:", parsedResponse.isValid);
      console.log("📋 Operations to apply:", parsedResponse.operations.length);
      console.log("❌ Errors:", parsedResponse.errors);

      // Apply circuit changes to canvas if we have a canvas
      let circuitApplicationResult = null;
      console.log("🔍 Starting canvas application check...");
      console.log("📊 Parsed response operations:", parsedResponse.operations.length);
      console.log("✅ Response valid:", parsedResponse.isValid);
      console.log("🎨 Canvas object exists:", !!canvas);

      if (
        parsedResponse.isValid &&
        parsedResponse.operations.length > 0 &&
        canvas
      ) {
        console.log("🎨 Canvas object received:", !!canvas);
        console.log("🎨 Canvas type:", canvas?.constructor?.name);
        console.log("🎨 Canvas ready state:", canvas ? "Ready" : "Not ready");
        console.log("📋 Operations to apply:", parsedResponse.operations);

        // Check if canvas is actually ready to use
        if (canvas && typeof canvas.add === 'function' && typeof canvas.renderAll === 'function') {
          console.log("✅ Canvas is fully initialized and ready to use");

          // Add a small delay to ensure canvas is fully ready
          await new Promise(resolve => setTimeout(resolve, 100));

          try {
            console.log("🚀 Calling applyCircuitToCanvas...");
            circuitApplicationResult = await applyCircuitToCanvas(
              parsedResponse,
              canvas
            );
            console.log(
              "✅ Circuit changes applied to canvas:",
              circuitApplicationResult
            );
          } catch (applyError) {
            console.error("❌ Failed to apply circuit changes:", applyError);
            console.error("❌ Error details:", {
              message: applyError instanceof Error ? applyError.message : 'Unknown error',
              stack: applyError instanceof Error ? applyError.stack : 'No stack trace',
              canvas: !!canvas,
              operations: parsedResponse.operations.length
            });
          }
        } else {
          console.log("⚠️ Canvas is not fully initialized yet, skipping application");
          console.log("Canvas methods check:", {
            hasAdd: typeof canvas?.add === 'function',
            hasRenderAll: typeof canvas?.renderAll === 'function'
          });
        }
      } else {
        console.log("⚠️ Skipping canvas application:");
        console.log("  - Response valid:", parsedResponse.isValid);
        console.log("  - Operations count:", parsedResponse.operations.length);
        console.log("  - Canvas available:", !!canvas);
        if (!parsedResponse.isValid) {
          console.log("  - Validation errors:", parsedResponse.errors);
        }
      }

      // Update with final response
      const finalContent =
        aiResponseData.textResponse ||
        aiResponseData.metadata?.explanation ||
        parsedResponse.explanation ||
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
                circuitApplication: circuitApplicationResult,
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

  const startEditingMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isEditing: true } : msg
      )
    );
  };

  const saveEditedMessage = (messageId: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: newContent, isEditing: false }
          : msg
      )
    );
  };

  const cancelEditingMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isEditing: false } : msg
      )
    );
  };

  const value: AIChatContextType = {
    messages,
    isThinking,
    currentMessageIndex,
    addMessage,
    setMessages,
    setIsThinking,
    setCurrentMessageIndex,
    handlePromptSubmit,
    startEditingMessage,
    saveEditedMessage,
    cancelEditingMessage,
  };

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
}
