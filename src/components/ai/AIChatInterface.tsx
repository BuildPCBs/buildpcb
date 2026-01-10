"use client";

import { useRef, useEffect, useState } from "react";
import { useAIChat } from "../../contexts/AIChatContext";
import { useCanvas } from "../../contexts/CanvasContext";
import { useCanvasStateSnapshot } from "../../hooks/useCanvasState";
import type { ChatMessage } from "../../contexts/AIChatContext";
import { ChevronRight } from "lucide-react";
import { BRAND_COLORS } from "@/lib/constants";
import { responsive } from "@/lib/responsive";
import { logger } from "@/lib/logger";
import { agentService } from "@/agent/AgentService";
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
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      });
    }
  }, [messages]);

  const handleDotClick = (index: number) => {
    setCurrentMessageIndex(index);
    // Scroll to the specific message with smooth behavior
    if (scrollAreaRef.current) {
      const messageElements = scrollAreaRef.current.querySelectorAll(
        "[data-message-index]"
      );
      const targetElement = messageElements[index] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
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

      {/* Chat Container - Full width and flexible height */}
      <div
        ref={chatContainerRef}
        className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm w-full"
        style={{
          height: "auto",
          maxHeight: responsive(500),
          minHeight: responsive(300),
        }}
      >
        {/* Messages Area */}
        <div
          ref={scrollAreaRef}
          className="chat-scroll overflow-y-auto p-3 space-y-3"
          style={{
            maxHeight: responsive(450),
            minHeight: responsive(250),
            overflowY: "auto",
            overflowX: "hidden",
            scrollBehavior: "smooth",
          }}
        >
          {messages.length === 0 ? (
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
              {messages.map((message, index) => {
                // Debug: Log message with selectedComponents
                if (message.type === "user" && message.selectedComponents) {
                  logger.component("Rendering user message with components", {
                    messageId: message.id,
                    hasSelectedComponents: !!message.selectedComponents,
                    componentCount: message.selectedComponents?.length || 0,
                    components: message.selectedComponents,
                  });
                }

                return (
                  <div
                    key={message.id}
                    data-message-index={index}
                    className="mb-4 chat-message"
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
                                    editingContent[message.id] ||
                                    message.content
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
                            <>
                              <div
                                className="rounded-2xl rounded-br-md px-4 py-2 text-white mb-1"
                                style={{
                                  backgroundColor: BRAND_COLORS.primary,
                                }}
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
                                        <p className="mb-2 last:mb-0">
                                          {children}
                                        </p>
                                      ),
                                      strong: ({ children }) => (
                                        <strong className="font-semibold">
                                          {children}
                                        </strong>
                                      ),
                                      em: ({ children }) => (
                                        <em className="opacity-90">
                                          {children}
                                        </em>
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

                              {/* Selected Components Context - Show below user message */}
                              {message.selectedComponents &&
                                message.selectedComponents.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-1 justify-end">
                                    {message.selectedComponents.map(
                                      (comp, idx) => (
                                        <div
                                          key={idx}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 border border-blue-300 rounded-md"
                                          style={{
                                            fontSize: "10px",
                                          }}
                                        >
                                          <span className="text-blue-700">
                                            📦
                                          </span>
                                          <span className="text-blue-900 font-medium">
                                            {comp.name}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                            </>
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
                          {/* Agent Stream Display - status/explanations FIRST inside bubble */}
                          {message.type === "assistant" &&
                            message.thinkingSteps &&
                            message.thinkingSteps.length > 0 && (
                              <div className="mb-1.5 space-y-1">
                                {message.thinkingSteps.map((step: any, stepIdx: number) => (
                                  <div key={`stream-step-${stepIdx}`} className="flex flex-col">
                                    <div className="flex items-center text-[11px] leading-tight text-gray-600 font-mono">
                                      <span className="mr-2">{getEmojiIcon(step)}</span>
                                      <span>{step.message}</span>
                                    </div>
                                    {step.expandable && (
                                      <>
                                        <button
                                          onClick={() => {
                                            const element = document.getElementById(
                                              `expandable-${message.id}-${stepIdx}`
                                            );
                                            if (element) {
                                              element.classList.toggle("hidden");
                                            }
                                          }}
                                          className="ml-6 mt-1 text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-1 text-[11px]"
                                        >
                                          <ChevronRight className="w-3 h-3" strokeWidth={2} />
                                          {step.expandable.title}
                                        </button>
                                        <div
                                          id={`expandable-${message.id}-${stepIdx}`}
                                          className="hidden ml-8 mt-1 p-1.5 bg-gray-50 rounded text-[11px] leading-snug text-gray-700 border-l-2 border-gray-200"
                                        >
                                          {step.expandable.content}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                          {/* Response Content */}
                          {message.content && (
                            <div
                              className="leading-relaxed text-gray-800 mb-2 prose prose-xs max-w-none relative"
                              style={{
                                fontSize: responsive(8),
                                lineHeight: 1.5,
                              }}
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
                                    <li className="text-gray-700">
                                      {children}
                                    </li>
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
                            </div>
                          )}

                          {/* Feedback Buttons - Only for completed AI responses */}
                          {message.status === "complete" && (
                            <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100 mt-2">
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
                                onClick={() => handleCopy(buildCopyText(message))}
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
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get emoji icon based on message content
 */
function getEmojiIcon(message: any) {
  const content = message.message.toLowerCase();

  if (content.includes("looking for") || content.includes("searching")) {
    return "🔍";
  } else if (content.includes("adding component")) {
    return "📦";
  } else if (content.includes("connecting") || content.includes("wiring")) {
    return "🔌";
  } else if (content.includes("checking") || content.includes("reviewing")) {
    return "👀";
  } else if (content.includes("removing") || content.includes("deleting")) {
    return "🗑️";
  } else if (message.type === "success") {
    return "✅";
  } else if (message.type === "error") {
    return "❌";
  } else if (message.type === "warn") {
    return "⚠️";
  } else if (message.type === "think") {
    return "💭";
  } else if (message.type === "progress") {
    return "⏳";
  }

  return "🔹";
}

/**
 * Build copyable text that includes status/explanations + final content
 */
function buildCopyText(message: any): string {
  const steps = (message.thinkingSteps || [])
    .filter((s: any) => s.expandable)
    .map((s: any) => {
      const parts = [s.message];
      if (s.expandable?.title) parts.push(s.expandable.title);
      if (s.expandable?.content) parts.push(s.expandable.content);
      return parts.join("\n").trim();
    })
    .filter(Boolean);

  return [...steps, message.content || ""].join("\n\n").trim();
}
