# BuildPCB Agent Documentation Index

This folder now acts as the jumping-off point for the agent docs **that actually exist** in the repo. Use it to find the live specifications, code entry points, and supporting references that match the current implementation.

## 📚 Primary References

| Resource                                                 | What you’ll find                                                                                                                           | Notes                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [`agent.md`](./agent.md)                                 | End-to-end decision process, streaming feedback map, capability payload contracts, context snapshot lifecycle, final explanation blueprint | **Authoritative narrative** for how the agent behaves today. Start here before touching code. |
| `dev/capability-intents/` (root `dev/`)                  | Per-capability intent guides: planner cues, vectorization knobs, example utterances, payload JSON                                          | Lives outside `src/agent/`, but pairs with `agent.md` for planner → handler expectations.     |
| [`ai-agent-architecture.md`](./ai-agent-architecture.md) | Legacy architecture overview and early interface sketches                                                                                  | Some sections predate the current `AgentContext`; treat as historical context only.           |
| [`notes.txt`](./notes.txt)                               | Scratchpad of experiments, TODOs, and rough ideas                                                                                          | Useful for archaeology, not source of truth.                                                  |

## 🧠 Core Code Entry Points

- [`AgentService.ts`](./AgentService.ts) – Builds `AgentContext`, wires the streaming handler, and bridges to the LLM orchestrator or direct capability execution.
- [`LLMOrchestrator.ts`](./LLMOrchestrator.ts) – Implements the thought/action loop, including message packaging and tool invocation.
- [`tools/index.ts`](./tools/index.ts) – Concrete tool contracts (component search, add component, get canvas state, etc.) used by the orchestrator.
- [`capability-handlers.ts`](./capability-handlers.ts) + `handlers/` – Dispatch table and implementations for each priority bucket of capabilities.
- [`types.ts`](./types.ts) – Source of truth for `AgentContext`, project/canvas snapshots, and result contracts consumed across the agent.

## 🔄 How Docs & Code Connect

1. Read `agent.md` to understand the user-facing workflow, streaming cadence, and capability payload shapes.
2. Consult the intent guides in `dev/capability-intents/` when you need planner-specific cues or example JSON for a capability.
3. Update handlers and tools under `src/agent/` to match the contracts defined in `agent.md`; add new entries to the payload table when introducing a capability.
4. Keep `agent.md` + this README aligned whenever the architecture changes so contributors land on up-to-date guidance.

## ✅ Maintenance Checklist

- When you add or rename documentation, update this index so broken links don’t linger.
- If you change `AgentContext` or streaming semantics, reflect it in both `types.ts` and the **Context Snapshot** section of `agent.md`.
- Prefer referencing `agent.md` rather than duplicating long-form explanations here; this file is intentionally concise.

> Need institutional knowledge that isn’t captured here? Add a short note in `notes.txt` or, if it deserves permanence, expand `agent.md` and link it above.

- **"How does the AI decide what components to use?"** → AI Guidelines
- **"What format do AI responses use?"** → Response Schema
- **"How do we save user progress?"** → State Management
- **"Can users undo changes?"** → Restore Endpoint
- **"How do we make responses interactive?"** → Canvas References
- **"What happens when users continue conversations?"** → Input Parser + State Management

## Getting Started

1. **Read AI Guidelines first** - understand the AI's personality
2. **Check Response Schema** - see the data structures
3. **Understand State Management** - learn how data flows
4. **Browse other files** as needed for specific features

Each file is designed to be read independently, but they're most powerful when used together to create our intelligent PCB design experience.

---

_This documentation supports BuildPCB.ai's mission to deliver enterprise-grade PCB design tools that rival the best CAD software, powered by AI that understands professional engineering requirements._
