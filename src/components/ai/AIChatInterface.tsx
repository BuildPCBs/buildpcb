"use client";

import { useRef, useEffect } from "react";
import { useAIChat } from "../../contexts/AIChatContext";
import type { ChatMessage } from "../../contexts/AIChatContext";
import { BRAND_COLORS } from "@/lib/constants";

interface AIChatInterfaceProps {
  className?: string;
  onCircuitUpdate?: (circuit: any) => void;
}

export function AIChatInterface({
  className = "",
  onCircuitUpdate,
}: AIChatInterfaceProps) {
  const { messages, isThinking, currentMessageIndex, setCurrentMessageIndex } =
    useAIChat();

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
    console.log(`Feedback for message ${messageId}:`, type);
    // TODO: Send feedback to analytics/improvement system
  };

  const handleRegenerate = (messageId: string) => {
    console.log(`Regenerate message ${messageId}`);
    // TODO: Implement regeneration logic
    // Find the original prompt and resubmit it
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      console.log("Response copied to clipboard");
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

      {/* Chat Container - Full width and height with 250px container height */}
      <div
        ref={chatContainerRef}
        className="relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm w-full"
        style={{ height: "250px" }}
      >
        {/* Messages Area */}
        <div
          ref={scrollAreaRef}
          className="h-full overflow-y-auto p-3 space-y-3"
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
            messages.map((message, index) => (
              <div key={message.id} data-message-index={index} className="mb-4">
                {message.type === "user" ? (
                  /* User Message - Bubble Style */
                  <div className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2 text-white"
                      style={{ backgroundColor: BRAND_COLORS.primary }}
                    >
                      <div className="text-sm leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AI Response - Full Width Text Block */
                  <div className="w-full">
                    <div className="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      {/* Response Content */}
                      <div className="text-xs leading-relaxed text-gray-800 mb-2">
                        {message.content}
                      </div>

                      {/* Status Indicator for Processing States */}
                      {message.status && message.status !== "complete" && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          {message.status === "receiving" && (
                            <>
                              <div className="flex gap-1">
                                <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></div>
                                <div
                                  className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"
                                  style={{ animationDelay: "0.2s" }}
                                ></div>
                                <div
                                  className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"
                                  style={{ animationDelay: "0.4s" }}
                                ></div>
                              </div>
                              <span>Thinking...</span>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
