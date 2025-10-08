"use client";

import { useRef, useEffect, useState } from "react";
import { useAIChat } from "../../contexts/AIChatContext";
import { useCanvas } from "../../contexts/CanvasContext";
import { useCanvasStateSnapshot } from "../../hooks/useCanvasState";
import type { ChatMessage } from "../../contexts/AIChatContext";
import { BRAND_COLORS } from "@/lib/constants";
import { responsive } from "@/lib/responsive";
import { logger } from "@/lib/logger";
import { AgentStreamDisplay } from "../agent/AgentStreamDisplay";
import { agentService } from "@/agent/AgentService";
import { StreamMessage } from "@/agent/StreamingHandler";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.css";

interface AIChatInterfaceProps {
  className?: string;
  onCircuitUpdate?: (circuit: any) => void;
}

export function AIChatInterface({
  className = "",
  onCircuitUpdate,
}: AIChatInterfaceProps) {
  const {
    messages,
    isThinking,
    currentMessageIndex,
    setCurrentMessageIndex,
    startEditingMessage,
    saveEditedMessage,
    cancelEditingMessage,
  } = useAIChat();

  // Get canvas state for AI context
  const { canvas } = useCanvas();
  const canvasState = useCanvasStateSnapshot(canvas);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDotClick = (index: number) => {
    setCurrentMessageIndex(index);
    // Scroll to the specific message
    if (scrollAreaRef.current) {
      const messageElements = scrollAreaRef.current.querySelectorAll(
        "[data-message-index]"
      );
      const targetElement = messageElements[index] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const handleFeedback = (messageId: string, type: "positive" | "negative") => {
    logger.api(`Feedback for message ${messageId}:`, type);
    // TODO: Send feedback to analytics/improvement system
  };

  const handleRegenerate = (messageId: string) => {
    logger.api(`Regenerate message ${messageId}`);
    // TODO: Implement regeneration logic
    // Find the original prompt and resubmit it
  };

  const [editingContent, setEditingContent] = useState<{
    [key: string]: string;
  }>({});

  const handleEdit = (messageId: string) => {
    const message = messages.find((msg) => msg.id === messageId);
    if (message) {
      setEditingContent((prev) => ({
        ...prev,
        [messageId]: message.content,
      }));
      startEditingMessage(messageId);
    }
  };

  const handleSaveEdit = (messageId: string) => {
    const newContent = editingContent[messageId];
    if (newContent && newContent.trim()) {
      saveEditedMessage(messageId, newContent.trim());
      setEditingContent((prev) => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
    }
  };

  const handleCancelEdit = (messageId: string) => {
    cancelEditingMessage(messageId);
    setEditingContent((prev) => {
      const updated = { ...prev };
      delete updated[messageId];
      return updated;
    });
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      logger.api("Content copied to clipboard");
      // TODO: Show toast notification
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);

  useEffect(() => {
    const streamingHandler = agentService.getStreamingHandler();
    const unsubscribe = streamingHandler.subscribe((message) => {
      setStreamMessages((prev) => {
        const updated = [...prev, message];
        if (updated.length > 4) {
          return updated.slice(-4);
        }
        return updated;
      });

      if (message.type === "success" || message.type === "error") {
        setTimeout(() => {
          setStreamMessages((prev) => prev.filter((m) => m.id !== message.id));
        }, 2000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.type === "assistant" && lastMessage.status === "complete") {
      setStreamMessages([]);
    }
  }, [messages]);

  return (
    <div className="relative w-full h-full">
      {/* Dot Navigation */}
      {messages.length > 0 && (
        <div className="flex items-center justify-center gap-1 mb-2 px-2">
          {messages.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 ${
                index === currentMessageIndex
                  ? "bg-blue-500 scale-110"
                  : index <= currentMessageIndex
                  ? "bg-gray-400"
                  : "bg-gray-200"
              }`}
              title={`Message ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Chat Container - Full width and responsive height (500px design) */}
      <div
        ref={chatContainerRef}
        className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm w-full"
        style={{ height: responsive(400) }}
      >
        {/* Messages Area */}
        <div
          ref={scrollAreaRef}
          className="h-full overflow-y-auto p-3 space-y-3"
        >
          {messages.length === 0 && streamMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-400 text-sm mb-2">💬</div>
                <div className="text-gray-400 text-sm">
                  Start designing your circuit with AI...
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  data-message-index={index}
                  className="mb-4"
                >
                  {message.type === "user" ? (
                    /* User Message - Bubble Style */
                    <div className="flex justify-end">
                      <div className="max-w-[80%]">
                        {message.isEditing ? (
                          /* Editing Mode */
                          <div className="mb-1">
                            <textarea
                              value={
                                editingContent[message.id] || message.content
                              }
                              onChange={(e) =>
                                setEditingContent((prev) => ({
                                  ...prev,
                                  [message.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEdit(message.id);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  handleCancelEdit(message.id);
                                }
                              }}
                              className="w-full rounded-2xl rounded-br-md px-4 py-2 text-sm border-2 border-blue-300 focus:border-blue-500 focus:outline-none resize-none"
                              rows={Math.min(
                                5,
                                (
                                  editingContent[message.id] || message.content
                                ).split("\n").length
                              )}
                              style={{
                                backgroundColor: BRAND_COLORS.primary,
                                color: "white",
                              }}
                              autoFocus
                              placeholder="Edit your message..."
                            />
                            <div className="flex justify-end gap-1 mt-1">
                              <span className="text-xs text-gray-400 mr-2 self-center">
                                Enter to save, Esc to cancel
                              </span>
                              <button
                                onClick={() => handleCancelEdit(message.id)}
                                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Cancel edit"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(message.id)}
                                className="px-2 py-1 text-xs text-white rounded transition-colors"
                                style={{
                                  backgroundColor: BRAND_COLORS.primary,
                                }}
                                title="Save edit"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Display Mode */
                          <div
                            className="rounded-2xl rounded-br-md px-4 py-2 text-white mb-1"
                            style={{ backgroundColor: BRAND_COLORS.primary }}
                          >
                            <div
                              className="leading-relaxed prose prose-xs prose-invert max-w-none"
                              style={{
                                fontSize: responsive(8),
                                lineHeight: 1.5,
                              }}
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                  // Custom styling for user messages (light theme)
                                  p: ({ children }) => (
                                    <p className="mb-2 last:mb-0">{children}</p>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="font-semibold">
                                      {children}
                                    </strong>
                                  ),
                                  em: ({ children }) => (
                                    <em className="opacity-90">{children}</em>
                                  ),
                                  code: ({ children }) => (
                                    <code className="bg-white bg-opacity-20 px-1 py-0.5 rounded text-xs font-mono">
                                      {children}
                                    </code>
                                  ),
                                  pre: ({ children }) => (
                                    <pre className="bg-white bg-opacity-20 p-2 rounded text-xs font-mono overflow-x-auto">
                                      {children}
                                    </pre>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="list-disc list-inside mb-2 space-y-1">
                                      {children}
                                    </ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="list-decimal list-inside mb-2 space-y-1">
                                      {children}
                                    </ol>
                                  ),
                                  li: ({ children }) => <li>{children}</li>,
                                  h1: ({ children }) => (
                                    <h1 className="text-sm font-bold mb-2">
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-sm font-bold mb-2">
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-sm font-bold mb-2">
                                      {children}
                                    </h3>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-white border-opacity-30 pl-4 italic mb-2">
                                      {children}
                                    </blockquote>
                                  ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                        {/* User Message Action Buttons - Only show when not editing */}
                        {!message.isEditing && (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEdit(message.id)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color =
                                  BRAND_COLORS.primary)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#6B7280")
                              }
                              title="Edit message"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCopy(message.content)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color =
                                  BRAND_COLORS.primary)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#6B7280")
                              }
                              title="Copy message"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* AI Response - Full Width Text Block */
                    <div className="w-full">
                      <div className="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        {/* Streaming Status Indicator - Shows before/during content */}
                        {message.isStreaming && message.streamingStatus && (
                          <div
                            className="flex items-center mb-2 px-2 py-1.5 rounded"
                            style={{
                              backgroundColor: "#EFF6FF",
                              border: "1px solid #3B82F6",
                            }}
                          >
                            <div className="flex-shrink-0 mr-2">
                              <svg
                                className="w-3 h-3 text-blue-600 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            </div>
                            <span
                              className="text-blue-800 font-medium"
                              style={{ fontSize: responsive(8) }}
                            >
                              {message.streamingStatus}
                            </span>
                          </div>
                        )}

                        {/* Response Content */}
                        {message.content && (
                          <div
                            className="leading-relaxed text-gray-800 mb-2 prose prose-xs max-w-none relative"
                            style={{ fontSize: responsive(8), lineHeight: 1.5 }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                // Custom styling for markdown elements
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0">{children}</p>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-gray-900">
                                    {children}
                                  </strong>
                                ),
                                em: ({ children }) => (
                                  <em className="italic text-gray-700">
                                    {children}
                                  </em>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800">
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="bg-gray-100 p-2 rounded text-xs font-mono text-gray-800 overflow-x-auto">
                                    {children}
                                  </pre>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc list-inside mb-2 space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal list-inside mb-2 space-y-1">
                                    {children}
                                  </ol>
                                ),
                                li: ({ children }) => (
                                  <li className="text-gray-700">{children}</li>
                                ),
                                h1: ({ children }) => (
                                  <h1 className="text-sm font-bold text-gray-900 mb-2">
                                    {children}
                                  </h1>
                                ),
                                h2: ({ children }) => (
                                  <h2 className="text-sm font-bold text-gray-900 mb-2">
                                    {children}
                                  </h2>
                                ),
                                h3: ({ children }) => (
                                  <h3 className="text-sm font-bold text-gray-900 mb-2">
                                    {children}
                                  </h3>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-2">
                                    {children}
                                  </blockquote>
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                            {/* Streaming cursor at the end of content */}
                            {message.isStreaming && (
                              <span
                                className="inline-block ml-1 w-1.5 h-4 bg-blue-600 animate-pulse"
                                style={{ verticalAlign: "middle" }}
                              />
                            )}
                          </div>
                        )}

                        {/* Status Indicator for Processing States */}
                        {message.status && message.status !== "complete" && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            {message.status === "receiving" && (
                              <>
                                <div className="flex gap-1">
                                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                                  <div
                                    className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                                    style={{ animationDelay: "0.2s" }}
                                  ></div>
                                  <div
                                    className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                                    style={{ animationDelay: "0.4s" }}
                                  ></div>
                                </div>
                                <span className="text-blue-600 font-medium">
                                  {message.content
                                    ? "Streaming response..."
                                    : "Thinking..."}
                                </span>
                              </>
                            )}
                            {message.status === "parsing" && (
                              <>
                                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>Processing...</span>
                              </>
                            )}
                            {message.status === "error" && (
                              <span className="text-red-500">⚠ Error</span>
                            )}
                          </div>
                        )}

                        {/* Feedback Buttons - Only for completed AI responses */}
                        {message.status === "complete" && (
                          <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100">
                            <button
                              onClick={() => handleRegenerate(message.id)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color =
                                  BRAND_COLORS.primary)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#6B7280")
                              }
                              title="Regenerate response"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleFeedback(message.id, "positive")
                              }
                              className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Like response"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleFeedback(message.id, "negative")
                              }
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Unlike response"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCopy(message.content)}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color =
                                  BRAND_COLORS.primary)
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#6B7280")
                              }
                              title="Copy response"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {streamMessages.length > 0 && (
                <div className="mb-4">
                  <AgentStreamDisplay
                    messages={streamMessages}
                    width="100%"
                    maxWidth="100%"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
