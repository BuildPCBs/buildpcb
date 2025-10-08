/**
 * API Route: Agent Execute
 * Backend endpoint for AI agent execution (keeps API key secure)
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI with server-side API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Server-side only!
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, tools, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request: messages array required" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OpenAI API key not configured on server",
          hint: "Set OPENAI_API_KEY environment variable (server-side only)",
        },
        { status: 500 }
      );
    }

    // If streaming is requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            const openaiStream = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: messages,
              tools: tools || [],
              tool_choice: "auto",
              temperature: 0.7,
              stream: true, // Enable streaming from OpenAI
            });

            for await (const chunk of openaiStream) {
              const delta = chunk.choices[0]?.delta;

              // Send content chunks
              if (delta?.content) {
                const data = JSON.stringify({
                  type: "content",
                  content: delta.content,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }

              // Send tool calls
              if (delta?.tool_calls) {
                const data = JSON.stringify({
                  type: "tool_calls",
                  tool_calls: delta.tool_calls,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }

              // Send finish reason
              if (chunk.choices[0]?.finish_reason) {
                const data = JSON.stringify({
                  type: "done",
                  finish_reason: chunk.choices[0].finish_reason,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            controller.close();
          } catch (error: any) {
            const data = JSON.stringify({
              type: "error",
              error: error.message,
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(streamResponse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming fallback
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      tools: tools || [],
      tool_choice: "auto",
      temperature: 0.7,
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error("❌ Agent API error:", error);

    return NextResponse.json(
      {
        error: "Failed to execute agent",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
