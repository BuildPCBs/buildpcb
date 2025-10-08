# AI Agent Architecture (Current BuildPCB Stack)

> Last updated: October 2025 — mirrors the workflow described in `agent.md` and the implementation under `src/agent/`.

## 1. High-Level Flow

```
User intent → AgentService.execute → (LLM Orchestrator ⇄ Tools) → Capability handlers → Canvas & project state
```

1. **AgentService** receives the natural-language command, builds the `AgentContext`, and hands the request to the orchestrator (or a direct capability in the legacy path).
2. **LLMOrchestrator** runs the thought/action loop: packaging messages, streaming “think/status” updates, calling tools, and emitting the final response.
3. **Agent tools** (component search, add component, get canvas state, draw wire, etc.) execute against real project data and return observations to the loop.
4. **Capability handlers** mutate the canvas/project via Fabric.js + Zustand stores while publishing streamer events for the UI.
5. **Final explanation + TL;DR** are streamed through the `summary` channel and persisted in the chat transcript.

## 2. Core Modules

| Module                | Location                                                   | Responsibility                                                                             |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AgentService`        | `src/agent/AgentService.ts`                                | Builds `AgentContext`, validates canvas state, routes to orchestrator or direct handlers.  |
| `LLMOrchestrator`     | `src/agent/LLMOrchestrator.ts`                             | Thought/action loop with OpenAI; manages conversation state and tool invocation.           |
| `StreamingHandler`    | `src/agent/StreamingHandler.ts`                            | Typed channels (`status`, `think`, `component`, `wire`, `summary`, etc.) that feed the UI. |
| `capability-handlers` | `src/agent/capability-handlers.ts` & `src/agent/handlers/` | Dispatch table + implementation for each capability priority tier.                         |
| `tools`               | `src/agent/tools/index.ts`                                 | Tooling surface exposed to the LLM (search, placement, canvas inspection, wiring).         |
| `types`               | `src/agent/types.ts`                                       | Contracts for `AgentContext`, canvas/project snapshots, streamer API, and handler results. |

## 3. AgentContext (Runtime Snapshot)

```ts
export interface AgentContext {
  canvas: AgentCanvasContext; // Fabric.js handle + helpers
  project: AgentProjectContext; // Zustand-sourced project metadata & circuit graph
  streamer: AgentStreamer; // Structured channels for UI feedback
  userId?: string; // Injected when auth is active
}
```

- **Canvas context**: Built via `canvasCommandManager`; exposes `isCanvasReady`, `getObjects`, `getActiveObjects`, and `requestRenderAll` so handlers can reason about current selections and repaint safely.
- **Project context**: Derived from `useProjectStore`; includes `projectId`, `versionId`, `projectName`, `circuit`, `isDirty`, and `lastSaved` timestamp.
- **Streamer**: The same `StreamingHandler` instance that the UI subscribes to; replaces `console.log` with structured updates.
- **User identity**: Pulled from `authStorage` when available, allowing handlers to scope operations per user.

Every call to `AgentService.execute` rebuilds this snapshot. The API layer further enriches the prompt with:

- A **canvas summary** (`formatCanvasStateForPrompt`) listing component counts, key placements, connection totals, zoom level, and selection details.
- A **project summary** (`formatProjectContextForPrompt`) capturing metadata, tags, highlighted components, and top nets.
- A **conversation window** (`conversationHistory`) trimmed on the client (latest 200 turns) to keep the LLM grounded in recent context.

## 4. Request Lifecycle

1. **Input + capability catalog** enter the agent. The LLM is restricted to the enums in `capabilities.ts`.
2. **Intent classification (LLM call #1)** returns the primary capability, complexity, vectorization/subtask flags, and a process plan. Streamer announces intake and intent lock.
3. **Vectorization (conditional)** embeds the user request and queries the component vector DB. Matches populate `vectorContext` for downstream handlers.
4. **Subtask expansion (LLM call #2)** emits `CapabilityInvocation` envelopes when multi-step execution is required.
5. **Subtask execution** iterates through envelopes, invoking capability handlers and streaming `status`/`component`/`wire` updates. Tool calls may interleave for additional data.
6. **Finalization (LLM call #3)** blends vector matches, subtasks, and project state into the finished component/wire plan or analytic output.
7. **Rendering & optional explain/review/export** dispatch dedicated capabilities (`GENERATE_NETLIST`, `REVIEW_CIRCUIT`, etc.) when requested.
8. **Comprehensive explanation + TL;DR** stream via the `summary` channel and are persisted so chat history mirrors the UI.

See the “User Feedback Touchpoints” and “Capability Payload Reference” sections of `agent.md` for the granular streaming map and JSON contracts.

## 5. Capability Taxonomy (Current)

The planner dispatches to the capabilities documented in `agent.md`:

- **Circuit**: `CREATE_CIRCUIT`, `EDIT_CIRCUIT`, `DELETE_CIRCUIT`
- **Component**: `ADD_COMPONENT`, `READ_COMPONENT`, `UPDATE_COMPONENT`, `DELETE_COMPONENT`, `HIGHLIGHT_COMPONENT`, `CREATE_COMPONENT`
- **Wiring**: `CREATE_WIRE`, `DELETE_WIRE`, `UPDATE_WIRE`
- **Analysis**: `RUN_DRC`, `CALCULATE_POWER_CONSUMPTION`, `CALCULATE_LED_RESISTOR`
- **Knowledge**: `ASK_KNOWLEDGE_BASE`, `EXPLAIN_COMPONENT`, `EXPLAIN_CIRCUIT`
- **Scaffolding**: `SCAFFOLD_CIRCUIT`
- **Review**: `REVIEW_CIRCUIT`, `SUGGEST_OPTIMIZATIONS`
- **Netlist & Manufacturing**: `GENERATE_NETLIST`, `GENERATE_BOM`, `PREPARE_FOR_MANUFACTURING`
- **Project Utilities**: `ZOOM_IN`, `ZOOM_OUT`, `PAN_CANVAS`, `SAVE_PROJECT`, `GROUP_COMPONENTS`

Vectorization defaults, payload schemas, and streaming hints for each capability live in `agent.md` and the per-capability guides in `dev/capability-intents/`.

## 6. Tooling Layer

Tools exposed to the orchestrator (defined in `tools/index.ts`):

1. `component_search` — Semantic + fuzzy lookup in `components_v2`, returning pin metadata for placement.
2. `add_component` — Places components via `canvasCommandManager`, including auto-positioning heuristics.
3. `get_canvas_state` — Serialises the live canvas for reasoning and validation.
4. `draw_wire`, `delete_component`, `highlight_component`, etc. — Mutate the canvas while preserving undo/redo history.

All tool executions send `status`/`think` updates through the streamer so the UI reflects work-in-progress even before a handler resolves.

## 7. Extending the Architecture

- **Adding a capability**: Create the enum entry in `capabilities.ts`, document the payload/streaming expectations (`agent.md` + `dev/capability-intents`), and implement the handler under `handlers/`.
- **Adding a tool**: Implement the function in `tools/index.ts`, export its schema via `getToolDefinitions`, and update `agent.md` if planner behavior changes.
- **Modifying context**: Adjust `AgentService.buildContext`, extend types in `types.ts`, and refresh the “Context Snapshot” section of `agent.md` plus this file.
- **Streaming conventions**: Always prefer `StreamingHandler` channels over `console`; follow the touchpoints table to keep UX consistent.

## 8. Related Documents

- [`agent.md`](./agent.md) — Day-to-day operational narrative, streaming map, capability payload reference.
- [`README.md`](./README.md) — Documentation index and maintenance checklist.
- `dev/capability-intents/*.md` — Planner guidance per capability (utterances, vectorization strategy, example JSON).

This architecture note stays high-level; treat `agent.md` as the authoritative spec and the source files above as the executable truth.
