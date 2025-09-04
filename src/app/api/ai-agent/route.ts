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

// Generate detailed markdown explanation for AI responses
function generateDetailedExplanation(response: CircuitResponse): string {
  if (response.mode === "text-only") {
    return `## 🤖 AI Assistant Response

**Response Type:** Text-only explanation
**Content:** ${response.textResponse?.substring(0, 100)}${
      response.textResponse && response.textResponse.length > 100 ? "..." : ""
    }

### 📝 What I Provided
- Educational explanation or guidance
- No circuit modifications made
- Pure informational response

### 💡 Usage Notes
- This response contains explanatory content only
- No components were added to the canvas
- Use this information to inform your circuit design decisions`;
  }

  if (response.mode === "full" && response.circuit) {
    const circuit = response.circuit;
    const componentCount = circuit.components?.length || 0;
    const connectionCount = circuit.connections?.length || 0;

    let explanation = `## 🚀 Circuit Design Created

**Circuit Name:** ${circuit.name || "Unnamed Circuit"}
**Design Overview:** ${circuit.description || "Custom circuit design"}

### 📊 Circuit Statistics
- **Components:** ${componentCount} total
- **Connections:** ${connectionCount} wires
- **Complexity:** ${
      componentCount > 5
        ? "Advanced"
        : componentCount > 2
        ? "Intermediate"
        : "Basic"
    }

### 🔧 Components Added`;

    if (circuit.components && circuit.components.length > 0) {
      circuit.components.forEach((comp: any, index: number) => {
        explanation += `\n${index + 1}. **${
          comp.type?.toUpperCase() || "COMPONENT"
        }**`;
        if (comp.value) explanation += ` - ${comp.value}`;
        if (comp.position) {
          explanation += `\n   - Position: (${comp.position.x || 0}, ${
            comp.position.y || 0
          })`;
        }
        if (comp.explanation) {
          explanation += `\n   - Purpose: ${comp.explanation}`;
        }
      });
    }

    if (circuit.connections && circuit.connections.length > 0) {
      explanation += `\n\n### 🔗 Electrical Connections`;
      circuit.connections.forEach((conn: any, index: number) => {
        const fromComp = circuit.components?.find(
          (c: any) => c.id === conn.from?.componentId
        );
        const toComp = circuit.components?.find(
          (c: any) => c.id === conn.to?.componentId
        );
        explanation += `\n${index + 1}. ${fromComp?.type || "Component"} → ${
          toComp?.type || "Component"
        }`;
      });
    }

    explanation += `\n\n### 🎯 Design Intent
This circuit was designed to fulfill your specific requirements. All components are positioned for optimal layout and electrical performance.

### ⚡ Next Steps
- Review component placements
- Verify electrical connections
- Test circuit functionality
- Make adjustments as needed`;

    return explanation;
  }

  if (response.mode === "edit" && response.edit) {
    return `## ✏️ Circuit Modification Applied

**Modification Type:** Circuit edit operation
**Changes Made:** ${
      response.edit.description || "Circuit modifications applied"
    }

### 🔄 What Was Changed
- Existing circuit components were modified
- Connection topology may have been updated
- Component properties adjusted for better performance

### 📋 Modification Details
${response.edit.details || "Specific edit details not available"}

### ✅ Verification Steps
- Check that all connections remain intact
- Verify component values are correct
- Ensure circuit functionality is preserved`;
  }

  // Fallback for unknown response types
  return `## 🤖 AI Response Generated

**Response Mode:** ${response.mode || "Unknown"}
**Timestamp:** ${new Date().toISOString()}

### 📝 Response Summary
An AI-generated response was created based on your input. The response type and content have been processed according to your request.

### 🔍 Technical Details
- Response format: ${response.mode || "Unspecified"}
- Processing completed successfully
- Ready for implementation or review

### 💡 Recommendations
- Review the response content carefully
- Verify all specifications match your requirements
- Test any generated circuits thoroughly`;
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

      console.log(
        "✅ OpenAI API key found, length:",
        process.env.OPENAI_API_KEY.length
      );

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
      const systemPrompt = `You are BuildPCB, "The Figma + Cursor for Electronics Design."

I can build circuits by adding components, connecting them with wires, explaining how circuits work, and helping you create exactly what you need.

CRITICAL: You MUST respond with VALID JSON that follows this exact schema:

{
  "mode": "full" | "edit" | "text-only",
  "circuit": {
    "id": "unique-circuit-id",
    "name": "Circuit Name",
    "description": "Brief description",
    "components": [
      {
        "id": "component-id",
        "type": "resistor" | "capacitor" | "led" | "transistor" | "ic" | "microcontroller" | "sensor" | "switch" | "connector" | "battery" | "voltage_regulator",
        "value": "10kΩ" | "10µF" | "3.3V" | etc,
        "position": {"x": 100, "y": 100},
        "connections": [
          {"id": "pin1", "name": "pin1", "netId": "net1", "type": "input"},
          {"id": "pin2", "name": "pin2", "netId": "net2", "type": "output"}
        ],
        "datasheet": "https://example.com/datasheet",
        "explanation": "Why I chose this component and its purpose"
      }
    ],
    "connections": [
      {
        "id": "wire-id",
        "from": {"componentId": "comp1", "pin": "pin1"},
        "to": {"componentId": "comp2", "pin": "pin2"},
        "type": "wire"
      }
    ]
  },
  "metadata": {
    "timestamp": "2025-09-03T10:00:00.000Z",
    "version": "1.0",
    "explanation": "Brief explanation of what was done"
  }
}

RESPONSE PRINCIPLES:
1. Always respond with VALID JSON - no markdown, no extra text
2. For circuit requests: use mode "full" and include circuit object
3. For simple questions: use mode "text-only" with textResponse field
4. Include ALL required fields for each component
5. Use realistic component values (E12 series for resistors: 1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2)
6. Position components at reasonable coordinates (x,y between 50-500)

COMPONENT TYPES: resistor, capacitor, inductor, led, diode, transistor, ic, microcontroller, sensor, switch, button, connector, battery, voltage_regulator

INPUT CLASSIFICATION:
- "Add a resistor" → mode: "full", create circuit with resistor
- "What's a capacitor?" → mode: "text-only", explain capacitor
- "Connect LED to battery" → mode: "full", create circuit with LED and battery connected

Current canvas state: ${JSON.stringify(canvasState || "empty")}

IMPORTANT: Your response must be PURE JSON with no additional text, markdown, or formatting.`;

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
        completion = await openai.chat.completions.create(
          {
            model: "o3", //
            messages,
            // temperature: 0.7,
            // max_tokens: 2000,
            response_format: { type: "json_object" },
          },
          {
            // timeout: 30000, // 30 second timeout
          }
        );
      } catch (modelError) {
        console.warn("⚠️ gpt-4o-mini failed, trying gpt-3.5-turbo...");
        // Fallback to gpt-3.5-turbo if gpt-4o-mini fails
        completion = await openai.chat.completions.create(
          {
            model: "o3",
            messages,
            // temperature: 0.7,
            // max_tokens: 2000,
            response_format: { type: "json_object" },
          },
          {
            // timeout: 30000,
          }
        );
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
        console.log("📊 Response mode:", parsedResponse.mode);
        console.log("📦 Has circuit:", !!parsedResponse.circuit);
        console.log("📝 Has text response:", !!parsedResponse.textResponse);
      } catch (parseError) {
        console.error("❌ JSON parsing failed!");
        console.error("🔍 Raw AI response:", aiResponse);
        console.error("🔍 Parse error:", parseError);

        // Try to extract JSON from markdown code blocks
        const jsonMatch = aiResponse.match(
          /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
        );
        if (jsonMatch) {
          console.log("🔧 Found JSON in markdown, attempting extraction...");
          try {
            parsedResponse = JSON.parse(jsonMatch[1]);
            console.log("✅ Successfully extracted JSON from markdown");
          } catch (extractError) {
            console.error(
              "❌ Failed to extract JSON from markdown:",
              extractError
            );
            parsedResponse = {
              mode: "text-only",
              textResponse: aiResponse,
              metadata: {
                timestamp: new Date().toISOString(),
                version: "1.0",
                explanation: "AI response (JSON parsing failed)",
              },
            };
          }
        } else {
          console.log("🔧 Using fallback text-only response");
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
      }

      // Ensure metadata is present and has proper explanation
      if (!parsedResponse.metadata) {
        parsedResponse.metadata = {
          timestamp: new Date().toISOString(),
          version: "1.0",
          explanation: generateDetailedExplanation(parsedResponse),
        };
      } else if (
        !parsedResponse.metadata.explanation ||
        parsedResponse.metadata.explanation === "AI circuit response" ||
        parsedResponse.metadata.explanation ===
          "Brief explanation of what was done"
      ) {
        // Fix the generic fallback explanation
        parsedResponse.metadata.explanation =
          generateDetailedExplanation(parsedResponse);
      }

      console.log("📤 Final response:", {
        mode: parsedResponse.mode,
        hasCircuit: !!parsedResponse.circuit,
        hasText: !!parsedResponse.textResponse,
        explanation: parsedResponse.metadata.explanation,
      });

      return NextResponse.json(parsedResponse);
    } catch (error) {
      console.error("❌ AI Agent API error:", error);

      // Enhanced error logging for network issues
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);

        if (
          error.message.includes("ENOTFOUND") ||
          error.message.includes("Connection error")
        ) {
          console.error("🌐 Network connectivity issue detected");
          console.error("🔍 Possible causes:");
          console.error("  - Internet connection problems");
          console.error("  - DNS resolution issues");
          console.error("  - Firewall/proxy blocking api.openai.com");
          console.error("  - OpenAI API service outage");

          return NextResponse.json(
            {
              error: "Network connectivity issue",
              details:
                "Unable to reach OpenAI API. Please check your internet connection and try again.",
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
