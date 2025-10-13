"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { logger } from "@/lib/logger";
import { useCanvas, SelectedComponent } from "./CanvasContext";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useProject } from "./ProjectContext";

export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  circuitChanges?: any[];
  status?: "sending" | "receiving" | "parsing" | "complete" | "error";
  isEditing?: boolean;
  isStreaming?: boolean; // NEW: indicates active streaming
  streamingStatus?: string; // NEW: current status message while streaming
  selectedComponents?: SelectedComponent[]; // Components that were selected when this message was sent
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
    canvas?: any,
    selectedComponents?: SelectedComponent[]
  ) => Promise<void>;
  startEditingMessage: (messageId: string) => void;
  saveEditedMessage: (messageId: string, newContent: string) => void;
  cancelEditingMessage: (messageId: string) => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

/**
 * Format stream messages with minimal emojis
 */
function formatStreamMessage(message: {
  type: string;
  message: string;
}): string {
  const prefix = {
    status: "→",
    think: "•",
    progress: "...",
    success: "✓",
    error: "✗",
    warn: "!",
  }[message.type] || "•";

  return `${prefix} ${message.message}`;
}


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
  const pendingRestoreConsumedRef = useRef(false);

  // Get auth token for API calls
  const { canvas } = useCanvas();
  const { currentProject } = useProject();
  const { getCurrentState } = useCanvasState({
    canvas,
    enableLiveUpdates: false,
  });

  // REMOVED: localStorage chat persistence (chat is saved in Supabase database instead)
  // This was causing cross-project contamination bugs

  // Clear messages when switching projects
  const previousProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentProjectId = currentProject?.id || null;

    // On first mount, just set the reference
    if (previousProjectIdRef.current === null && currentProjectId === null) {
      return; // Both null, skip
    }

    // If this is the first real project load, set it
    if (previousProjectIdRef.current === null && currentProjectId !== null) {
      previousProjectIdRef.current = currentProjectId;
      return;
    }

    // If project changed, clear messages (new project will load its own chat from database)
    if (previousProjectIdRef.current !== currentProjectId) {
      logger.component("🔄 Project changed - clearing chat", {
        from: previousProjectIdRef.current,
        to: currentProjectId,
      });

      setMessages([]);
      setIsThinking(false);
      setCurrentMessageIndex(-1);
      previousProjectIdRef.current = currentProjectId;
    }
  }, [currentProject?.id]);

  const restoreMessagesFromChatData = useCallback(
    (chatData?: { messages?: any[] }) => {
      if (!chatData?.messages || chatData.messages.length === 0) {
        logger.component("No chat messages to restore");
        return;
      }

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
        isEditing: false,
        selectedComponents: msg.selectedComponents || undefined, // Restore selected components
      }));

      logger.component("Restoring chat messages", {
        restoredCount: restoredMessages.length,
        firstMessagePreview:
          restoredMessages[0]?.content?.substring(0, 50) || "",
        lastMessagePreview:
          restoredMessages[restoredMessages.length - 1]?.content?.substring(
            0,
            50
          ) || "",
        messagesWithComponents: restoredMessages.filter(
          (msg) => msg.selectedComponents?.length > 0
        ).length,
        componentDetails: restoredMessages
          .filter((msg) => msg.selectedComponents?.length > 0)
          .map((msg) => ({
            id: msg.id,
            selectedComponents: msg.selectedComponents,
          })),
      });

      setMessages(restoredMessages);
      setCurrentMessageIndex(restoredMessages.length - 1);
      setIsThinking(false);

      if (typeof window !== "undefined") {
        delete (window as any).__buildpcbPendingChatData;
      }
    },
    []
  );

  // REMOVED: localStorage restoration and persistence useEffects
  // Chat is now only stored in Supabase database (project.chat_data)

  // Listen for chat data restoration events (from project load)
  useEffect(() => {
    const handleChatDataRestored = (event: CustomEvent) => {
      logger.component("chatDataRestored event received", {
        hasDetail: !!event.detail,
        hasChatData: !!event.detail?.chatData,
        messageCount: event.detail?.chatData?.messages?.length || 0,
      });

      restoreMessagesFromChatData(event.detail?.chatData);
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
  }, [messages, isThinking, currentMessageIndex, restoreMessagesFromChatData]);

  useEffect(() => {
    if (pendingRestoreConsumedRef.current) return;
    if (typeof window === "undefined") return;

    const pendingRestore = (window as any).__buildpcbPendingChatData;
    if (pendingRestore && !pendingRestoreConsumedRef.current) {
      pendingRestoreConsumedRef.current = true;
      const chatData = pendingRestore.data ?? pendingRestore;
      restoreMessagesFromChatData(chatData);
    }
  }, [restoreMessagesFromChatData]);
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
    providedCanvasState?: any,
    providedCanvas?: any,
    selectedComponents?: SelectedComponent[]
  ) => {
    if (!prompt.trim()) return;

    logger.api("AIChatContext.handlePromptSubmit", {
      promptPreview: prompt.substring(0, 80),
      hasProvidedCanvasState: !!providedCanvasState,
      hasProvidedCanvas: !!providedCanvas,
      contextCanvasReady: !!canvas,
      selectedComponentsCount: selectedComponents?.length || 0,
      selectedComponentsDetails: selectedComponents,
    });

    // Log selected components for debugging
    if (selectedComponents && selectedComponents.length > 0) {
      console.log(
        "🎯 Selected components being passed to AI:",
        selectedComponents
      );
    } else {
      console.log("⚠️ No selected components to pass to AI");
    }

    // Add user message with selected components context
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: prompt,
      timestamp: new Date(),
      status: "complete",
      selectedComponents:
        selectedComponents && selectedComponents.length > 0
          ? selectedComponents
          : undefined,
    };

    addMessage(userMessage);
    setIsThinking(true);

    // Don't create placeholder message yet - let Agent Streamer show progress!
    const aiMessageId = `ai-${Date.now()}`;
    let messageCreated = false;

    const conversationHistory = messages
      .filter(
        (msg) =>
          (msg.type === "user" || msg.type === "assistant") &&
          typeof msg.content === "string" &&
          msg.content.trim().length > 0
      )
      .slice(-10)
      .map((msg) => ({
        role: msg.type,
        content: msg.content,
      }));

    try {
      // Import agent service (already initialized globally)
      const { agentService } = await import("../agent/AgentService");

      console.log("🚀 Executing agent command:", prompt);

      // Add initial message with streaming indicator
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        type: "assistant",
        content: "",
        timestamp: new Date(),
        status: "complete",
        isStreaming: true,
        streamingStatus: "Working...",
      };

      addMessage(aiMessage);
      messageCreated = true;

      const streamingHandler = agentService.getStreamingHandler();

      // Track accumulated status messages for building the narrative
      let accumulatedContent = "";

      // Subscribe to streaming status updates and append them to content
      const unsubscribe = streamingHandler.subscribe((message) => {
        // Append ALL messages to the content to show agent's thought process
        // This creates a "growing message" like GitHub Copilot
        if (
          message.type === "status" ||
          message.type === "think" ||
          message.type === "progress" ||
          message.type === "success" ||
          message.type === "error" ||
          message.type === "warn"
        ) {
          // Format the message with emoji based on type
          const formattedMessage = formatStreamMessage(message);
          accumulatedContent += formattedMessage + "\n\n";

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: accumulatedContent,
                    streamingStatus: message.message, // Also update status bar
                    isStreaming: true,
                  }
                : msg
            )
          );
        }
      });

      // Execute with streaming content callback
      const result = await agentService.execute(prompt, {
        history: conversationHistory,
        selectedComponents: selectedComponents || [],
        onContentUpdate: (content: string) => {
          // The final LLM response gets appended to the accumulated status messages
          // This way we preserve both the agent's thought process AND the final response
          const fullContent = accumulatedContent + content;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: fullContent,
                    isStreaming: true,
                    status: "complete",
                  }
                : msg
            )
          );
        },
      });

      // Unsubscribe from streaming handler
      unsubscribe();

      const finalContent =
        (result.message && result.message.trim().length > 0
          ? accumulatedContent + result.message.trim() // Include all accumulated status messages + final response
          : result.status === "success"
          ? accumulatedContent + "Done."
          : accumulatedContent + "The agent could not complete the request.") ||
        "";

      // Mark streaming as complete
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: finalContent,
                status: result.status === "success" ? "complete" : "error",
                isStreaming: false, // Stop streaming indicator
                streamingStatus: undefined,
              }
            : msg
        )
      );

      if (messageCreated) {
        console.log("💬 Chat message completed, triggering save in 3 seconds");
        setTimeout(() => {
          setMessages((currentMessages) => {
            console.log(
              "🚀 Preparing to dispatch chat save event with",
              currentMessages.length,
              "messages"
            );
            queueMicrotask(() => {
              window.dispatchEvent(
                new CustomEvent("triggerChatSave", {
                  detail: {
                    messages: currentMessages,
                    messageCount: currentMessages.length,
                  },
                })
              );
            });
            return currentMessages;
          });
        }, 3000);
      }
    } catch (error) {
      console.error("❌ Error in handlePromptSubmit:", error);

      // Import agent service for error message
      const { agentService } = await import("../agent/AgentService");
      const streamingHandler = agentService.getStreamingHandler();
      streamingHandler.error("Failed to process request. Please try again.");

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        status: "error",
      };

      addMessage(errorMessage);
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
