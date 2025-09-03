# User Input Parser

**Version 1.0 - Professional Engineering Focus** | _Last Updated: September 3, 2025_

This document defines how BuildPCB.ai's AI agent system parses and understands user input to provide professional-grade circuit design assistance.

---

## 🎯 **Core Purpose**

The User Input Parser is the first line of intelligence in our AI agent system. It transforms natural language requests from professional engineers into structured, actionable data that drives the entire circuit design workflow.

**Key Principle**: Never assume educational intent - always prioritize professional engineering requirements.

---

## 🔄 **Parsing Pipeline**

### **Stage 1: Intent Classification**

#### **Primary Request Types**

1. **🔧 GENERATE** - Create new circuits from specifications

   - "Design a 5V power supply circuit"
   - "Create an H-bridge motor driver"
   - "Build a temperature control system"

2. **✏️ MODIFY** - Edit existing circuit designs

   - "Add ESD protection to the input"
   - "Change the op-amp to a rail-to-rail type"
   - "Replace the microcontroller with a more powerful one"

3. **❓ ANALYZE** - Technical analysis and optimization

   - "What's the power consumption of this circuit?"
   - "Will this work with automotive temperature ranges?"
   - "Optimize for lowest EMI"

4. **🔍 VALIDATE** - Check design integrity
   - "Are there any short circuits?"
   - "Check component ratings against requirements"
   - "Verify signal integrity"

#### **Context Detection**

- **Industry Context**: Automotive, industrial, consumer, medical
- **Performance Requirements**: Speed, power, reliability, cost
- **Environmental Factors**: Temperature, humidity, vibration
- **Regulatory Standards**: Safety, EMI, certifications

### **Stage 2: Entity Extraction**

#### **Component Recognition**

**Explicit Components:**

- Standard ICs: "STM32 microcontroller", "LM358 op-amp", "TL072 audio amp"
- Passive Components: "100nF capacitor", "10kΩ resistor", "100µH inductor"
- Active Components: "IRF540 MOSFET", "1N4001 diode", "LED indicator"

**Implied Components:**

- "PWM motor control" → Timer + MOSFET + protection
- "Sensor interface" → ADC + filtering + signal conditioning
- "Power regulation" → Rectifier + filter + regulator + protection

#### **Parameter Extraction**

**Electrical Parameters:**

- Voltage: "5V supply", "3.3V logic", "24V industrial"
- Current: "1A load", "100mA sensor", "10A motor"
- Frequency: "1MHz clock", "100kHz PWM", "50Hz mains"
- Power: "10W output", "500mW dissipation", "2kW motor"

**Performance Requirements:**

- Accuracy: "±1% tolerance", "0.1°C resolution"
- Speed: "100ksps sampling", "1µs response time"
- Reliability: "MTBF 100,000 hours", "industrial temperature range"

### **Stage 3: Context Integration**

#### **Canvas State Awareness**

When canvas context is available, the parser considers:

- **Existing Components**: "Add another LED to match the existing ones"
- **Current Connections**: "Connect the new sensor to the ADC input"
- **Design Patterns**: "Make it consistent with the power supply design"
- **Available Space**: "Fit within the current board outline"

#### **Conversation History**

Maintains context across interactions:

- **Previous Decisions**: "Use the same regulator as before"
- **Unresolved Questions**: "You asked about EMI - here's the filter"
- **Iterative Refinement**: "Increase the current rating as discussed"

---

## 🏗️ **Professional Engineering Focus**

### **Industry-Specific Parsing**

#### **Automotive Applications**

- EMC/EMI compliance requirements
- Temperature range: -40°C to +125°C
- Load dump protection
- Reverse battery protection

#### **Industrial Control**

- 24V DC power systems
- Isolation requirements (1kV, 4kV)
- Surge protection
- Grounding schemes

#### **Consumer Electronics**

- Cost optimization
- Size constraints
- Battery life considerations
- User safety requirements

#### **Medical Devices**

- Isolation barriers
- Leakage current limits (<100µA)
- Reliability requirements (MTBF >100,000 hours)
- Regulatory compliance (IEC 60601)

### **Quality Standards**

#### **Component Selection Criteria**

1. **Reliability**: Industrial-grade components preferred
2. **Availability**: Long-term supply assurance
3. **Cost**: Balance performance vs. BOM cost
4. **Standards**: Compliance with industry norms

#### **Design Rule Checks**

- **Power Integrity**: Adequate decoupling, power planes
- **Signal Integrity**: Impedance matching, termination
- **Thermal Management**: Heat dissipation, component spacing
- **EMI Control**: Filtering, shielding, grounding

---

## ⚡ **Real-time Processing**

### **Response Time Optimization**

- **Fast Path**: Simple requests (<100ms processing)
- **Standard Path**: Complex analysis (<500ms processing)
- **Deep Analysis**: Full simulation/validation (<2s processing)

### **Progressive Enhancement**

1. **Immediate Response**: Basic acknowledgment
2. **Structured Output**: Parsed request details
3. **Canvas Preview**: Visual design suggestions
4. **Validation Results**: Design rule checking

---

## 🔧 **Integration Points**

### **AI Agent Interface**

```typescript
interface ParsedUserInput {
  intent: RequestIntent;
  entities: ExtractedEntities;
  context: EngineeringContext;
  requirements: DesignRequirements;
  constraints: TechnicalConstraints;
}
```

### **Canvas Integration**

- **Component Placement**: Suggest optimal positions
- **Routing Guidance**: Recommend connection paths
- **Design Validation**: Real-time rule checking
- **Interactive Feedback**: Highlight affected components

### **Error Handling**

- **Ambiguous Requests**: Request clarification with specific options
- **Conflicting Requirements**: Highlight trade-offs and suggest alternatives
- **Missing Information**: Ask targeted questions for critical parameters
- **Invalid Specifications**: Provide engineering justification for corrections

---

## 📊 **Performance Metrics**

### **Accuracy Targets**

- **Intent Classification**: >95% accuracy
- **Entity Extraction**: >90% precision/recall
- **Context Understanding**: >85% correct interpretation

### **User Experience**

- **Response Time**: <500ms for 80% of requests
- **Clarification Rate**: <20% of requests need clarification
- **Success Rate**: >90% of parsed requests lead to successful designs

---

## 🔄 **Continuous Improvement**

### **Learning Mechanisms**

- **User Feedback**: Track successful vs. unsuccessful parses
- **Pattern Recognition**: Learn from common professional terminology
- **Industry Adaptation**: Update parsing rules for new standards
- **Performance Monitoring**: A/B test parsing improvements

### **Quality Assurance**

- **Test Coverage**: Comprehensive test suite for parsing accuracy
- **Edge Case Handling**: Robust processing of unusual requests
- **Regression Testing**: Ensure updates don't break existing functionality
- **User Validation**: Professional engineer feedback integration

---

_This parser transforms professional engineering conversations into precise, actionable design instructions that power BuildPCB.ai's intelligent circuit design capabilities._
