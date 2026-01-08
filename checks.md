# Launch Checklist

## 1. Core Editor Reliability

- [ ] **Canvas State Management**

  - [ ] Verify "New Project" clears canvas/state completely
  - [ ] Validate `useAutoSave` persistence (Project + Chat + Canvas)
  - [ ] Ensure `loadProject` correctly restores all nodes/wires

- [ ] **History System (Critical Hole)**

  - [ ] **Implement Undo stack** (Capture commands/state snapshots)
  - [ ] **Implement Redo stack**
  - [ ] Wire up `Ctrl+Z` / `Ctrl+Y` hotkeys
  - [ ] Add visual Undo/Redo buttons to Toolbar

- [ ] **User Interaction**
  - [ ] **Context Menu Integration**
    - [ ] Verify Right-Click triggers `ContextMenu.tsx`
    - [ ] Wire up "Copy", "Paste", "Delete" actions in menu
    - [ ] Ensure menu closes on outside click/Escape
  - [ ] **Keyboard Shortcuts**
    - [ ] Verify Delete/Backspace works for selection
    - [ ] Verify Ctrl+C/Ctrl+V (Clipboard logic needs implementation?)
    - [ ] Verify Ctrl+S (Manual Save) logic
  - [ ] **Selection Tools**
    - [ ] Verify Click-to-select
    - [ ] **Implement Drag-Selection (Rubberband)** if missing
    - [ ] Verify Shift+Click for multi-select

## 2. Shapes & Tools

- [ ] **Basic Shapes**
  - [ ] Add `ADD_RECT` command & UI tool
  - [ ] Add `ADD_CIRCLE` command & UI tool
  - [ ] Add `ADD_TEXT` command & UI tool
- [ ] **Chat Context**
  - [ ] Verify Chat doesn't conflict with manual canvas edits

## 3. Exports & output

- [ ] **BOM Export**
  - [ ] Generate CSV from `circuit.components`
  - [ ] Download handler
- [ ] **Gerber/Image Export**
  - [ ] Verify PNG Export (High Res) functionality
  - [ ] Assess Gerber feasibility (or add "Coming Soon" placeholder)

## 4. User Experience (Polish)

- [ ] **Analytics & Streaks**
  - [ ] Hook up `ActivityAnalyticsPanel` to real DB logs
  - [ ] Implement `streak-service.ts`
- [ ] **User Menu**
  - [ ] Add Profile/Logout dropdown in TopToolbar
- [ ] **Project Settings**
  - [ ] Allow renaming project
- [ ] **Production Checks**
  - [ ] Run `pnpm build`
  - [ ] Clear console warnings
