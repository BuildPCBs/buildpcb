# Framing & Layout System Rules for BuildPCB.ai

## 1. Conceptual & Hierarchical Rules

- **Frames are Containers, Not Components:** A frame is a layout and organizational tool, not an electrical component. It has no pins, no electrical properties, and should not be included in the final circuit simulation or Bill of Materials (BOM).
- **Establish Hierarchy:** Frames introduce a parent-child relationship. Any component, wire, or other frame placed inside a frame becomes its "child." This creates a scene graph or a hierarchy tree.
- **Nesting is Supported:** Frames can be nested inside other frames to create sub-sections (e.g., a "Power Supply" frame could contain a "Voltage Regulation" sub-frame).
- **Local Coordinate System:** Each frame establishes its own (0,0) coordinate origin at its top-left corner for its children. This means a child component's position is relative to its parent frame, not the main canvas.

---

## 2. Visual & Properties Rules

- **Visible Boundary:** A frame must have a clear visual boundary (e.g., a border or a background color) to define its area.
- **Mandatory Title:** Every frame must have a title (e.g., "Power Supply," "MCU Block"). The title should be displayed prominently in a corner of the frame (typically the top-left) and should always be visible.
- **Customizable Appearance:** Users should be able to change the visual properties of a frame, such as its background color, border color, and border style (solid, dashed). This allows for visual coding of different circuit sections.
- **Content Clipping (Optional):** You can offer an option for frames to "clip content," where any part of a child object that extends beyond the frame's boundaries is hidden.

---

## 3. Interaction & Behavior Rules

- **Moving a Frame Moves Its Children:** When a user moves a parent frame, all of its child objects (components, wires, sub-frames) must move with it, maintaining their relative positions within the frame.
- **Resizing a Frame Does Not Resize Children:** When a user resizes a frame, the components and other objects inside should not be scaled. The frame's boundary simply expands or contracts around them.
- **Reparenting on Drag-and-Drop:**
  - When a component is dragged _into_ the boundary of a frame, it should automatically become a child of that frame.
  - When a component is dragged _out_ of its parent frame, it should be "reparented" to the new container it's dropped into (which could be another frame or the main canvas).
- **Intelligent Wire Handling:** Wires that connect a component inside a frame to a component outside of it must automatically re-route when the frame is moved. The connection points (pins) should remain anchored, and the wire path should be recalculated.

---

## 4. AI Agent Integration Rules

- **Organizational Generation:** When the AI generates a circuit, it should use frames to logically group the components. For example, it should create separate frames for the "Power Supply," "Microcontroller," and "Sensor Interface."
- **Targeted Modifications:** The AI should be able to understand context from frames. A user command like "increase the filtering in the power supply" should cause the AI to only modify components within the "Power Supply" frame.
- **Frame Creation on Request:** The AI should be able to create and populate frames based on user commands, such as "put all the input protection components into a frame called 'Input Stage'."
- **Explanation via Frames:** The AI's explanations should reference the frames it created. For example: "Inside the **Power Supply frame**, I've included a voltage regulator (U1) and two decoupling capacitors (C1, C2) to provide stable 5V power."

---

## 5. Selection & Editing Rules

- **Frame Selection Priority:** When clicking on overlapping objects, frames should have lower selection priority than components and wires to avoid accidentally selecting the frame when trying to select its contents.
- **Bulk Selection Within Frames:** Users should be able to select all children of a frame using a keyboard shortcut (e.g., Ctrl+A while the frame is selected) or by double-clicking the frame's background.
- **Frame Editing Modes:** Provide distinct modes for editing frame properties (title, appearance) vs. editing its contents. This prevents accidental modifications to the frame when working on components inside it.
- **Locked Frames:** Users should be able to "lock" frames to prevent accidental movement or resizing, while still allowing interaction with the contents inside.
- **Frame Snapping:** When moving or resizing frames, they should snap to a grid or to other frames for consistent alignment and professional appearance.

---

## 6. Export & Import Rules

- **Frame Preservation in Exports:** When exporting the PCB design (e.g., to Gerber files or PDF), frames should be included as visual annotations or layers, but not as physical components.
- **Frame Metadata Export:** Export frame titles and hierarchies as metadata that can be imported back, preserving the organizational structure.
- **Import Frame Recognition:** During import, the system should attempt to reconstruct frames based on component groupings and naming patterns in the imported data.
- **Cross-Platform Compatibility:** Frame data should be exportable in standard formats (JSON, XML) that can be understood by other EDA tools, even if they don't support frames natively.

---

## 7. Performance & Optimization Rules

- **Lazy Loading for Large Frames:** For frames containing many components, implement lazy rendering where child objects are only fully rendered when the frame is visible or zoomed into.
- **Frame Culling:** Don't render frames or their contents that are outside the current viewport to improve performance on large designs.
- **Memory Management:** When frames are deleted, ensure all child objects and their associated memory are properly cleaned up to prevent memory leaks.
- **Rendering Optimization:** Use efficient rendering techniques like canvas batching for frames with many child objects to maintain smooth performance.

---

## 8. Accessibility & Usability Rules

- **Keyboard Navigation:** Users should be able to navigate between frames using keyboard shortcuts (e.g., Tab to cycle through frames, Enter to enter/exit frame editing mode).
- **Screen Reader Support:** Frame titles and hierarchies should be accessible to screen readers, with proper ARIA labels and descriptions.
- **High Contrast Mode:** Frame boundaries and titles should remain clearly visible in high contrast mode for users with visual impairments.
- **Touch-Friendly Interactions:** On touch devices, frames should have larger touch targets for resizing handles and selection areas.

---

## 9. Error Handling & Validation Rules

- **Frame Overlap Prevention:** Prevent frames from overlapping in ways that could confuse the hierarchy or make components inaccessible.
- **Orphaned Component Detection:** Warn users when components exist outside of any frame, suggesting they be placed in appropriate frames for better organization.
- **Circular Reference Prevention:** Prevent frames from being nested in ways that create circular references in the hierarchy.
- **Data Integrity Checks:** Regularly validate that all child objects properly reference their parent frames and that frame boundaries contain all their declared children.

---

## 10. Integration with Other Tools

- **Schematic Capture Integration:** Frames should integrate seamlessly with schematic capture tools, allowing frames to be converted to hierarchical schematic blocks.
- **Simulation Tool Compatibility:** When exporting for circuit simulation, frames should be treated as black boxes or subcircuits with defined interfaces.
- **Version Control Awareness:** Frame hierarchies should be tracked in version control, allowing users to see how organizational structure changes over time.
- **Plugin Architecture:** Provide APIs for third-party plugins to interact with frames, such as custom frame types or automated frame generation based on component analysis.

---

## 11. Undo/Redo & History Rules

- **Atomic Frame Operations:** Frame creation, deletion, moving, and resizing should be treated as atomic operations in the undo/redo system.
- **Hierarchical Undo:** When undoing a frame operation, all child operations should also be undone to maintain consistency.
- **State Preservation:** Frame states (position, size, appearance, hierarchy) should be fully preserved in undo/redo operations.
- **Selective Undo:** Allow users to undo operations within a specific frame without affecting changes in other parts of the design.

---

## 12. Collaboration & Multi-User Rules

- **Frame Ownership:** In collaborative environments, frames can have owners or permission levels to control who can modify them.
- **Change Synchronization:** Frame modifications should be synchronized across all users in real-time, with conflict resolution for simultaneous edits.
- **Frame Comments:** Allow users to add comments or notes to frames that are visible to all collaborators.
- **Version Merging:** When merging design versions, frame hierarchies should be intelligently merged, preserving organizational structure where possible.
