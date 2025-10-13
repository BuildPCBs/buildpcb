### Compressed Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

**Project Context: BuildPCBs**
AI-powered PCB design IDE using Next.js 15 + React 19 + TypeScript + Tailwind CSS 4, Fabric.js 6.7+ for canvas, Zustand for state, Lucide React for icons. Targets professional engineers.
**Development Environment**

- Server: Runs via `pnpm dev --turbopack`. **DO NOT START IT**—always running; use new terminals for testing.
- Hot reload: Automatic.
- Logging: **ALWAYS use `logger` from `@/lib/logger`**, never `console.log`. Available methods:
  - `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
  - Context-specific: `logger.canvas()`, `logger.component()`, `logger.wire()`, `logger.auth()`, `logger.api()`
  - Auto-strips debug logs in production.

**Code Organization & Architecture**

- File Structure:
  - `src/canvas/`: Canvas/Fabric.js components, hooks, UI.
  - `src/components/`: Reusable React components.
  - `src/hooks/`: Custom hooks (prefix with `use`).
  - `src/lib/`: Utils, APIs, shared logic.
  - `src/store/`: Zustand stores.
  - `src/types/`: TypeScript definitions.
  - `src/contexts/`: React contexts.
- Naming: PascalCase for components, camelCase for utils.
- Type Safety: Essential for Fabric.js objects.

**Documentation & File Management Rules**

- ❌ **NEVER CREATE .md FILES** - Do NOT create markdown files under ANY circumstances unless EXPLICITLY instructed
- ❌ **NEVER CREATE .html FILES** - No HTML files except when specifically requested
- ❌ **NO TEST FILES** - Do not create test files
- ❌ **NO DEMO/DOCUMENTATION FILES** - Never create visual demos, guides, or documentation files
- Remove all scripts used while testing
- No top-of-file comments; document in code only
- Canvas-Specific: Ensure cleanup and event handling in Fabric.js

**Code Editing & Rewriting Standards**

- File Safety: Verify rewrites aren't empty and preserve logic.
- Scope Control: Never remove unrelated code unless instructed.
- File Placement: Follow structure guidelines.
- Canvas Integration:
  - Cleanup in `useEffect`.
  - Dispose objects on unmount.
  - Type safety and performance for large canvases.
- React Patterns: Functional components, proper deps, memoization, error boundaries.

<!-- **Response Format & Communication**

- Always start with:
  1. What I understand.
  2. My approach.
  3. Expected outcome.
- Tool Usage: Focus on actions, not tools; efficient reads.
- Code Presentation: Markdown, backticks for files/symbols, explain Fabric.js logic. -->

**Project-Specific Patterns**

- Canvas: Performance, memory, touch, undo/redo.
- State: Zustand global, local for components, separate canvas/UI.
- Error Handling: Boundaries, degradation, user messages.
- Performance: Virtualize lists, debounce, optimize re-renders.

**Debugging & Testing Guidance**

- Check console, types, isolate tests, validate state.
- Consider: Placement validation, routing, layers, export/import, collaboration.
