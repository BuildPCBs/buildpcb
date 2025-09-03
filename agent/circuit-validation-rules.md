# Circuit Validation Rules

**Version 1.0 - Professional Engineering Standards** | _Last Updated: September 3, 2025_

This document defines comprehensive circuit validation rules for BuildPCB.ai, ensuring professional-grade design integrity and reliability for major company engineering teams.

---

## 🎯 **Validation Framework**

### **Core Principles**

#### **Professional Standards**

- **IEC Compliance**: International Electrotechnical Commission standards
- **Industry Best Practices**: Automotive, industrial, medical, consumer
- **Safety First**: Prioritize user and equipment safety
- **Reliability Focus**: Design for long-term operational stability

#### **Validation Types**

1. **🟢 Real-time Validation**: Instant feedback during design
2. **🟡 Batch Validation**: Comprehensive checks before finalization
3. **🔴 Design Rule Check (DRC)**: Manufacturing and assembly verification
4. **🔵 Electrical Rule Check (ERC)**: Electrical integrity and performance

---

## ⚡ **Electrical Rule Check (ERC)**

### **Power Integrity**

#### **Power Supply Validation**

```typescript
interface PowerValidation {
  supplyVoltage: number; // V
  currentCapacity: number; // A
  rippleVoltage: number; // mV
  loadRegulation: number; // %
  thermalDerating: number; // %
}
```

**Critical Checks:**

- **Voltage Compatibility**: All components within rated voltage ranges
- **Current Capacity**: Power supplies can handle maximum load
- **Power Sequencing**: Proper startup sequence for sensitive components
- **Brown-out Protection**: Adequate voltage monitoring and response

#### **Power Distribution**

- **Voltage Drops**: <5% voltage drop on power traces
- **Current Density**: Trace width meets IPC standards
- **Power Planes**: Adequate copper area for heat dissipation
- **Decoupling**: Proper capacitor placement and values

### **Signal Integrity**

#### **Digital Signals**

- **Rise/Fall Times**: Meet component specifications
- **Crosstalk**: <10% coupling between adjacent traces
- **Impedance Matching**: 50Ω for high-speed signals
- **Termination**: Proper termination for transmission lines

#### **Analog Signals**

- **Signal-to-Noise Ratio**: >60dB for precision applications
- **Common Mode Rejection**: >80dB for differential amplifiers
- **Gain Accuracy**: Within specified tolerance
- **Offset Voltage**: Within acceptable limits

### **Thermal Management**

#### **Component Temperature**

- **Junction Temperature**: Below maximum rated temperature
- **Power Dissipation**: Adequate heat sinking
- **Thermal Resistance**: Proper thermal path design
- **Operating Environment**: -40°C to +85°C (industrial grade)

#### **Board-Level Thermal**

- **Hot Spots**: Identify and mitigate thermal concentration
- **Airflow Requirements**: Natural or forced convection
- **Thermal Relief**: Proper thermal vias and planes
- **Temperature Sensors**: Monitoring provisions

---

## 🎯 **Design Rule Check (DRC)**

### **Component Placement**

#### **Clearance Requirements**

```typescript
const CLEARANCE_RULES = {
  highVoltage: 2.0, // mm - High voltage traces
  signal: 0.25, // mm - Signal traces
  power: 0.5, // mm - Power traces
  component: 1.0, // mm - Component to component
  boardEdge: 2.5, // mm - Component to board edge
};
```

#### **Placement Optimization**

- **Signal Flow**: Logical component arrangement
- **Thermal Coupling**: Heat-generating components separated
- **EMI Considerations**: Sensitive circuits shielded
- **Serviceability**: Easy access for testing and repair

### **Trace Routing**

#### **Width Calculations**

```typescript
function calculateTraceWidth(
  current: number, // Amperes
  temperature: number, // °C rise
  thickness: number // oz copper
): number {
  // IPC-2221 formula implementation
  return (current * K) / (temperature * thickness);
}
```

#### **Routing Rules**

- **Minimum Width**: 0.15mm for signal traces
- **Maximum Length**: Critical for high-speed signals
- **Via Usage**: Minimize for signal integrity
- **Layer Stackup**: Proper impedance control

### **Manufacturing Constraints**

#### **Fabrication Limits**

- **Minimum Drill Size**: 0.2mm for through-holes
- **Aspect Ratio**: Maximum 10:1 for plated holes
- **Annular Ring**: Minimum 0.1mm copper around holes
- **Solder Mask**: Proper clearance for assembly

#### **Assembly Considerations**

- **Component Orientation**: Consistent pin 1 marking
- **Solder Joint Access**: Test point accessibility
- **Pick & Place**: Machine-friendly component placement
- **Wave Soldering**: Proper component spacing

---

## 🔍 **Component Validation**

### **Electrical Compatibility**

#### **Voltage Ratings**

- **Working Voltage**: 80% of rated voltage maximum
- **Peak Voltage**: Account for transients and spikes
- **Dielectric Strength**: Adequate insulation for safety
- **Overvoltage Protection**: TVS diodes and varistors

#### **Current Ratings**

- **Continuous Current**: 70% of rated current maximum
- **Peak Current**: Account for inrush and fault conditions
- **Fuse Selection**: Proper fuse characteristics
- **Wire Gauge**: Adequate conductor sizing

### **Environmental Ratings**

#### **Temperature Range**

- **Operating Temperature**: -40°C to +85°C for industrial
- **Storage Temperature**: -55°C to +125°C for extreme conditions
- **Thermal Cycling**: 1000 cycles minimum
- **Humidity Resistance**: 85% RH non-condensing

#### **Mechanical Stress**

- **Vibration**: 10-2000Hz, 20g acceleration
- **Shock**: 50g, 11ms half-sine pulse
- **Drop Test**: 1m drop for portable applications
- **Bend Radius**: Minimum for flexible circuits

---

## 📊 **Industry-Specific Rules**

### **Automotive Electronics**

#### **EMC/EMI Compliance**

- **CISPR 25**: Radiated emissions limits
- **ISO 11452**: Immunity to electromagnetic fields
- **ISO 7637**: Electrical transients from ignition
- **Load Dump**: 79V, 400ms pulse protection

#### **Reliability Standards**

- **AEC-Q100**: Stress test qualification
- **AEC-Q200**: Passive component qualification
- **MTBF**: 100,000 hours minimum
- **Operating Life**: 15 years minimum

### **Medical Devices**

#### **Safety Standards**

- **IEC 60601-1**: General safety requirements
- **IEC 60601-1-2**: EMC requirements
- **Leakage Current**: <100µA for patient-connected devices
- **Isolation**: 4kV AC for 1 minute

#### **Performance Requirements**

- **Accuracy**: ±1% for critical measurements
- **Response Time**: <100ms for alarms
- **Battery Life**: 7 days minimum for portable devices
- **Data Security**: HIPAA compliance for patient data

### **Industrial Control**

#### **Environmental Hardening**

- **IP Rating**: IP65 minimum for harsh environments
- **Chemical Resistance**: Exposure to oils and solvents
- **Corrosion Protection**: Conformal coating requirements
- **Cable Stress**: M12 connectors for rugged applications

#### **Communication Standards**

- **EtherCAT**: 100Mbps for real-time control
- **PROFIBUS**: Deterministic communication
- **Modbus**: Reliable industrial protocol
- **CAN Bus**: 1Mbps for vehicle applications

---

## 🔧 **Validation Engine**

### **Real-time Validation**

#### **Incremental Checking**

```typescript
interface ValidationResult {
  level: "error" | "warning" | "info";
  category: "electrical" | "thermal" | "mechanical" | "manufacturing";
  component?: string;
  location?: Point;
  message: string;
  suggestion?: string;
  standard?: string;
}
```

#### **Performance Optimization**

- **Lazy Evaluation**: Check only affected components
- **Caching**: Store results for unchanged designs
- **Progressive Validation**: Quick checks first, detailed analysis later
- **Background Processing**: Non-blocking validation for large designs

### **Reporting System**

#### **Validation Report Structure**

```typescript
interface ValidationReport {
  summary: {
    totalErrors: number;
    totalWarnings: number;
    complianceScore: number; // 0-100
  };
  violations: ValidationResult[];
  recommendations: ValidationSuggestion[];
  standards: ComplianceStatus[];
}
```

#### **Export Formats**

- **HTML Report**: Web-viewable detailed analysis
- **PDF Report**: Professional documentation
- **CSV Export**: Machine-readable data
- **JSON API**: Integration with other tools

---

## 📈 **Continuous Improvement**

### **Rule Updates**

#### **Standards Tracking**

- **IEC Updates**: Monitor international standard changes
- **Industry Trends**: Adapt to new requirements
- **Technology Evolution**: Support emerging components
- **Customer Feedback**: Incorporate user requirements

#### **Performance Metrics**

- **False Positive Rate**: Minimize incorrect warnings
- **Validation Speed**: <1 second for typical designs
- **Coverage**: >95% of common design issues detected
- **User Satisfaction**: >90% helpful validation feedback

### **Machine Learning Integration**

#### **Pattern Recognition**

- **Common Errors**: Learn from frequent violations
- **Design Patterns**: Recognize best practices
- **Industry Specific**: Adapt to different engineering domains
- **User Preferences**: Learn individual engineer preferences

---

## 🚨 **Critical Failure Prevention**

### **Safety-Critical Validation**

- **Redundant Checks**: Multiple validation layers
- **Fail-Safe Design**: Default to safe configurations
- **Audit Trail**: Complete validation history
- **Expert Review**: Escalation for complex designs

### **Regulatory Compliance**

- **CE Marking**: European safety requirements
- **UL Certification**: North American safety standards
- **FCC Compliance**: Electromagnetic compatibility
- **RoHS Compliance**: Hazardous substance restrictions

---

_These circuit validation rules ensure BuildPCB.ai delivers professional-grade design verification, giving engineers confidence that their circuits meet industry standards and will perform reliably in real-world applications._
