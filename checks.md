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
  - [ ] Confirm exports respect board scale, DPI, and transparent backgrounds
  - [ ] Validate export metadata (project name, revision, timestamp)
  - [ ] Add automated regression test comparing sample exports vs. goldens
  - [ ] Wire exports to activity log so users see status/toasts
  - [ ] Ensure long-running exports show progress + cancellation

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

## 5. Performance & Stability

- [ ] Load stress projects (1k+ nodes) and monitor FPS + memory
- [ ] Profile undo/redo snapshots to avoid Fabric object leaks
- [ ] Confirm autosave + history clean up timers/listeners on unmount
- [ ] Measure initial load + project restore times, set performance budget
- [ ] Validate canvas interactions on integrated GPU laptops + tablets

## 6. Cross-Platform QA & Accessibility

- [ ] Browser/device matrix (Chrome, Edge, Safari, Firefox, iPad) signed off
- [ ] Verify touch gestures (pan/zoom/selection) parity with mouse
- [ ] Offline/poor-network autosave + Supabase error UX
- [ ] Keyboard-only navigation for toolbar, context menu, dialogs
- [ ] ARIA roles/labels + focus outlines for interactive controls
- [ ] Color contrast + high-contrast theme validation on canvas overlays

## 7. Security & Compliance

- [ ] Supabase Row Level Security + auth token refresh verified
- [ ] Sanitize chat prompts, text nodes, file names before persistence/export
- [ ] Content Security Policy + headers audited for Next.js deployment
- [ ] Audit logging for destructive actions (delete project, bulk delete)
- [ ] Permissions review for export endpoints + rate limiting

## 8. Build, Release & Rollback

- [ ] CI passes (lint, type-check, unit/integration workflows)
- [ ] `pnpm build` artifact smoke-tested on staging env
- [ ] Environment variables + Supabase keys validated per environment
- [ ] Version tag + changelog prepared; rollback plan documented
- [ ] Feature flags toggles verified for risky features (exports, history)

## 9. Data & Export Integrity

- [ ] Validate BOM CSV schema with downstream consumers (column order/types)
- [ ] Ensure Gerber/PNG exports embed revision + units metadata
- [ ] Run exports through external viewers (e.g., Gerbv, KiCad, Photoshop)
- [ ] Confirm exported files stored/streamed securely, auto-clean temp files
- [ ] Double-check unit tests covering serialization/deserialization of projects

## 10. Monitoring & Support Readiness

- [ ] `logger.*` sinks wired to observability (Sentry/Logtail/etc.)
- [ ] Error boundaries show actionable retry/support messaging
- [ ] Health checks + uptime alerts configured for Supabase + Next API routes
- [ ] Support runbook: triage steps for canvas/export failures
- [ ] In-app help link or quickstart overlay accessible from toolbar

## 11. Documentation & Onboarding

- [ ] Update README/onboarding to cover export workflow + limitations
- [ ] Create quickstart or guided tour for first-time users
- [ ] Internal playbook for QA to verify exports before every release
- [ ] Capture known issues + future roadmap in issue tracker for transparency
