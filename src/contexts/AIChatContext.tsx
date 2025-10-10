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
  const localStorageKey = useMemo(() => {
    const projectKey = currentProject?.id || "global";
    return `buildpcb-chat-${projectKey}`;
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
        messagesWithComponents: restoredMessages.filter(msg => msg.selectedComponents?.length > 0).length,
        componentDetails: restoredMessages
          .filter(msg => msg.selectedComponents?.length > 0)
          .map(msg => ({
            id: msg.id,
            selectedComponents: msg.selectedComponents
          }))
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorageKey) return;
    if (messages.length > 0) return;

    try {
      const cached = window.localStorage.getItem(localStorageKey);
      if (!cached) return;

      const parsed = JSON.parse(cached);
      if (parsed?.chatData?.messages?.length) {
        logger.component("Restoring chat from local cache", {
          messageCount: parsed.chatData.messages.length,
        });
        restoreMessagesFromChatData(parsed.chatData);
      }
    } catch (error) {
      logger.component("Failed to restore chat from local cache", error);
    }
  }, [localStorageKey, messages.length, restoreMessagesFromChatData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorageKey) return;

    if (messages.length === 0) {
      window.localStorage.removeItem(localStorageKey);
      return;
    }

    try {
      const serializedMessages = messages.slice(-200).map((msg) => ({
        ...msg,
        timestamp:
          msg.timestamp instanceof Date
            ? msg.timestamp.toISOString()
            : msg.timestamp,
      }));

      // Debug: Log messages with selectedComponents
      const msgsWithComponents = serializedMessages.filter(m => m.selectedComponents && m.selectedComponents.length > 0);
      if (msgsWithComponents.length > 0) {
        logger.component("Saving messages with selectedComponents to localStorage", {
          count: msgsWithComponents.length,
          details: msgsWithComponents.map(m => ({
            id: m.id,
            type: m.type,
            selectedComponents: m.selectedComponents
          }))
        });
      }

      const payload = {
        chatData: { messages: serializedMessages },
        projectId: currentProject?.id || null,
        updatedAt: Date.now(),
      };

      window.localStorage.setItem(localStorageKey, JSON.stringify(payload));
    } catch (error) {
      logger.component("Failed to cache chat messages locally", error);
    }
  }, [messages, localStorageKey, currentProject?.id]);

  // Listen for chat data restoration events
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
      console.log("🎯 Selected components being passed to AI:", selectedComponents);
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
      selectedComponents: selectedComponents && selectedComponents.length > 0 ? selectedComponents : undefined,
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

      // Subscribe to streaming status updates for the status indicator
      const unsubscribe = streamingHandler.subscribe((message) => {
        // Update just the status indicator (shown above content)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, streamingStatus: message.message }
              : msg
          )
        );
      });

      // Execute with streaming content callback
      const result = await agentService.execute(prompt, {
        history: conversationHistory,
        selectedComponents: selectedComponents || [],
        onContentUpdate: (content: string) => {
          // The LLM streams its full narrative response including all steps
          // We just display it as it comes in - character by character
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: content, // This already includes the full narrative
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
          ? result.message.trim()
          : result.status === "success"
          ? "Done."
          : "The agent could not complete the request.") || "";

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
