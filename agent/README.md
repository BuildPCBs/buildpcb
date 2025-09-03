# BuildPCB.ai Agent Documentation Overview

## What's This About?

This folder contains the complete documentation for BuildPCB.ai's AI agent system - the brain behind our "Figma + Cursor for Electronics Design" platform. Think of this as your roadmap to understanding how our AI helps users design PCBs.

## Quick Navigation

### 🎯 **Core Agent Behavior**

- **[AI Agent Guidelines](./ai-agent-guidelines.md)** - The rulebook for how our AI thinks and responds
- **[User Input Parser](./user-input-parser.md)** - How we understand what users actually want

### 🔧 **Technical Specifications**

- **[Circuit Response Schema](./circuit-response-schema.md)** - The exact format for all AI responses
- **[Circuit State Management](./circuit-state-management.md)** - How we save and load circuit data across sessions

### 🔄 **System Operations**

- **[Restore Endpoint Documentation](./restore-endpoint-docs.md)** - API for undoing changes and recovering data
- **[Canvas Reference System](./canvas-reference-system.md)** - Making AI responses clickable to highlight parts on screen

## The Big Picture

### How It All Works Together

```
User Types Request → [Input Parser] → [AI Guidelines] → [Response Schema]
                                           ↓
Canvas Updates ← [Canvas References] ← AI Response
                                           ↓
                                    [State Management] → [Restore System]
```

### What Each File Does

#### 🤖 **AI Agent Guidelines**

_The personality and rules for our AI_

- How to select the right components
- What explanations to provide
- Educational approach to circuit design
- Integration with Fabric.js canvas
- Quality standards and error handling

**Key Point**: This makes our AI helpful, not just technically correct.

#### 📝 **User Input Parser**

_Understanding what users really want_

- Decides if user wants to create new circuit or edit existing
- Figures out when to just answer questions vs. trigger the AI agent
- Handles context from previous conversations
- Manages different types of requests (generation, modification, learning)

**Key Point**: Prevents the AI from overreacting to simple questions.

#### 📋 **Circuit Response Schema**

_The exact format for everything the AI outputs_

- TypeScript interfaces for all responses
- Component data structure (what every resistor, LED, etc. must have)
- Validation rules to prevent broken circuits
- Integration points with our canvas system

**Key Point**: Ensures AI responses always work with our frontend.

#### 💾 **Circuit State Management**

_Keeping track of user's work across sessions_

- How circuit data gets saved automatically
- Loading previous work when user returns
- Handling multiple people editing same circuit
- Preventing data loss during crashes

**Key Point**: Users never lose their work, conversations continue seamlessly.

#### ⏪ **Restore Endpoint Documentation**

_The "undo" system for everything_

- API for rolling back to previous versions
- Emergency recovery when things go wrong
- Selective restoration (fix just one component)
- Bulk operations for system failures

**Key Point**: Users can always go back when changes don't work out.

#### 🎯 **Canvas Reference System**

_Making AI responses interactive_

- Clickable text that highlights components on screen
- Special markdown syntax for linking responses to canvas
- Animation effects and visual feedback
- Smart highlighting based on what user is doing

**Key Point**: Bridges the gap between AI text and visual design.

## Common Workflows

### 🆕 **New Circuit Design**

1. User describes what they want → **Input Parser** determines it's a generation request
2. **AI Guidelines** help select appropriate components
3. Response follows **Circuit Response Schema** format
4. **Canvas References** make explanation clickable
5. **State Management** saves the new circuit

### ✏️ **Editing Existing Circuit**

1. **State Management** loads current circuit data
2. **Input Parser** identifies what needs to change
3. **AI Guidelines** suggest modifications
4. **Response Schema** formats the changes as patches
5. **Canvas References** highlight affected components
6. **Restore System** creates backup before applying changes

### 🚨 **Error Recovery**

1. Something goes wrong with circuit data
2. **State Management** detects corruption
3. **Restore System** offers recovery options
4. User chooses what to restore
5. **Canvas References** show what was recovered

## For Developers

### 🏗️ **Implementation Order**

1. Start with **Circuit Response Schema** - nail down the data format
2. Implement **State Management** - get saving/loading working
3. Add **Restore System** - safety net for development
4. Build **Canvas References** - make responses interactive
5. Fine-tune **AI Guidelines** - improve response quality
6. Optimize **Input Parser** - handle edge cases

### 🧪 **Testing Strategy**

- **Schema**: Validate all TypeScript interfaces with real data
- **State**: Test concurrent editing, corruption recovery, large circuits
- **Restore**: Verify all restore types work, data loss prevention
- **Canvas**: Check highlighting works across zoom levels, mobile
- **AI**: Test response quality, component selection accuracy
- **Parser**: Edge cases, ambiguous requests, context switching

### 🚀 **Performance Considerations**

- **Large Circuits**: State compression, progressive loading
- **Real-time**: Efficient canvas updates, debounced highlighting
- **Memory**: Snapshot retention policies, garbage collection
- **Network**: Differential updates, offline capability

## Questions This Documentation Answers

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

_This documentation supports BuildPCB.ai's mission to make electronics design as intuitive as graphic design, powered by AI that actually understands circuits._
