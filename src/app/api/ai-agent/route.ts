import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth, AuthenticatedUser } from "@/lib/api-auth";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatRequest {
  message: string;
  canvasState?: any;
  conversationHistory?: any[];
  sessionId?: string;
}

interface CircuitResponse {
  mode: "full" | "edit" | "text-only";
  circuit?: any;
  edit?: any;
  textResponse?: string;
  metadata: {
    timestamp: string;
    version: string;
    explanation: string;
  };
  canvasReferences?: any[];
  sessionContext?: {
    circuitId?: string;
    isRestoration?: boolean;
    previousState?: string;
  };
}

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log(`🤖 AI Agent API called by user: ${user.email}`);
    
    const body: ChatRequest = await request.json();
    const { message, canvasState, conversationHistory = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build conversation context for OpenAI
    const systemPrompt = `You are an AI assistant for BuildPCB.ai, "The Figma + Cursor for Electronics Design."

Your role is to help users design electronic circuits through intelligent component selection, placement, and connection recommendations.

RESPONSE PRINCIPLES:
1. Always follow the Circuit JSON Schema
2. Include required fields: id, type, value, position, connections, datasheet, explanation
3. Educational approach - explain WHY you chose each component
4. Practical engineering - suggest realistic component values and ratings
5. Use standard component values (E12 series for resistors, common capacitor values)

COMPONENT SELECTION CRITERIA:
- Functionality first
- Availability and cost effectiveness
- Reliability with appropriate ratings
- Beginner friendly for educational projects

CIRCUIT DESIGN GUIDELINES:
- Place related components near each other
- Keep signal paths short and direct
- Separate analog and digital sections
- Consider thermal management for power components
- Plan for easy debugging access points

INPUT CLASSIFICATION:
Determine if the user wants:
1. Circuit Generation - new circuit design
2. Circuit Modification - edit existing circuit
3. Component Query - asking about specific components
4. Educational - learning about electronics
5. Text Response Only - simple questions not requiring circuit changes

Current canvas state: ${JSON.stringify(canvasState || "empty")}

Respond in JSON format following the CircuitResponse schema. If it's a simple question, use mode: "text-only". If generating/modifying circuits, use mode: "full" or "edit".`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map((msg: any) => ({
        role: msg.type === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    // Parse the AI response
    let parsedResponse: CircuitResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback to text-only response if JSON parsing fails
      parsedResponse = {
        mode: "text-only",
        textResponse: aiResponse,
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0",
          explanation: "AI response (fallback format)",
        },
      };
    }

    // Ensure metadata is present
    if (!parsedResponse.metadata) {
      parsedResponse.metadata = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        explanation: parsedResponse.textResponse || "AI circuit response",
      };
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("AI Agent API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process AI request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

export async function GET() {
  return NextResponse.json({
    message: "AI Agent API is running",
    endpoints: {
      POST: "Send chat message to AI agent",
    },
    version: "1.0",
  });
}
