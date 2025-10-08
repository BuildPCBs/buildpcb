🧠 **Agent Decision Process (Realistic & Actionable)**

---

### **1️⃣ Step 1 — Receive User Input**

- The agent listens for a message or command from the user.
- Example: _“Design a simple LED circuit powered by 9V.”_

Before Step 2 kicks in, the raw utterance is bundled with the active capability catalog (the enum from `src/agent/capabilities.ts`) so the intent classifier only considers supported actions. This keeps the downstream `intent` value grounded in what the agent can actually execute.

---

### **2️⃣ Step 2 — Parse and Classify Intent (LLM Call #1)**

- Send the input to the LLM to determine **intent** and **complexity**.
- Output JSON example:

  ```json
  {
    "intent": "CREATE_CIRCUIT", // intent is tied with capabilities
    "complexity": "complex",
    "requires_vectorization": true,
    "requires_subtasks": true,
    "process": {
      "total_steps": 6,
      "steps": {
        "1": "Parse input and detect intent",
        "2": "Vectorize input and search DB",
        "3": "Generate subtasks",
        "4": "Match and validate components",
        "5": "LLM finalize circuit layout",
        "6": "Render circuit to canvas"
      },
      "status": {
        "current_step": 1,
        "completed_steps": [],
        "in_progress": "Parse input and detect intent"
      }
    }
  }
  ```

- The response defines both the **capability** and the **execution blueprint** (number of steps, step names, and live status).

---

### 🧱 Context Snapshot (AgentContext & Memory Layers)

Before vectorization or planning kick in, the orchestrator hydrates an `AgentContext` so every downstream action has grounding in the live workspace and conversation:

- **Canvas layer.** `AgentService` taps the `canvasCommandManager` to expose the Fabric.js instance plus helpers like `getObjects`, `getActiveObjects`, and `requestRenderAll`. This gives handlers a real-time view of what’s on the board, what’s selected, and whether the canvas is ready for mutations.
- **Project layer.** Zustand’s `useProjectStore` provides the active project ID, version, `circuit` graph, dirty flag, and last-saved timestamp. Capability handlers rely on this snapshot to validate edits against authoritative project state.
- **User & stream layer.** Auth storage contributes `userId` when available, and the shared `StreamingHandler` instance is threaded through so every stage can narrate progress back to the UI.
- **Chat memory window.** The client packages a rolling slice of prior turns (user + assistant) into `conversationHistory`, which the `/api/agent/execute` endpoint appends to the prompt so the LLM respects prior decisions without re-reading the entire transcript.
- **Canvas & project summaries.** Before each OpenAI call, the API route runs `formatCanvasStateForPrompt` and `formatProjectContextForPrompt`, yielding compact sections that list component counts, key placements, net highlights, zoom level, and other metadata. These summaries anchor the model’s reasoning even if it hasn’t called `get_canvas_state` yet.

This snapshot is refreshed for every request and augmented mid-run whenever the LLM invokes tools such as `get_canvas_state` or `component_search`, ensuring the context stays synchronized with the evolving canvas.

---

### **3️⃣ Step 3 — Vectorization (if required)**

- If `requires_vectorization = true`, we embed the user text.
- Query the **component vector database** to find the top ~20 closest matches.
- This ensures the LLM uses _existing components only_.
- This is the first explicit **embedding-driven context gathering** phase: on top of the AgentContext snapshot above, the planner enriches the request with structured component matches so later stages operate on concrete IDs instead of raw prose.

---

### **4️⃣ Step 4 — Expand Task into Subtasks (LLM Call #2)**

- If `requires_subtasks = true`, another LLM call breaks the goal into smaller actions.
- Example output:

  ```json
  {
    "subtasks": [
      { "capability": "CREATE_CIRCUIT" },
      {
        "capability": "ADD_COMPONENT",
        "data": { "type": "Battery", "voltage": 9 }
      },
      { "capability": "ADD_COMPONENT", "data": { "type": "LED" } },
      { "capability": "ADD_COMPONENT", "data": { "type": "Resistor" } },
      {
        "capability": "CREATE_WIRE",
        "data": { "from": "Battery", "to": "Resistor" }
      },
      {
        "capability": "CREATE_WIRE",
        "data": { "from": "Resistor", "to": "LED" }
      }
    ]
  }
  ```

---

### **5️⃣ Step 5 — Execute Subtasks**

- Loop through each subtask.
- For each one:

  - Fetch matching components from DB (if component-based).
  - Use the `agent.streamer` to broadcast live progress.
  - Run capability handlers (e.g. `CREATE_WIRE`, `ADD_COMPONENT`).

#### What the user sees while we stream

1. **Immediate acknowledgement** – as soon as the planner accepts the prompt, the streamer pushes something like `Working on it…` so the user knows the agent is active.
2. **Context gathering** – when Step 3 pulls embeddings or Step 4 resolves subtasks, the streamer emits `think` messages: _“Gathering project context”_, _“Searching component library”_. These are transient hints that the agent is still processing, similar to how I narrate intermediate reasoning before responding.
3. **Intent lock-in** – after Step 2 constrains the intent, we send a `status` update naming the chosen capability: _“Planning ADD_COMPONENT flow”_. This mirrors how I let you know which angle I’m about to take.
4. **Live task updates** – each subtask execution calls `status` or `component`/`wire` channel helpers (e.g., _“Placing 555 timer at x:420 y:300”_). Errors invoke `error`, successes invoke `success`, matching the conversational cadence you get from me when edits land.
5. **Final summary** – when all subtasks finish, the streamer posts the consolidated result (success or failure message plus any returned data). That’s the equivalent of my final reply after I’ve run edits.

Handlers should treat the streamer as their “voice,” narrating every meaningful transition so the UI feels as conversational and transparent as this assistant.

#### 🎯 User Feedback Touchpoints

These checkpoints mirror the major execution steps above—note how the **Context gathering** row aligns with Step 3’s vectorization pass.

| Stage                  | Trigger                     | Streamer channel              | Example message                                   | Purpose                                                                       |
| ---------------------- | --------------------------- | ----------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Intake                 | Prompt accepted             | `info`                        | "Working on it…"                                  | Immediate acknowledgement that the agent is engaged.                          |
| Intent lock            | Step 2 completes            | `status`                      | "Intent locked: ADD_COMPONENT"                    | Confirms the capability the agent committed to.                               |
| Context gathering      | Step 3 or 4                 | `think`                       | "Searching component library"                     | Keeps users aware of background preparation while nothing visual changes.     |
| Vector results         | Post-embedding              | `debug`/`component`           | "Matched NE555 timer (92%)"                       | Surfaces why a specific component or document was selected.                   |
| Subtask execution      | Step 5 loop                 | `status`, `component`, `wire` | "Placing 555 timer at x:420 y:300"                | Narrates each atomic action as it lands on the canvas.                        |
| Error handling         | Any failure                 | `error`                       | "Failed to route wire: pin LED.anode not found"   | Explains blockers immediately with actionable hints.                          |
| Success acknowledgment | Subtask or chain completion | `success`                     | "Component placed successfully"                   | Marks milestones so the UI can celebrate progress.                            |
| Final wrap-up          | Step 6/8                    | `summary`                     | "Circuit assembled with 3 components and 2 wires" | Streams the detailed explanation with suggestions, followed by a TL;DR recap. |

Each capability handler is responsible for selecting the most specific channel (`component`, `wire`, etc.) available; if none applies, fall back to `status` so that no update is lost.

---

### **6️⃣ Step 6 — Final Decision & Circuit Assembly (LLM Call #3)**

- Once subtasks complete, bundle all relevant data:

  - Top component matches
  - User description
  - Partial circuit metadata

- Send to LLM again to finalize the **component selections and layout plan**.
- Output example:

  ```json
  {
    "final_components": [
      { "id": "R1", "type": "Resistor", "value": "330Ω" },
      { "id": "LED1", "type": "LED", "color": "red" },
      { "id": "BAT1", "type": "Battery", "voltage": "9V" }
    ],
    "connections": [
      { "from": "BAT1+", "to": "R1" },
      { "from": "R1", "to": "LED1+" },
      { "from": "LED1-", "to": "BAT1-" }
    ]
  }
  ```

---

### **7️⃣ Step 7 — Render to Canvas**

- Query `components_v2` for exact SVG/symbol data.
- Use coordinates or AI-suggested layout to place components on canvas.
- Draw wires, labels, and finalize circuit structure visually.

---

### **8️⃣ Step 8 — (Optional) Explain, Review, or Export**

- If user requests analysis, explanation, or optimization:

  - Run one more LLM call with the circuit context.
  - Trigger capabilities like `EXPLAIN_CIRCUIT`, `REVIEW_CIRCUIT`, or `GENERATE_NETLIST`.

---

### 📄 Final Explanation Blueprint

When the execution chain reaches its terminal state, the agent emits a layered response that stitches together the streamed breadcrumbs:

- **Comprehensive explanation.** Write 2–4 paragraphs walking through the subtasks completed, including placement coordinates, matched component SKUs, validation steps, and any analysis/review calls that ran. Reference the relevant streamed milestones so the narrative feels continuous.
- **Decision rationale.** Call out the highest-scoring vector matches or planner rationales—why a component or layout was chosen—and mention any assumptions made during execution.
- **Actionable suggestions.** Present a short, prioritized list of follow-up actions (e.g., "Run DRC to confirm clearances", "Save project snapshot") so the user knows what to do next.
- **Current canvas/project state.** Summarize resulting counts (components, nets, warnings) and highlight outstanding TODOs detected during validation.
- **TL;DR recap.** Conclude with a terse, bullet-style summary (2–3 bullets max) so busy users can scan the key outputs and recommendations quickly.

The full explanation plus the TL;DR is persisted in the chat transcript and mirrored via the `summary` channel, giving both the conversational feed and the structured streamer the same authoritative account of the session.

---

### **🧩 Summary Table**

| Step | Action                         | Description                                          | Typical LLM Calls | Notes                                                                    |
| ---- | ------------------------------ | ---------------------------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| 1    | Parse input                    | Receive raw text                                     | -                 | -                                                                        |
| 2    | Classify intent + Process Plan | Decide task + capability and generate full step plan | 1                 | Includes `process` object defining total steps, names, and live statuses |
| 3    | Vectorize (if needed)          | Embed & query DB                                     | -                 | Matches top components                                                   |
| 4    | Expand task                    | Create subtasks plan                                 | 2                 | Breaks high-level goal into atomic actions                               |
| 5    | Execute subtasks               | Perform actions sequentially                         | -                 | Uses `agent.streamer` to broadcast live updates                          |
| 6    | Finalize design                | LLM confirms exact components/layout                 | 3                 | Merges vectors + metadata                                                |
| 7    | Render                         | Draw circuit on canvas                               | -                 | Uses component symbols and coordinates                                   |
| 8    | Explain/review/export          | Optional advanced actions                            | +1                | For knowledge or analysis tasks                                          |

---

✅ **Outcome:**
A clean, modular process that dynamically adjusts the number of LLM calls (1–3+), generates a process plan early, and streams structured status updates for each step.

---

## Capability Payload Reference

Every subtask generated in Step 4 resolves to a unified `CapabilityInvocation` JSON envelope before Step 5 executes it. The fields are consistent across capabilities so the executor, logger, and streamer can make decisions without re-inspecting the natural language prompt.

| Field                   | Type                                                                                                                      | Description                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `capability`            | `Capability`                                                                                                              | One of the values defined in `src/agent/capabilities.ts`.                                 |
| `requiresVectorization` | `boolean`                                                                                                                 | Signals whether Step 3 ran embeddings and whether `vectorContext` is populated.           |
| `requiresSubtasks`      | `boolean`                                                                                                                 | Mirrors the process plan; `true` when this call is part of a multi-step chain.            |
| `payload`               | `object`                                                                                                                  | Capability-specific data described below. Always normalized and validated by the planner. |
| `vectorContext`         | `{ query: string; matches: Array<{ uid: string; name: string; score: number; metadata?: object }>; } \| null`             | Present when vectorization was requested; matches are sorted by similarity.               |
| `process`               | `{ intent: string; step: number; totalSteps: number; status: "pending" \| "success" \| "error"; breadcrumbs: string[]; }` | Mirrors the live progress metadata sent to the streamer.                                  |
| `streamingHints`        | `{ start: string; success: string; error: string; }`                                                                      | Optional canned messages the handler can reuse when pushing updates.                      |

Unless otherwise noted, `payload` keys are required. Optional members are marked with `?`. Coordinates are always expressed in canvas units (Fabric.js pixels), and IDs prefixed with `component_` or `wire_` refer to runtime instances on the canvas, while bare UIDs refer to database records.

### Capability Groups & Vectorization

| Group             | Capabilities                                                                                                         | Requires Vectorization?                                                                                                                      | Notes                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Circuit           | `CREATE_CIRCUIT`, `EDIT_CIRCUIT`, `DELETE_CIRCUIT`                                                                   | No by default                                                                                                                                | Works off project metadata; can be extended to pull project templates later.            |
| Component         | `ADD_COMPONENT`, `READ_COMPONENT`, `UPDATE_COMPONENT`, `DELETE_COMPONENT`, `HIGHLIGHT_COMPONENT`, `CREATE_COMPONENT` | `ADD_COMPONENT`, `CREATE_COMPONENT` default to **true**. Others use vectorization only when the request provides fuzzy names instead of IDs. |
| Wiring            | `CREATE_WIRE`, `DELETE_WIRE`, `UPDATE_WIRE`                                                                          | Conditional                                                                                                                                  | Enabled when endpoints are described textually (e.g., “connect LED anode to resistor”). |
| Analysis          | `RUN_DRC`, `CALCULATE_POWER_CONSUMPTION`, `CALCULATE_LED_RESISTOR`                                                   | No                                                                                                                                           | Operate on in-memory project graph snapshots.                                           |
| Knowledge         | `ASK_KNOWLEDGE_BASE`, `EXPLAIN_COMPONENT`, `EXPLAIN_CIRCUIT`                                                         | Yes                                                                                                                                          | Always combine RAG matches with the prompt.                                             |
| Scaffolding       | `SCAFFOLD_CIRCUIT`                                                                                                   | Yes                                                                                                                                          | Needs component suggestions from the vector index.                                      |
| Review            | `REVIEW_CIRCUIT`, `SUGGEST_OPTIMIZATIONS`                                                                            | Yes                                                                                                                                          | Pulls similar reference designs before critique.                                        |
| Netlist           | `GENERATE_NETLIST`, `GENERATE_BOM`, `PREPARE_FOR_MANUFACTURING`                                                      | No                                                                                                                                           | Consumes canonical project data only.                                                   |
| Project Utilities | `ZOOM_IN`, `ZOOM_OUT`, `PAN_CANVAS`, `SAVE_PROJECT`, `GROUP_COMPONENTS`                                              | No                                                                                                                                           | These are direct canvas/store operations.                                               |

The sections below enumerate each capability with its canonical payload shape and an illustrative JSON snippet.

### Circuit Capabilities

- **`CREATE_CIRCUIT`**

  **Payload schema**

  - `projectId`: `string`
  - `circuitName`: `string`
  - `description?`: `string`
  - `constraints?`: `{ voltage?: number; current?: number; footprint?: string; }`

  **Example**

  ```json
  {
    "capability": "CREATE_CIRCUIT",
    "requiresVectorization": false,
    "requiresSubtasks": true,
    "payload": {
      "projectId": "proj_123",
      "circuitName": "Simple LED Driver",
      "description": "Use a 9V source with current limiting",
      "constraints": { "voltage": 9, "footprint": "through-hole" }
    },
    "process": {
      "intent": "CREATE_CIRCUIT",
      "step": 3,
      "totalSteps": 6,
      "status": "pending",
      "breadcrumbs": ["vectorized", "subtasks"]
    }
  }
  ```

- **`EDIT_CIRCUIT`**

  **Payload schema**

  - `circuitId`: `string`
  - `changes`: `Array<{ path: string; operation: "add" | "update" | "remove"; value?: unknown; }>`

  **Example**

  ```json
  {
    "capability": "EDIT_CIRCUIT",
    "requiresVectorization": false,
    "requiresSubtasks": true,
    "payload": {
      "circuitId": "ckt_main",
      "changes": [
        {
          "path": "metadata.notes",
          "operation": "update",
          "value": "Adjust biasing"
        },
        { "path": "components", "operation": "add", "value": "component_abc" }
      ]
    },
    "process": {
      "intent": "EDIT_CIRCUIT",
      "step": 4,
      "totalSteps": 5,
      "status": "pending",
      "breadcrumbs": ["planning"]
    }
  }
  ```

- **`DELETE_CIRCUIT`**

  **Payload schema**

  - `circuitId`: `string`
  - `force?`: `boolean`

  **Example**

  ```json
  {
    "capability": "DELETE_CIRCUIT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": { "circuitId": "ckt_prototype", "force": false },
    "process": {
      "intent": "DELETE_CIRCUIT",
      "step": 2,
      "totalSteps": 2,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

### Component Capabilities

- **`ADD_COMPONENT`**

  **Payload schema**

  - `componentQuery`: `string`
  - `matchUid?`: `string`
  - `placement`: `{ mode: "auto" | "absolute" | "relative"; x?: number; y?: number; anchor?: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "left" | "right" | "top" | "bottom"; }`
  - `properties?`: `{ value?: string; orientation?: number; labels?: Record<string, string>; }`

  **Example**

  ```json
  {
    "capability": "ADD_COMPONENT",
    "requiresVectorization": true,
    "requiresSubtasks": false,
    "payload": {
      "componentQuery": "NE555 timer",
      "matchUid": "comp_uid_555",
      "placement": { "mode": "relative", "anchor": "top-left" },
      "properties": { "orientation": 90 }
    },
    "vectorContext": {
      "query": "NE555 timer",
      "matches": [
        { "uid": "comp_uid_555", "name": "555 Timer", "score": 0.92 },
        { "uid": "comp_uid_556", "name": "Dual Timer", "score": 0.81 }
      ]
    },
    "process": {
      "intent": "ADD_COMPONENT",
      "step": 5,
      "totalSteps": 6,
      "status": "pending",
      "breadcrumbs": ["vectorized"]
    }
  }
  ```

- **`READ_COMPONENT`**

  **Payload schema**

  - `componentId?`: `string`
  - `componentQuery?`: `string`
  - `properties`: `Array<"metadata" | "pins" | "connections" | "position" | "symbol">`

  **Example**

  ```json
  {
    "capability": "READ_COMPONENT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "componentId": "component_173894",
      "properties": ["metadata", "connections"]
    },
    "process": {
      "intent": "READ_COMPONENT",
      "step": 3,
      "totalSteps": 3,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`UPDATE_COMPONENT`**

  **Payload schema**

  - `componentId?`: `string`
  - `componentQuery?`: `string`
  - `updates`: `{ position?: { x: number; y: number }; rotation?: number; value?: string; labelOverrides?: Record<string, string>; }`

  **Example**

  ```json
  {
    "capability": "UPDATE_COMPONENT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "componentId": "component_555",
      "updates": { "position": { "x": 480, "y": 260 }, "rotation": 180 }
    },
    "process": {
      "intent": "UPDATE_COMPONENT",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`DELETE_COMPONENT`**

  **Payload schema**

  - `componentId?`: `string`
  - `componentQuery?`: `string`
  - `preserveWires?`: `boolean`

  **Example**

  ```json
  {
    "capability": "DELETE_COMPONENT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "componentId": "component_led_1",
      "preserveWires": false
    },
    "process": {
      "intent": "DELETE_COMPONENT",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`HIGHLIGHT_COMPONENT`**

  **Payload schema**

  - `componentId?`: `string`
  - `componentQuery?`: `string`
  - `style`: `{ color?: string; pulse?: boolean; durationMs?: number; }`

  **Example**

  ```json
  {
    "capability": "HIGHLIGHT_COMPONENT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "componentQuery": "current-limiting resistor",
      "style": { "color": "#ffcc00", "pulse": true, "durationMs": 4000 }
    },
    "vectorContext": {
      "query": "current-limiting resistor",
      "matches": [
        { "uid": "comp_uid_r_330", "name": "Resistor 330Ω", "score": 0.87 }
      ]
    },
    "process": {
      "intent": "HIGHLIGHT_COMPONENT",
      "step": 5,
      "totalSteps": 5,
      "status": "pending",
      "breadcrumbs": ["approximate-match"]
    }
  }
  ```

- **`CREATE_COMPONENT`**

  **Payload schema**

  - `spec`: `{ name: string; category: string; pins: Array<{ name: string; type: "input" | "output" | "power" | "ground"; }>; symbolStyle?: object; footprintHints?: string[]; }`
  - `referenceMatches`: `Array<{ uid: string; relevance: number; rationale: string; }>`

  **Example**

  ```json
  {
    "capability": "CREATE_COMPONENT",
    "requiresVectorization": true,
    "requiresSubtasks": true,
    "payload": {
      "spec": {
        "name": "Hall Sensor Module",
        "category": "sensor",
        "pins": [
          { "name": "VCC", "type": "power" },
          { "name": "GND", "type": "ground" },
          { "name": "OUT", "type": "output" }
        ],
        "footprintHints": ["SIP-3", "0.1 inch spacing"]
      },
      "referenceMatches": [
        {
          "uid": "comp_uid_314",
          "relevance": 0.79,
          "rationale": "Similar pinout"
        }
      ]
    },
    "vectorContext": {
      "query": "Hall effect sensor",
      "matches": [
        { "uid": "comp_uid_314", "name": "AH314 Hall Sensor", "score": 0.79 }
      ]
    },
    "process": {
      "intent": "CREATE_COMPONENT",
      "step": 5,
      "totalSteps": 8,
      "status": "pending",
      "breadcrumbs": ["vectorized", "sketching"]
    }
  }
  ```

### Wiring Capabilities

- **`CREATE_WIRE`**

  **Payload schema**

  - `from`: `{ componentId?: string; componentQuery?: string; pin: string; }`
  - `to`: `{ componentId?: string; componentQuery?: string; pin: string; }`
  - `style?`: `{ color?: string; curvature?: number; }`

  **Example**

  ```json
  {
    "capability": "CREATE_WIRE",
    "requiresVectorization": true,
    "requiresSubtasks": false,
    "payload": {
      "from": { "componentId": "component_battery", "pin": "+" },
      "to": { "componentQuery": "led", "pin": "anode" },
      "style": { "color": "#ff0000" }
    },
    "vectorContext": {
      "query": "led",
      "matches": [
        { "uid": "comp_uid_led_red", "name": "LED Red", "score": 0.9 }
      ]
    },
    "process": {
      "intent": "CREATE_WIRE",
      "step": 6,
      "totalSteps": 7,
      "status": "pending",
      "breadcrumbs": ["component-resolution"]
    }
  }
  ```

- **`DELETE_WIRE`**

  **Payload schema**

  - `wireId?`: `string`
  - `pathQuery?`: `{ from: string; to: string; }`

  **Example**

  ```json
  {
    "capability": "DELETE_WIRE",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "wireId": "wire_82473"
    },
    "process": {
      "intent": "DELETE_WIRE",
      "step": 6,
      "totalSteps": 6,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`UPDATE_WIRE`**

  **Payload schema**

  - `wireId`: `string`
  - `updates`: `{ reroute?: Array<{ x: number; y: number }>; style?: { color?: string; thickness?: number; }; }`

  **Example**

  ```json
  {
    "capability": "UPDATE_WIRE",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "wireId": "wire_supply",
      "updates": {
        "reroute": [
          { "x": 300, "y": 220 },
          { "x": 360, "y": 240 }
        ]
      }
    },
    "process": {
      "intent": "UPDATE_WIRE",
      "step": 6,
      "totalSteps": 6,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

### Analysis Capabilities

- **`RUN_DRC`**

  **Payload schema**

  - `scope`: `"board" | "selection"`
  - `rules?`: `string[]`

  **Example**

  ```json
  {
    "capability": "RUN_DRC",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "scope": "board",
      "rules": ["clearance", "short-circuit"]
    },
    "process": {
      "intent": "RUN_DRC",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`CALCULATE_POWER_CONSUMPTION`**

  **Payload schema**

  - `circuitId`: `string`
  - `assumptions?`: `{ supplyVoltage?: number; ambientTempC?: number; }`

  **Example**

  ```json
  {
    "capability": "CALCULATE_POWER_CONSUMPTION",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "circuitId": "ckt_main",
      "assumptions": { "supplyVoltage": 9 }
    },
    "process": {
      "intent": "CALCULATE_POWER_CONSUMPTION",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`CALCULATE_LED_RESISTOR`**

  **Payload schema**

  - `ledForwardVoltage`: `number`
  - `ledCurrent`: `number`
  - `supplyVoltage`: `number`

  **Example**

  ```json
  {
    "capability": "CALCULATE_LED_RESISTOR",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "ledForwardVoltage": 2.1,
      "ledCurrent": 0.02,
      "supplyVoltage": 9
    },
    "process": {
      "intent": "CALCULATE_LED_RESISTOR",
      "step": 3,
      "totalSteps": 3,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

### Knowledge Capabilities

- **`ASK_KNOWLEDGE_BASE`**

  **Payload schema**

  - `question`: `string`
  - `context`: `{ projectId: string; selection?: string[]; }`

  **Example**

  ```json
  {
    "capability": "ASK_KNOWLEDGE_BASE",
    "requiresVectorization": true,
    "requiresSubtasks": false,
    "payload": {
      "question": "What does the 555 timer do in this circuit?",
      "context": { "projectId": "proj_123" }
    },
    "vectorContext": {
      "query": "What does the 555 timer do in this circuit?",
      "matches": [
        { "uid": "doc_appnote_5", "name": "555 Timer Datasheet", "score": 0.78 }
      ]
    },
    "process": {
      "intent": "ASK_KNOWLEDGE_BASE",
      "step": 3,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": ["rag"]
    }
  }
  ```

- **`EXPLAIN_COMPONENT`**

  **Payload schema**

  - `componentId?`: `string`
  - `componentQuery?`: `string`
  - `focus?`: `Array<"function" | "datasheet" | "pins" | "usage">`

  **Example**

  ```json
  {
    "capability": "EXPLAIN_COMPONENT",
    "requiresVectorization": true,
    "requiresSubtasks": false,
    "payload": {
      "componentId": "component_555",
      "focus": ["function", "pins"]
    },
    "vectorContext": {
      "query": "Explain NE555 timer function",
      "matches": [
        {
          "uid": "doc_note_12",
          "name": "Timer application note",
          "score": 0.82
        }
      ]
    },
    "process": {
      "intent": "EXPLAIN_COMPONENT",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": ["rag"]
    }
  }
  ```

- **`EXPLAIN_CIRCUIT`**

  **Payload schema**

  - `circuitId`: `string`
  - `topics?`: `string[]`

  **Example**

  ```json
  {
    "capability": "EXPLAIN_CIRCUIT",
    "requiresVectorization": true,
    "requiresSubtasks": true,
    "payload": {
      "circuitId": "ckt_main",
      "topics": ["timing", "power"]
    },
    "vectorContext": {
      "query": "Explain circuit ckt_main timing",
      "matches": [
        {
          "uid": "doc_reference_clock",
          "name": "Astable timer guide",
          "score": 0.8
        }
      ]
    },
    "process": {
      "intent": "EXPLAIN_CIRCUIT",
      "step": 7,
      "totalSteps": 8,
      "status": "pending",
      "breadcrumbs": ["rag", "drafting"]
    }
  }
  ```

### Scaffolding Capability

- **`SCAFFOLD_CIRCUIT`**

  **Payload schema**

  - `goal`: `string`
  - `constraints?`: `{ requiredComponents?: string[]; voltage?: number; size?: string; }`
  - `seedComponents?`: `Array<{ uid: string; rationale: string; }>`

  **Example**

  ```json
  {
    "capability": "SCAFFOLD_CIRCUIT",
    "requiresVectorization": true,
    "requiresSubtasks": true,
    "payload": {
      "goal": "Prototype a capacitive touch sensor",
      "constraints": { "voltage": 5 },
      "seedComponents": [
        { "uid": "comp_uid_mcu_attiny", "rationale": "Small MCU" }
      ]
    },
    "vectorContext": {
      "query": "capacitive touch sensor parts",
      "matches": [
        {
          "uid": "comp_uid_touch_ic",
          "name": "CapSense Controller",
          "score": 0.84
        }
      ]
    },
    "process": {
      "intent": "SCAFFOLD_CIRCUIT",
      "step": 5,
      "totalSteps": 9,
      "status": "pending",
      "breadcrumbs": ["rag", "layout-plan"]
    }
  }
  ```

### Review Capabilities

- **`REVIEW_CIRCUIT`**

  **Payload schema**

  - `circuitId`: `string`
  - `focusAreas?`: `string[]`

  **Example**

  ```json
  {
    "capability": "REVIEW_CIRCUIT",
    "requiresVectorization": true,
    "requiresSubtasks": true,
    "payload": {
      "circuitId": "ckt_main",
      "focusAreas": ["power", "safety"]
    },
    "vectorContext": {
      "query": "power safety review",
      "matches": [
        {
          "uid": "doc_power_guidelines",
          "name": "Power Design Checklist",
          "score": 0.76
        }
      ]
    },
    "process": {
      "intent": "REVIEW_CIRCUIT",
      "step": 6,
      "totalSteps": 7,
      "status": "pending",
      "breadcrumbs": ["rag", "analysis"]
    }
  }
  ```

- **`SUGGEST_OPTIMIZATIONS`**

  **Payload schema**

  - `circuitId`: `string`
  - `goals?`: `Array<"cost" | "power" | "reliability" | "size">`

  **Example**

  ```json
  {
    "capability": "SUGGEST_OPTIMIZATIONS",
    "requiresVectorization": true,
    "requiresSubtasks": true,
    "payload": {
      "circuitId": "ckt_main",
      "goals": ["power", "size"]
    },
    "vectorContext": {
      "query": "optimize power size",
      "matches": [
        {
          "uid": "doc_low_power_design",
          "name": "Low Power Design Tricks",
          "score": 0.82
        }
      ]
    },
    "process": {
      "intent": "SUGGEST_OPTIMIZATIONS",
      "step": 6,
      "totalSteps": 7,
      "status": "pending",
      "breadcrumbs": ["rag", "tradeoffs"]
    }
  }
  ```

### Netlist & Manufacturing Capabilities

- **`GENERATE_NETLIST`**

  **Payload schema**

  - `projectId`: `string`
  - `format?`: `"kicad" | "altium" | "json"`

  **Example**

  ```json
  {
    "capability": "GENERATE_NETLIST",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "projectId": "proj_123",
      "format": "kicad"
    },
    "process": {
      "intent": "GENERATE_NETLIST",
      "step": 7,
      "totalSteps": 7,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`GENERATE_BOM`**

  **Payload schema**

  - `projectId`: `string`
  - `includePricing?`: `boolean`
  - `distributor?`: `"digikey" | "mouser" | "lcsc" | "octopart"`

  **Example**

  ```json
  {
    "capability": "GENERATE_BOM",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "projectId": "proj_123",
      "includePricing": true,
      "distributor": "digikey"
    },
    "process": {
      "intent": "GENERATE_BOM",
      "step": 7,
      "totalSteps": 7,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`PREPARE_FOR_MANUFACTURING`**

  **Payload schema**

  - `projectId`: `string`
  - `outputs`: `Array<"gerber" | "assembly" | "pick-and-place" | "3d">`

  **Example**

  ```json
  {
    "capability": "PREPARE_FOR_MANUFACTURING",
    "requiresVectorization": false,
    "requiresSubtasks": true,
    "payload": {
      "projectId": "proj_123",
      "outputs": ["gerber", "pick-and-place"]
    },
    "process": {
      "intent": "PREPARE_FOR_MANUFACTURING",
      "step": 8,
      "totalSteps": 9,
      "status": "pending",
      "breadcrumbs": ["export"]
    }
  }
  ```

### Project Utility Capabilities

- **`ZOOM_IN`** / **`ZOOM_OUT`**

  **Payload schema** (shared)

  - `delta`: `number`
  - `pivot?`: `{ x: number; y: number; }`

  **Example**

  ```json
  {
    "capability": "ZOOM_IN",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": { "delta": 0.2, "pivot": { "x": 420, "y": 300 } },
    "process": {
      "intent": "ZOOM_IN",
      "step": 2,
      "totalSteps": 2,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`PAN_CANVAS`**

  **Payload schema**

  - `offset`: `{ x: number; y: number; }`

  **Example**

  ```json
  {
    "capability": "PAN_CANVAS",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": { "offset": { "x": -120, "y": 80 } },
    "process": {
      "intent": "PAN_CANVAS",
      "step": 2,
      "totalSteps": 2,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

- **`SAVE_PROJECT`**

  **Payload schema**

  - `projectId`: `string`
  - `reason?`: `string`

  **Example**

  ```json
  {
    "capability": "SAVE_PROJECT",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": { "projectId": "proj_123", "reason": "Post-component-add" },
    "process": {
      "intent": "SAVE_PROJECT",
      "step": 5,
      "totalSteps": 5,
      "status": "pending",
      "breadcrumbs": ["autosave"]
    }
  }
  ```

- **`GROUP_COMPONENTS`**

  **Payload schema**

  - `componentIds`: `string[]`
  - `groupName?`: `string`

  **Example**

  ```json
  {
    "capability": "GROUP_COMPONENTS",
    "requiresVectorization": false,
    "requiresSubtasks": false,
    "payload": {
      "componentIds": ["component_led_1", "component_res_1"],
      "groupName": "Indicator"
    },
    "process": {
      "intent": "GROUP_COMPONENTS",
      "step": 4,
      "totalSteps": 4,
      "status": "pending",
      "breadcrumbs": []
    }
  }
  ```

---

This reference keeps the planner, executor, and Fabric.js layer aligned. When new capabilities are introduced, extend the table above, specify whether vectorization is mandatory, and document the dedicated `payload` contract to preserve the agent’s deterministic behavior.
