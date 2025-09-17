"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
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
      console.log("🎯 AIChatContext received chatDataRestored event:", {
        hasEvent: !!event,
        hasDetail: !!event.detail,
        hasChatData: !!event.detail?.chatData,
        chatDataKeys: event.detail?.chatData
          ? Object.keys(event.detail.chatData)
          : [],
        messageCount: event.detail?.chatData?.messages?.length || 0,
      });

      const { chatData } = event.detail;
      if (chatData && chatData.messages && chatData.messages.length > 0) {
        console.log(
          "💬 Loading saved chat messages:",
          chatData.messages.length
        );

        // Convert timestamp strings back to Date objects and ensure proper message structure
        const restoredMessages = chatData.messages.map((msg: any) => ({
          id: msg.id || `restored-${Date.now()}-${Math.random()}`,
          type: msg.type || "assistant",
          content: msg.content || "",
          timestamp:
            msg.timestamp instanceof Date
              ? msg.timestamp
              : new Date(msg.timestamp),
          circuitChanges: msg.circuitChanges || undefined,
          status: msg.status || "complete",
          isEditing: false, // Never restore in editing state
        }));

        console.log("✅ Restoring chat messages:", {
          restoredCount: restoredMessages.length,
          firstMessage: restoredMessages[0]?.content?.substring(0, 50) + "...",
          lastMessage:
            restoredMessages[restoredMessages.length - 1]?.content?.substring(
              0,
              50
            ) + "...",
        });

        setMessages(restoredMessages);
        console.log("✅ Chat messages restored successfully");
      } else {
        console.log("⚠️ No valid chat data in restoration event");
      }
    };

    // Add a manual trigger for testing (can be removed later)
    const handleManualRestore = () => {
      console.log("🔧 Manual chat restore triggered");
      // This can be called from browser console for testing
      window.dispatchEvent(
        new CustomEvent("chatDataRestored", {
          detail: {
            chatData: {
              messages: [
                {
                  id: "test-1",
                  type: "user",
                  content: "Test message",
                  timestamp: new Date().toISOString(),
                  status: "complete",
                },
              ],
            },
          },
        })
      );
    };

    // Expose for testing
    (window as any).manualChatRestore = handleManualRestore;

    // Add debugging function to check current messages
    (window as any).checkChatMessages = () => {
      console.log("📝 Current chat messages:", {
        messageCount: messages.length,
        messages: messages.map((msg, index) => ({
          index,
          id: msg.id,
          type: msg.type,
          content: msg.content.substring(0, 50) + "...",
          timestamp: msg.timestamp,
          status: msg.status,
        })),
      });
      return messages;
    };

    // Add function to test restoration status
    (window as any).testChatRestorationStatus = () => {
      console.log("🧪 Chat restoration status:", {
        messageCount: messages.length,
        isThinking,
        currentMessageIndex,
        hasMessages: messages.length > 0,
        lastMessage:
          messages.length > 0
            ? {
                type: messages[messages.length - 1].type,
                content:
                  messages[messages.length - 1].content.substring(0, 50) +
                  "...",
                timestamp: messages[messages.length - 1].timestamp,
              }
            : null,
      });
      return {
        messageCount: messages.length,
        isThinking,
        currentMessageIndex,
        hasMessages: messages.length > 0,
      };
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
  }, [messages, isThinking, currentMessageIndex]);
  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => {
      const newMessages = [...prev, message];
      console.log("➕ Message added to chat:", {
        messageType: message.type,
        messageContent: message.content.substring(0, 50) + "...",
        totalMessages: newMessages.length,
      });
      return newMessages;
    });
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
      let accumulatedContent = "";
      let buffer = "";

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
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6); // Remove 'data: ' prefix

              if (data === "[DONE]") {
                console.log("🎯 Streaming finished with [DONE]");
                break;
              }

              try {
                const chunkData = JSON.parse(data);
                console.log("📦 Received chunk:", chunkData);

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
                          status: chunkData.isComplete
                            ? "complete"
                            : "receiving",
                        }
                      : msg
                  )
                );

                // If we have a complete response, process it
                if (chunkData.isComplete && chunkData.accumulatedContent) {
                  console.log("🎯 Complete response received, processing...");

                  try {
                    const finalResponse = JSON.parse(
                      chunkData.accumulatedContent
                    );

                    // Import circuit response parser
                    const { parseCircuitResponse, applyCircuitToCanvas } =
                      await import("../lib/circuitResponseParser");

                    // Parse the circuit response
                    const parsedResponse = parseCircuitResponse(finalResponse);

                    console.log(
                      "🔧 Parsed streaming response result:",
                      parsedResponse
                    );

                    // Apply circuit changes if any
                    if (
                      parsedResponse.isValid &&
                      parsedResponse.operations.length > 0 &&
                      canvas
                    ) {
                      console.log("🔧 Applying circuit changes to canvas...");
                      await applyCircuitToCanvas(parsedResponse, canvas);
                    }

                    // Update message with final content and status
                    setMessages((prev) => {
                      const updatedMessages = prev.map((msg) =>
                        msg.id === aiMessageId
                          ? {
                              ...msg,
                              content:
                                // For text-only mode, prioritize the actual text response over explanation
                                (finalResponse.mode === "text-only" && finalResponse.textResponse) ||
                                accumulatedContent ||
                                finalResponse.metadata?.explanation ||
                                "Response received",
                              status: "complete" as const,
                              circuitChanges:
                                parsedResponse.operations.length > 0
                                  ? [parsedResponse]
                                  : undefined,
                            }
                          : msg
                      );

                      // Trigger a save after chat completion
                      console.log(
                        "💬 Chat message completed, triggering save in 3 seconds"
                      );
                      setTimeout(() => {
                        console.log(
                          "🚀 Dispatching chat save event with",
                          updatedMessages.length,
                          "messages"
                        );
                        window.dispatchEvent(
                          new CustomEvent("triggerChatSave", {
                            detail: {
                              messages: updatedMessages,
                              messageCount: updatedMessages.length,
                            },
                          })
                        );
                      }, 3000);

                      return updatedMessages;
                    });
                  } catch (parseError) {
                    console.error(
                      "❌ Error processing final response:",
                      parseError
                    );
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
              } catch (chunkError) {
                console.error("❌ Error parsing chunk:", chunkError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("❌ Error in handlePromptSubmit:", error);
      // Update the AI message with error status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: "Sorry, I encountered an error. Please try again.",
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

  // Add global test function for debugging
  useEffect(() => {
    (window as any).checkChatMessages = () => {
      console.log("💬 Current chat messages:", messages.length);
      messages.forEach((msg, index) => {
        console.log(`Message ${index + 1}:`, {
          type: msg.type,
          content: msg.content.substring(0, 50) + "...",
          timestamp: msg.timestamp,
          status: msg.status,
        });
      });
    };
  }, [messages]);

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
}
