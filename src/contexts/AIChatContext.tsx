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

  // Listen for chat data restoration events
  useEffect(() => {
    const handleChatDataRestored = (event: CustomEvent) => {
      const { chatData } = event.detail;
      if (chatData && chatData.messages) {
        console.log(
          "💬 Loading saved chat messages:",
          chatData.messages.length
        );

        // Convert timestamp strings back to Date objects
        const restoredMessages = chatData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));

        setMessages(restoredMessages);
        console.log("✅ Chat messages restored successfully");
      }
    };

    window.addEventListener(
      "chatDataRestored",
      handleChatDataRestored as EventListener
    );

    return () => {
      window.removeEventListener(
        "chatDataRestored",
        handleChatDataRestored as EventListener
      );
    };
  }, []);

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
      content: "",
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

      // Call our AI Agent API with streaming
      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: prompt,
          canvasState: canvasState || null,
          conversationHistory: messages,
          sessionId: "main-session",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      if (!reader) {
        throw new Error("No response body reader available");
      }

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("✅ Streaming complete");
            break;
          }

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove 'data: ' prefix

              if (data === '[DONE]') {
                console.log("🎯 Streaming finished with [DONE]");
                break;
              }

              try {
                const chunkData = JSON.parse(data);
                console.log("� Received chunk:", chunkData);

                // Accumulate content
                if (chunkData.content) {
                  accumulatedContent += chunkData.content;
                }

                // Update the message content in real-time
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          content: accumulatedContent,
                          status: chunkData.isComplete ? "complete" : "receiving",
                        }
                      : msg
                  )
                );

                // If we have a complete response, process it
                if (chunkData.isComplete && chunkData.accumulatedContent) {
                  console.log("🎯 Complete response received, processing...");

                  try {
                    const finalResponse = JSON.parse(chunkData.accumulatedContent);

                    // Import circuit response parser
                    const { parseCircuitResponse, applyCircuitToCanvas } = await import(
                      "../lib/circuitResponseParser"
                    );

                    // Parse the circuit response
                    const parsedResponse = parseCircuitResponse(finalResponse);

                    console.log("🔧 Parsed streaming response result:", parsedResponse);

                    // Apply circuit changes if any
                    if (parsedResponse.isValid && parsedResponse.operations.length > 0 && canvas) {
                      console.log("🔧 Applying circuit changes to canvas...");
                      await applyCircuitToCanvas(parsedResponse, canvas);
                    }

                    // Update message with final content and status
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? {
                              ...msg,
                              content: finalResponse.metadata?.explanation || accumulatedContent,
                              status: "complete",
                              circuitChanges: parsedResponse.operations.length > 0 ? [parsedResponse] : undefined,
                            }
                          : msg
                      )
                    );

                  } catch (parseError) {
                    console.error("❌ Error processing final response:", parseError);
                    // Update message with accumulated content as fallback
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? {
                              ...msg,
                              content: accumulatedContent,
                              status: "complete",
                            }
                          : msg
                      )
                    );
                  }
                }

              } catch (parseError) {
                console.error("❌ Error parsing chunk data:", parseError, "Raw data:", data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error("❌ Error in streaming:", error);

      // Update message with error status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "Sorry, I encountered an error while processing your request.",
                status: "error",
              }
            : msg
        )
      );
    } finally {
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
