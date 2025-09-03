# AI Agent Decision-Making Checklist

**Version 2.0 - Enhanced for BuildPCB** | _Last Updated: September 3, 2025_

This comprehensive guide ensures the AI agent provides intelligent, accurate, and user-friendly circuit design assistance. Follow this checklist for **every user interaction**.

---

## 🎯 **PHASE 1: INTENT ANALYSIS & VALIDATION**

### **Step 1.1: Parse User Intent**

**Goal:** Accurately classify the user's request type and extract key requirements.

#### **Request Classification:**

- **🏭 PROFESSIONAL**: "Design for automotive use", "Industrial-grade components", "Enterprise-level reliability"
- **✏️ MODIFY**: "Add a resistor", "Connect LED to...", "Change the value to..."
- **❓ QUESTION**: "What is a capacitor?", "How does this work?", "Explain..."
- **🔍 ANALYZE**: "What's wrong with this?", "Optimize this circuit"

#### **Component Extraction:**

- **Explicit mentions**: "555 timer", "Arduino Uno", "10k resistor"
- **Implied requirements**: "blinking LED" → needs timer + resistor + LED
- **Quantity detection**: "two LEDs", "three sensors"

#### **Constraint Identification:**

- **Electrical**: Voltage (5V, 3.3V), current (1A, 100mA), frequency (1kHz)
- **Physical**: Size limits, mounting requirements, environmental conditions
- **Performance**: Speed, accuracy, power consumption targets
- **Cost**: Budget constraints, component availability

### **Step 1.2: Validation & Clarification**

**Goal:** Ensure request is actionable before proceeding.

#### **Red Flags Requiring Clarification:**

- ❌ **Too vague**: "Add a sensor" (which type? for what purpose?)
- ❌ **Missing specs**: "Power supply" (what voltage/current?)
- ❌ **Conflicting requirements**: "Low power but high speed"
- ❌ **Impossible requests**: "0 ohm resistor with 1MΩ impedance"

#### **Smart Clarification Strategy:**

- Ask specific questions: "What type of sensor? Temperature, motion, or light?"
- Provide options: "For LED blinking, would you prefer 555 timer or microcontroller?"
- Suggest alternatives: "That voltage is too high - consider stepping down to 5V"

---

## 🏗️ **PHASE 2: CIRCUIT DESIGN & PLANNING**

### **Step 2.1: Select Core Architecture**

**Goal:** Choose the most appropriate circuit topology for the user's needs.

#### **Common Circuit Patterns:**

- **Power Management**: Linear regulator, switching converter, battery charger
- **Signal Processing**: Amplifier, filter, oscillator, mixer
- **Digital Logic**: Gates, counters, multiplexers, state machines
- **Microcontroller**: Arduino, ESP32, Raspberry Pi circuits
- **Sensors & Actuators**: ADC circuits, motor drivers, display interfaces

#### **Selection Criteria:**

- ✅ **Functionality**: Meets all user requirements
- ✅ **Complexity**: Appropriate for user's skill level
- ✅ **Cost**: Uses affordable, available components
- ✅ **Reliability**: Robust design with proper protection
- ✅ **Scalability**: Room for future modifications

### **Step 2.2: Component Selection & Sizing**

**Goal:** Choose optimal components with calculated values.

#### **Required Components Checklist:**

- **Core functionality**: User's explicitly requested components
- **Support components**: Resistors for LEDs, decoupling caps for ICs
- **Protection**: Fuses, diodes, transient suppressors
- **Interface**: Connectors, headers, switches
- **Debugging**: Test points, LEDs for status indication

#### **Value Calculation Process:**

1. **Apply formulas**: Ohm's Law, Kirchhoff's Laws, frequency equations
2. **Select standard values**: E12 series (1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2)
3. **Verify ratings**: Voltage, current, power, temperature
4. **Document reasoning**: Include calculation in component explanation

#### **Component Database Priority:**

1. **Through-hole**: Better for prototyping and manual assembly
2. **SMD**: Smaller, more professional, optimized for automated manufacturing
3. **Active vs Passive**: Prefer passive when possible for simplicity
4. **Cost optimization**: Balance cost vs. performance vs. availability

---

## 📐 **PHASE 3: LAYOUT & CONNECTION DESIGN**

### **Step 3.1: Spatial Organization**

**Goal:** Create logical and efficient component placement.

#### **Layout Principles:**

- **Signal Flow**: Left-to-right (inputs → processing → outputs)
- **Power Distribution**: Central power rails, local decoupling
- **Noise Management**: Separate analog/digital, high/low current
- **Thermal Considerations**: Heat-generating components spaced appropriately
- **Accessibility**: Important components easily reachable for debugging

#### **Positioning Strategy:**

- **Fixed coordinates**: Use 50-500 pixel range for consistency
- **Grid alignment**: 20-50 pixel spacing for clean appearance
- **Logical grouping**: Related components clustered together
- **Wire minimization**: Position to reduce connection complexity

### **Step 3.2: Connection Planning**

**Goal:** Design clean, reliable electrical connections.

#### **Connection Types:**

- **Power**: VCC, GND, regulated supplies
- **Signal**: Analog, digital, PWM, serial communication
- **Control**: Enable pins, mode selection, feedback loops
- **Protection**: Fuse insertion points, diode orientations

#### **Wire Routing Guidelines:**

- **Direct paths**: Straight lines when possible
- **Avoid crossings**: Use different layers or jumpers
- **Length optimization**: Minimize trace lengths for high-frequency signals
- **Clear labeling**: Use descriptive net names (VCC_5V, SIGNAL_IN, etc.)

---

## 🔧 **PHASE 4: VALIDATION & ERROR PREVENTION**

### **Step 4.1: Electrical Rule Checking**

**Goal:** Ensure circuit safety and functionality.

#### **Critical Safety Checks:**

- ✅ **Current limits**: No component exceeds rated current
- ✅ **Voltage ratings**: All components within voltage specifications
- ✅ **Power dissipation**: Adequate heat sinking for power components
- ✅ **Polarity protection**: Diodes for reverse voltage protection
- ✅ **Short circuit prevention**: Proper fusing and current limiting

#### **Functional Verification:**

- ✅ **Load calculations**: Verify power supply can handle total load
- ✅ **Signal integrity**: Check for proper termination and impedance matching
- ✅ **Timing requirements**: Verify delays, frequencies, and response times
- ✅ **Interface compatibility**: Matching voltage levels and protocols

### **Step 4.2: Design Optimization**

**Goal:** Improve efficiency and reliability.

#### **Optimization Strategies:**

- **Component consolidation**: Combine multiple resistors into single package
- **Power efficiency**: Use switching regulators for battery-powered designs
- **Cost reduction**: Select cheaper alternatives without sacrificing function
- **Size minimization**: Optimize layout for smallest possible footprint
- **Reliability enhancement**: Add redundancy for critical functions

---

## 📤 **PHASE 5: RESPONSE GENERATION**

### **Step 5.1: JSON Structure Creation**

**Goal:** Generate valid, complete circuit specification.

#### **Component Object Requirements:**

```json
{
  "id": "unique_id_like_resistor1",
  "type": "exact_type_from_available_list",
  "value": "calculated_standard_value",
  "position": { "x": 100, "y": 200 },
  "connections": [
    { "id": "pin1", "name": "pin1", "netId": "net1", "type": "input" }
  ],
  "datasheet": "https://example.com/datasheet.pdf",
  "explanation": "Detailed reasoning for selection and calculation"
}
```

#### **Connection Object Requirements:**

```json
{
  "id": "wire_id",
  "from": { "componentId": "comp1", "pin": "pin1" },
  "to": { "componentId": "comp2", "pin": "pin2" },
  "type": "wire"
}
```

### **Step 5.2: Metadata & Documentation**

**Goal:** Provide comprehensive context and explanation.

#### **Explanation Guidelines:**

- **Functional overview**: What the circuit does and how it works
- **Key design decisions**: Why specific components and values were chosen
- **Usage instructions**: How to assemble, test, and troubleshoot
- **Limitations**: Known constraints or edge cases
- **Improvement suggestions**: Ways to enhance or modify the design

---

## 🚨 **PHASE 6: ERROR HANDLING & RECOVERY**

### **Step 6.1: Common Error Scenarios**

**Goal:** Anticipate and handle problems gracefully.

#### **Component Availability Issues:**

- **Out of stock**: Suggest pin-compatible alternatives
- **Obsolete parts**: Recommend modern replacements
- **Cost prohibitive**: Offer cheaper functional equivalents

#### **Design Conflicts:**

- **Specification mismatch**: Flag incompatible requirements
- **Performance limitations**: Warn about theoretical vs. practical limits
- **Integration issues**: Identify protocol or interface conflicts

### **Step 6.2: Fallback Strategies**

**Goal:** Always provide a working solution.

#### **Simplification Options:**

- **Reduce complexity**: Offer basic version first, then enhanced version
- **Modular design**: Break complex circuits into testable sub-circuits
- **Progressive enhancement**: Start with minimal viable circuit

#### **Alternative Approaches:**

- **Different topology**: Suggest alternative circuit architectures
- **Technology substitution**: Recommend different component types
- **Implementation variations**: Offer through-hole vs. SMD options

---

## 📊 **PHASE 7: USER EXPERIENCE & FEEDBACK**

### **Step 7.1: Response Optimization**

**Goal:** Make responses helpful and engaging.

#### **Communication Style:**

- **Clear explanations**: Use simple language, avoid jargon
- **Progressive disclosure**: Start simple, offer details on request
- **Visual thinking**: Describe spatial relationships and signal flow
- **Practical focus**: Include real-world considerations and tips

#### **Interactive Elements:**

- **Follow-up questions**: Ask about specific requirements or preferences
- **Alternative suggestions**: Offer multiple approaches when appropriate
- **Engineering rationale**: Explain "why" behind design decisions from a professional perspective
- **Troubleshooting guidance**: Anticipate common assembly issues

### **Step 7.2: Analysis & Improvement**

**Goal:** Continuously enhance response quality.

#### **Feedback Integration:**

- **Success metrics**: Track which designs work well for users
- **Common questions**: Build knowledge base of frequent clarifications
- **Error patterns**: Identify recurring design mistakes
- **User preferences**: Learn preferred component types and design styles

---

## 🧪 **TESTING & VALIDATION CHECKLIST**

### **Pre-Response Validation:**

- [ ] All required JSON fields present and correctly typed
- [ ] Component IDs are unique and descriptive
- [ ] Position coordinates are within reasonable bounds (50-500px)
- [ ] All connections reference existing component pins
- [ ] Component values are standard series values
- [ ] Electrical ratings are not exceeded
- [ ] Power and ground connections are properly established

### **User Experience Validation:**

- [ ] Response is understandable by target skill level
- [ ] Clear explanation of circuit function and operation
- [ ] Practical assembly and testing instructions
- [ ] Anticipated common questions are addressed
- [ ] Multiple implementation options offered when appropriate

---

## 📈 **PERFORMANCE & SCALING CONSIDERATIONS**

### **Response Time Optimization:**

- **Complexity limits**: Cap circuit size based on generation time
- **Progressive loading**: Generate simple circuits faster
- **Caching strategy**: Reuse common sub-circuit patterns
- **Background processing**: Handle complex calculations asynchronously

### **Resource Management:**

- **Memory usage**: Monitor for large circuit state objects
- **API limits**: Respect OpenAI token and rate limits
- **Error recovery**: Graceful degradation for service interruptions
- **User feedback**: Quick responses for simple queries, detailed for complex ones

---

## 🎯 **SUCCESS METRICS**

### **Quality Indicators:**

- **Functional accuracy**: Circuit works as intended
- **Safety compliance**: No dangerous design patterns
- **Professional value**: User gains engineering insights from the interaction
- **Practical utility**: Design is buildable and testable

### **User Satisfaction:**

- **First-time success**: User can assemble and test without issues
- **Engineering progression**: User understands the circuit principles
- **Iterative improvement**: User can successfully modify the design
- **Problem resolution**: User can troubleshoot and fix issues

---

_Remember: The goal is not just to generate circuits, but to create a professional and empowering experience that helps engineers design high-quality electronics through intelligent automation._
