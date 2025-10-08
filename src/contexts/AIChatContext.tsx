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
import { useAuth } from "../hooks/useAuth";
import { logger } from "@/lib/logger";
import { useCanvas } from "./CanvasContext";
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
  const pendingRestoreConsumedRef = useRef(false);

  // Get auth token for API calls
  const { getToken, isAuthenticated } = useAuth();
  const { canvas } = useCanvas();
  const { currentProject, currentCircuit, currentNetlist } = useProject();
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
    providedCanvas?: any
  ) => {
    if (!prompt.trim()) return;

    logger.api("AIChatContext.handlePromptSubmit", {
      promptPreview: prompt.substring(0, 80),
      hasProvidedCanvasState: !!providedCanvasState,
      hasProvidedCanvas: !!providedCanvas,
      contextCanvasReady: !!canvas,
    });

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

    // Don't create placeholder message yet - let Agent Streamer show progress!
    const aiMessageId = `ai-${Date.now()}`;
    let messageCreated = false;

    try {
      // Import agent service (already initialized globally)
      const { agentService } = await import("../agent/AgentService");

      console.log("🚀 Executing agent command:", prompt);

      // Show initial thinking message in Agent Streamer
      const streamingHandler = agentService.getStreamingHandler();
      streamingHandler.think("Understanding your request...");

      const canvasStateSnapshot =
        providedCanvasState || getCurrentState?.() || null;

      const projectContextPayload = currentProject
        ? {
            projectId: currentProject.id,
            name: currentProject.name || "Untitled Project",
            description: currentProject.description || "",
            lastUpdated: currentProject.updated_at,
            tags: Array.isArray(currentProject.tags)
              ? currentProject.tags.slice(0, 8)
              : [],
            circuitSummary: currentCircuit
              ? {
                  componentCount: currentCircuit.components?.length || 0,
                  connectionCount: currentCircuit.connections?.length || 0,
                  components: (currentCircuit.components || [])
                    .slice(0, 12)
                    .map((component) => ({
                      id: component.id,
                      type: component.type,
                      value: (component as any).value,
                      position: component.position,
                    })),
                }
              : null,
            netlistSummary: Array.isArray(currentNetlist)
              ? {
                  netCount: currentNetlist.length,
                  topNets: currentNetlist.slice(0, 10).map((net: any) => ({
                    netId: net.netId,
                    connectionCount: net.connections?.length || 0,
                  })),
                }
              : null,
          }
        : null;

      // Call backend API with streaming enabled
      const response = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are a helpful PCB design assistant.",
            },
            { role: "user", content: prompt },
          ],
          tools: [],
          canvasState: canvasStateSnapshot,
          projectContext: projectContextPayload,
          stream: true, // Enable streaming!
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "content") {
                  // Append new content character by character
                  accumulatedContent += data.content;

                  // Create message on first content chunk (not before!)
                  if (!messageCreated) {
                    const streamingMessage: ChatMessage = {
                      id: aiMessageId,
                      type: "assistant",
                      content: accumulatedContent,
                      timestamp: new Date(),
                      status: "receiving",
                    };
                    addMessage(streamingMessage);
                    messageCreated = true;

                    // Update Agent Streamer
                    streamingHandler.status("Generating response...");
                  } else {
                    // Update existing message (smooth streaming!)
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      )
                    );
                  }
                } else if (data.type === "done") {
                  // Mark as complete
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === aiMessageId
                        ? { ...msg, status: "complete" as const }
                        : msg
                    )
                  );

                  // Success message in Agent Streamer
                  streamingHandler.success("Response complete!");
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      console.log("✅ Streaming complete");

      // Trigger a save after chat completion
      if (messageCreated) {
        console.log("💬 Chat message completed, triggering save in 3 seconds");
        setTimeout(() => {
          // Get current messages from state, then dispatch in next tick
          setMessages((currentMessages) => {
            console.log(
              "🚀 Preparing to dispatch chat save event with",
              currentMessages.length,
              "messages"
            );
            // Dispatch in a microtask to avoid React render phase issues
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
            return currentMessages; // Return unchanged
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
