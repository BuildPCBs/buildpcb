# User Input Parser

## Purpose

Parse user requests to determine what's included, what the system decides, and what the user has already decided. Handle cases where a prompt might need a text response rather than triggering the AI agent.

## Input Classification

### User Intent Categories

1. **Circuit Generation** - User wants a new circuit designed
2. **Circuit Modification** - User wants to edit existing circuit
3. **Component Query** - User asking about specific components
4. **Educational** - User wants to learn about electronics
5. **Text Response Only** - Simple questions not requiring agent action

### Parsing Rules

#### What's Included (User Provided)

- Explicit component requirements ("I need a 555 timer")
- Specifications ("5V power supply", "LED brightness control")
- Constraints ("must fit on breadboard", "low power consumption")
- Existing circuit context (if editing)

#### What System Decides (AI Agent)

- Component values (resistor ohm values, capacitor ratings)
- Physical layout and positioning
- Wire routing and connections
- Component explanations and reasoning
- Datasheet selections

#### What User Already Decided (Preserved)

- Locked component positions
- Fixed component values
- Approved connections
- Design constraints

### Response Mode Decision Tree

```
User Input → Parse Intent
    ├── Simple Question? → Text Response Only
    ├── Circuit Request? → Route to AI Agent
    │   ├── Has existing circuit? → Edit Mode
    │   └── No existing circuit? → Full Generation Mode
    └── Component Query? → Datasheet Lookup + Text Response
```

### Possible Additions User Might Add

- Power requirements after initial design
- Additional components to existing circuit
- Performance constraints
- Cost limitations
- Size/form factor requirements
- Environmental considerations (temperature, humidity)

## Examples

### Full Generation Request

```
"Design a temperature monitoring system with Arduino"
→ Mode: full, Route to AI Agent
```

### Edit Request

```
"Add an LED indicator to my existing circuit"
→ Mode: edit, Route to AI Agent with context
```

### Text Only

```
"What's the difference between NPN and PNP transistors?"
→ Text response, no agent needed
```
