<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## 🚀 Project Context: BuildPCB.ai

This is an AI-powered PCB design IDE built with:

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS 4
- **Canvas**: Fabric.js 6.7+ for PCB canvas rendering and manipulation
- **State**: Zustand for state management
- **Icons**: Lucide React for consistent iconography
- **Architecture**: Modern component-based with hooks and context patterns

**Key Focus**: Creating an intuitive, browser-based PCB design tool - "The Figma for Electronics Design"

## Development Environment

**Development server**: Runs via `pnpm dev --turbopack`. **DO NOT START IT. DO NOT RUN IT.**

**ABSOLUTELY NEVER RUN THE DEV SERVER UNDER ANY CIRCUMSTANCES.**
It is always running—starting it yourself will break the workflow and is strictly prohibited.

**New terminal tabs**: When testing, open new terminals instead of stopping existing processes

**Hot reload**: Development server automatically restarts on changes

**Logging**: Use structured logging with appropriate levels

## 📁 Code Organization & Architecture

**File Structure Patterns**:

- `src/canvas/`: Canvas components and Fabric.js integrations (IDEFabricCanvas, hooks, UI components)
- `src/components/`: Reusable React components (auth, icons, layout, ui)
- `src/hooks/`: Custom React hooks for business logic
- `src/lib/`: Utility functions, API clients, shared logic
- `src/store/`: Zustand stores for state management
- `src/types/`: TypeScript type definitions
- `src/contexts/`: React contexts for app-wide state

**Component Naming**: Use PascalCase for components, camelCase for utilities
**Hook Pattern**: Prefix custom hooks with `use` (e.g., `useCanvasInteraction`)
**Type Safety**: Always provide proper TypeScript types, especially for Fabric.js objects

## 🚫 Documentation & File Management Rules

**Markdown File Rules**:

- Do not create or commit new `.md` files after adding a feature unless you are explicitly instructed to do so.
- If you are explicitly instructed to create a markdown file, always add it to the `/dev` directory.
- Never add test files of any kind, including for testing purposes.
- Do not place comments at the top of files; include documentation within the code where appropriate.

**Canvas-Specific**: When working with Fabric.js, ensure proper cleanup and event handling

## ✏️ Code Editing & Rewriting Standards

**File Safety**: When rewriting files completely, always verify the result is not empty and preserves essential logic

**Scope Control**: Never remove unrelated code during a fix unless explicitly instructed

**File Placement**: When creating new files, confirm they're placed in the correct folder based on file structure guidelines

**Canvas Integration**: For Fabric.js components, ensure proper:

- Event listener cleanup in useEffect
- Canvas object disposal when components unmount
- Type safety with fabric.Object extensions
- Performance optimization for large canvases

**React Patterns**: Follow modern React patterns:

- Functional components with hooks
- Proper dependency arrays in useEffect
- Memoization for expensive operations
- Error boundaries for canvas components

## 💬 Response Format & Communication

**Always Start With Summary**: Before any action, begin with:

1. **What I understand**: Clear restatement of your request
2. **My approach**: Step-by-step plan to solve it
3. **Expected outcome**: What you'll get when I'm done

**Example**:

```
Summary: You want me to create a new PCB component selector with drag-and-drop functionality using Fabric.js, integrated with the existing component library.

Approach: I'll create a ComponentSelector component, add drag event handlers, integrate with the canvas store, and update the component library to support the new selector.

Expected: A working component selector that allows dragging components onto the PCB canvas.
```

**Tool Usage**:

- Never mention tool names to you (e.g., don't say "I'll use the replace_string_in_file tool")
- Focus on what I'm doing, not how I'm doing it
- Use tools efficiently - read large chunks rather than many small reads

**Code Presentation**:

- Use proper markdown formatting
- Wrap filenames and symbols in backticks: `ComponentFactory.tsx`
- Provide context for code changes
- Explain complex Fabric.js or canvas logic

## 🎯 Project-Specific Patterns

**Canvas Components**: Always consider:

- Performance impact on large PCBs
- Memory management for fabric objects
- Touch/mobile compatibility
- Undo/redo state management

**State Management**:

- Use Zustand for global state
- Prefer local state for component-specific data
- Keep canvas state separate from UI state

**Error Handling**:

- Implement error boundaries for canvas operations
- Graceful degradation for unsupported browsers
- User-friendly error messages for PCB validation

**Performance**:

- Virtualize large component lists
- Debounce canvas interactions
- Optimize re-renders with React.memo and useMemo

## 🔧 Debugging & Testing Guidance

**When I encounter issues**:

1. Check browser console for Fabric.js errors
2. Verify TypeScript types are correct
3. Test canvas operations in isolation
4. Validate state changes in dev tools

**Common PCB-specific scenarios to consider**:

- Component placement validation
- Wire routing conflicts
- Layer management
- Export/import functionality
- Real-time collaboration features
