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

export const POST = withAuth(
  async (request: NextRequest, user: AuthenticatedUser) => {
    try {
      console.log(`🤖 AI Agent API called by user: ${user.email}`);

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.error("❌ Missing OPENAI_API_KEY environment variable");
        return NextResponse.json(
          { error: "OpenAI API key not configured" },
          { status: 500 }
        );
      }

      console.log("✅ OpenAI API key found, length:", process.env.OPENAI_API_KEY.length);

      const body: ChatRequest = await request.json();
      const { message, canvasState, conversationHistory = [] } = body;

      if (!message?.trim()) {
        return NextResponse.json(
          { error: "Message is required" },
          { status: 400 }
        );
      }

      console.log("📝 Processing message:", message.substring(0, 100) + "...");

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
          role:
            msg.type === "user" ? ("user" as const) : ("assistant" as const),
          content: msg.content,
        })),
        { role: "user" as const, content: message },
      ];

      console.log("🔄 Sending request to OpenAI...");
      console.log("📊 Message count:", messages.length);

      // Try with a more robust configuration and error handling
      let completion;
      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Use gpt-4o-mini instead of gpt-4o for better reliability
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }, {
          timeout: 30000, // 30 second timeout
        });
      } catch (modelError) {
        console.warn("⚠️ gpt-4o-mini failed, trying gpt-3.5-turbo...");
        // Fallback to gpt-3.5-turbo if gpt-4o-mini fails
        completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages,
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        }, {
          timeout: 30000,
        });
      }

      console.log("✅ OpenAI response received");

      const aiResponse = completion.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error("No response from OpenAI");
      }

      // Parse the AI response
      let parsedResponse: CircuitResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
        console.log("✅ AI response parsed successfully");
      } catch (parseError) {
        console.warn("⚠️ JSON parsing failed, using fallback format");
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
      console.error("❌ AI Agent API error:", error);

      // Enhanced error logging for network issues
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        if (error.message.includes("ENOTFOUND") || error.message.includes("Connection error")) {
          console.error("🌐 Network connectivity issue detected");
          console.error("🔍 Possible causes:");
          console.error("  - Internet connection problems");
          console.error("  - DNS resolution issues");
          console.error("  - Firewall/proxy blocking api.openai.com");
          console.error("  - OpenAI API service outage");
          
          return NextResponse.json(
            {
              error: "Network connectivity issue",
              details: "Unable to reach OpenAI API. Please check your internet connection and try again.",
              type: "NETWORK_ERROR",
            },
            { status: 503 }
          );
        }
        
        if (error.message.includes("API key")) {
          return NextResponse.json(
            {
              error: "API configuration error",
              details: "Invalid or missing OpenAI API key",
              type: "AUTH_ERROR",
            },
            { status: 401 }
          );
        }
      }

      return NextResponse.json(
        {
          error: "Failed to process AI request",
          details: error instanceof Error ? error.message : "Unknown error",
          type: "GENERAL_ERROR",
        },
        { status: 500 }
      );
    }
  }
);

export async function GET() {
  try {
    // Test connectivity to OpenAI
    console.log("🔍 Testing OpenAI connectivity...");
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        message: "AI Agent API is running",
        status: "ERROR",
        error: "OpenAI API key not configured",
        endpoints: {
          POST: "Send chat message to AI agent",
        },
        version: "1.0",
      });
    }

    // Try a simple API call to test connectivity
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const testResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
      });

      console.log("✅ OpenAI connectivity test passed");

      return NextResponse.json({
        message: "AI Agent API is running",
        status: "HEALTHY",
        connectivity: "OK",
        endpoints: {
          POST: "Send chat message to AI agent",
        },
        version: "1.0",
        test: {
          timestamp: new Date().toISOString(),
          model: "gpt-3.5-turbo",
          response: testResponse.choices[0]?.message?.content || "No response",
        },
      });
    } catch (testError) {
      console.error("❌ OpenAI connectivity test failed:", testError);
      
      return NextResponse.json({
        message: "AI Agent API is running",
        status: "DEGRADED",
        connectivity: "FAILED",
        error: testError instanceof Error ? testError.message : "Unknown error",
        endpoints: {
          POST: "Send chat message to AI agent",
        },
        version: "1.0",
      });
    }
  } catch (error) {
    console.error("❌ Health check error:", error);
    
    return NextResponse.json({
      message: "AI Agent API is running",
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
      endpoints: {
        POST: "Send chat message to AI agent",
      },
      version: "1.0",
    });
  }
}
