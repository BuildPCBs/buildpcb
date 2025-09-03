# Component SVG Design Guidelines for BuildPCB.ai

**Version 3.0 - Comprehensive Design System** | *Last Updated: September 3, 2025*

Following these guidelines ensures all component SVGs are consistent, performant, and fully integrated with BuildPCB's canvas system and wiring tools.

---

## 📋 **OVERVIEW & REQUIREMENTS**

### **Core Principles**
- **Consistency**: All components follow identical structure and styling patterns
- **Performance**: Optimized for real-time canvas rendering and interaction
- **Accessibility**: Clear visual hierarchy and semantic structure
- **Maintainability**: Easy to modify, version, and extend
- **Integration**: Seamless compatibility with Fabric.js and wiring systems

### **Technical Specifications**
- **Format**: SVG 1.1 compliant
- **Coordinate System**: 0-100 width, 0-60 height (100x60 viewBox)
- **Units**: Pixel-based coordinates
- **Colors**: Black strokes, transparent fills (unless specified)
- **Stroke Width**: 2px standard (1.5-2.5px range acceptable)

---

## 🎨 **SVG STRUCTURE REQUIREMENTS**

### **1. Document Structure**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <!-- Visual elements group -->
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Component symbol graphics here -->
  </g>

  <!-- Connection points (invisible) -->
  <!-- Pin definitions here -->

  <!-- Optional: Metadata -->
  <metadata>
    <component-info type="resistor" category="passive" pins="2" />
  </metadata>
</svg>
```

### **2. Required Elements**

#### **Symbol Group (`<g id="symbol">`)**
- **Purpose**: Contains all visible component graphics
- **Attributes**:
  - `id="symbol"`: Required for canvas manipulation
  - `stroke="black"`: Consistent outline color
  - `stroke-width="2"`: Standard line thickness
  - `fill="none"`: Transparent fill (unless component requires solid fill)

#### **Pin Markers (`<circle id="pin">` or `<rect id="pin">`)**
- **Purpose**: Define electrical connection points for wiring tool
- **Critical Requirements**:
  - `id="pin"`: **MANDATORY** - Wiring tool searches for this exact ID
  - `fill="none"` and `stroke="none"`: **MANDATORY** - Must be invisible
  - Precise positioning at connection points
  - Small radius (1-2px) for accurate wire attachment

#### **Optional Metadata**
```xml
<metadata>
  <component-info
    type="resistor"
    category="passive"
    pins="2"
    orientation="horizontal"
    symmetry="bilateral" />
</metadata>
```

---

## 📐 **DESIGN PATTERNS BY COMPONENT CATEGORY**

### **Pattern 1: Two-Terminal Components (Resistors, Capacitors, Diodes)**

#### **Horizontal Layout (Standard)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Left terminal line -->
    <line x1="0" y1="30" x2="20" y2="30" />

    <!-- Component body (customize per component) -->
    <rect x="20" y="25" width="60" height="10" />

    <!-- Right terminal line -->
    <line x1="80" y1="30" x2="100" y2="30" />
  </g>

  <!-- Connection pins -->
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="100" cy="30" r="1" fill="none" stroke="none" />
</svg>
```

#### **Vertical Layout (Alternative)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Top terminal -->
    <line x1="50" y1="0" x2="50" y2="15" />

    <!-- Component body -->
    <rect x="45" y="15" width="10" height="30" />

    <!-- Bottom terminal -->
    <line x1="50" y1="45" x2="50" y2="60" />
  </g>

  <circle id="pin" cx="50" cy="0" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="50" cy="60" r="1" fill="none" stroke="none" />
</svg>
```

### **Pattern 2: Three-Terminal Components (Transistors, Regulators)**

#### **BJT Transistor (NPN)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Base terminal and line -->
    <line x1="0" y1="30" x2="25" y2="30" />
    <line x1="25" y1="15" x2="25" y2="45" />

    <!-- Collector terminal -->
    <line x1="25" y1="15" x2="50" y2="15" />

    <!-- Emitter terminal -->
    <line x1="25" y1="45" x2="50" y2="45" />

    <!-- Transistor body -->
    <circle cx="37" cy="30" r="12" />

    <!-- Arrow (for NPN) -->
    <line x1="31" y1="35" x2="35" y2="39" />
    <line x1="31" y1="41" x2="35" y2="37" />
  </g>

  <!-- Connection pins -->
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="50" cy="15" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="50" cy="45" r="1" fill="none" stroke="none" />
</svg>
```

### **Pattern 3: Multi-Terminal Components (ICs, Microcontrollers)**

#### **DIP Package IC**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- IC body -->
    <rect x="15" y="20" width="70" height="20" />

    <!-- Pin notches -->
    <circle cx="15" cy="25" r="2" fill="none" />
    <circle cx="15" cy="35" r="2" fill="none" />
    <circle cx="85" cy="25" r="2" fill="none" />
    <circle cx="85" cy="35" r="2" fill="none" />

    <!-- Pin lines (showing 4 pins per side for brevity) -->
    <line x1="10" y1="22" x2="15" y2="22" />
    <line x1="10" y1="28" x2="15" y2="28" />
    <line x1="10" y1="32" x2="15" y2="32" />
    <line x1="10" y1="38" x2="15" y2="38" />

    <line x1="85" y1="22" x2="90" y2="22" />
    <line x1="85" y1="28" x2="90" y2="28" />
    <line x1="85" y1="32" x2="90" y2="32" />
    <line x1="85" y1="38" x2="90" y2="38" />
  </g>

  <!-- Connection pins (8 pins total) -->
  <circle id="pin" cx="10" cy="22" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="10" cy="28" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="10" cy="32" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="10" cy="38" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="90" cy="22" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="90" cy="28" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="90" cy="32" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="90" cy="38" r="1" fill="none" stroke="none" />
</svg>
```

---

## 🎨 **COMPONENT-SPECIFIC EXAMPLES**

### **Resistor (with Zigzag)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <line x1="0" y1="30" x2="20" y2="30" />
    <path d="M20 30 L25 20 L30 40 L35 20 L40 40 L45 20 L50 40 L55 20 L60 40 L65 20 L70 40 L75 20 L80 30" />
    <line x1="80" y1="30" x2="100" y2="30" />
  </g>
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="100" cy="30" r="1" fill="none" stroke="none" />
</svg>
```

### **Capacitor (Polarized)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <line x1="0" y1="30" x2="35" y2="30" />
    <line x1="40" y1="20" x2="40" y2="40" />
    <line x1="45" y1="20" x2="45" y2="40" />
    <line x1="55" y1="30" x2="100" y2="30" />
    <!-- Positive indicator -->
    <line x1="47" y1="25" x2="43" y2="25" />
    <line x1="45" y1="23" x2="45" y2="27" />
  </g>
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="100" cy="30" r="1" fill="none" stroke="none" />
</svg>
```

### **LED (with Arrow)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Triangle body -->
    <path d="M20 15 L20 45 L60 30 Z" />
    <!-- Arrow -->
    <path d="M60 30 L75 20 M60 30 L75 40 M60 30 L80 30" />
    <!-- Terminals -->
    <line x1="0" y1="30" x2="20" y2="30" />
    <line x1="60" y1="30" x2="85" y2="30" />
  </g>
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="85" cy="30" r="1" fill="none" stroke="none" />
</svg>
```

### **Switch (SPST)**
```xml
<svg width="100" height="60" viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
  <g id="symbol" stroke="black" stroke-width="2" fill="none">
    <!-- Terminals -->
    <line x1="0" y1="30" x2="25" y2="30" />
    <line x1="75" y1="30" x2="100" y2="30" />
    <!-- Switch symbol -->
    <circle cx="50" cy="30" r="8" />
    <line x1="42" y1="22" x2="58" y2="38" />
  </g>
  <circle id="pin" cx="0" cy="30" r="1" fill="none" stroke="none" />
  <circle id="pin" cx="100" cy="30" r="1" fill="none" stroke="none" />
</svg>
```

---

## 🔧 **TECHNICAL BEST PRACTICES**

### **Performance Optimization**
- **Minimize Path Complexity**: Use simple shapes over complex curves when possible
- **Avoid Excessive Details**: Focus on schematic representation, not photorealism
- **Optimize Stroke Widths**: Consistent 2px strokes render faster
- **Limit Element Count**: Keep total SVG elements under 50 for best performance

### **Coordinate Precision**
- **Integer Coordinates**: Use whole numbers for cleaner rendering
- **Consistent Spacing**: 5-10 unit spacing between elements
- **Pin Alignment**: Center pins at exact connection points
- **ViewBox Utilization**: Use full 0-100 width range for horizontal components

### **Color and Styling Standards**
- **Primary Color**: `stroke="black"` for all outlines
- **Background**: `fill="none"` for transparency
- **Special Cases**: Use `fill="black"` only for solid components (grounds, etc.)
- **Consistency**: Never use custom colors unless specified in component requirements

---

## 🧪 **TESTING & VALIDATION**

### **Automated Checks**
- [ ] **Pin Count**: Verify correct number of `id="pin"` elements
- [ ] **Visibility**: Confirm pins have `fill="none"` and `stroke="none"`
- [ ] **Structure**: Ensure `<g id="symbol">` wrapper exists
- [ ] **ViewBox**: Validate `viewBox="0 0 100 60"` format
- [ ] **Coordinates**: Check all elements within viewBox bounds

### **Integration Testing**
- [ ] **Canvas Rendering**: Component displays correctly on Fabric.js canvas
- [ ] **Wire Connection**: Pins accept wire connections properly
- [ ] **Selection**: Component can be selected and moved
- [ ] **Scaling**: Maintains proportions when resized
- [ ] **Performance**: Renders smoothly in real-time

### **Visual Inspection**
- [ ] **Alignment**: Component centered in viewBox
- [ ] **Proportions**: Realistic aspect ratio for component type
- [ ] **Clarity**: Symbol easily recognizable at small sizes
- [ ] **Consistency**: Matches style of other components

---

## 🚨 **TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions**

#### **Wires Not Connecting**
- **Problem**: Wiring tool can't find connection points
- **Solution**: Ensure all pins have `id="pin"` and are invisible
- **Check**: Pin coordinates match symbol connection points exactly

#### **Component Not Rendering**
- **Problem**: Symbol appears blank or distorted
- **Solution**: Verify `<g id="symbol">` wrapper and viewBox settings
- **Check**: All paths use relative coordinates within 0-100 range

#### **Performance Issues**
- **Problem**: Canvas lag when many components present
- **Solution**: Simplify paths, reduce element count, use consistent stroke widths
- **Check**: Total SVG elements < 50, no complex gradients or filters

#### **Pin Misalignment**
- **Problem**: Wires connect to wrong points
- **Solution**: Recalculate pin coordinates to match symbol endpoints
- **Check**: Pin centers align with terminal line endpoints

---

## 📁 **FILE ORGANIZATION & NAMING**

### **Directory Structure**
```
src/assets/components/
├── passive/
│   ├── resistor.svg
│   ├── capacitor.svg
│   └── inductor.svg
├── active/
│   ├── transistor-npn.svg
│   ├── transistor-pnp.svg
│   └── opamp.svg
├── digital/
│   ├── 555-timer.svg
│   ├── microcontroller.svg
│   └── logic-gate-and.svg
└── power/
    ├── battery.svg
    ├── voltage-regulator.svg
    └── ground.svg
```

### **Naming Conventions**
- **Format**: `component-type-variant.svg`
- **Examples**:
  - `resistor.svg` (basic)
  - `transistor-npn.svg` (with variant)
  - `capacitor-polarized.svg` (with specification)
- **Rules**:
  - Lowercase only
  - Hyphens for separation
  - No spaces or special characters
  - Descriptive but concise

---

## 🔄 **MAINTENANCE & UPDATES**

### **Version Control**
- **Semantic Versioning**: `v1.0.0`, `v1.1.0`, `v2.0.0`
- **Changelog**: Document all visual and functional changes
- **Backward Compatibility**: Avoid breaking existing integrations
- **Deprecation Notices**: Warn before removing component variants

### **Update Process**
1. **Design Review**: Validate against current guidelines
2. **Testing**: Verify canvas integration and wire connections
3. **Performance Check**: Ensure no degradation in rendering speed
4. **Documentation**: Update component catalog and usage examples
5. **Deployment**: Roll out with feature flags for gradual adoption

### **Quality Assurance**
- **Automated Validation**: SVG structure and syntax checking
- **Cross-browser Testing**: Verify rendering in all supported browsers
- **Accessibility Audit**: Ensure high contrast and screen reader compatibility
- **Performance Benchmarking**: Compare rendering speed against baselines

---

## 🎯 **SUCCESS METRICS**

### **Technical Quality**
- ✅ **100% Pin Compliance**: All connection points properly defined
- ✅ **Zero Rendering Errors**: Components display correctly in all contexts
- ✅ **Optimal Performance**: < 16ms render time per component
- ✅ **Perfect Integration**: Seamless wiring tool compatibility

### **Design Consistency**
- ✅ **Visual Harmony**: All components follow identical style patterns
- ✅ **Proportional Accuracy**: Realistic representations of physical components
- ✅ **Scalability**: Clear at all zoom levels (25% to 400%)
- ✅ **Professional Appearance**: Clean, schematic-appropriate styling

### **Developer Experience**
- ✅ **Easy Maintenance**: Simple structure for quick modifications
- ✅ **Clear Documentation**: Comprehensive guidelines and examples
- ✅ **Tool Integration**: Works seamlessly with existing workflows
- ✅ **Future-Proof**: Extensible design for new component types

---

## 📚 **RESOURCES & REFERENCES**

### **Essential Reading**
- [SVG 1.1 Specification](https://www.w3.org/TR/SVG11/)
- [Fabric.js Documentation](http://fabricjs.com/docs/)
- [Electrical Symbol Standards](https://en.wikipedia.org/wiki/Electronic_symbol)

### **Tools & Software**
- **Design**: Inkscape, Adobe Illustrator, Figma
- **Validation**: SVGOMG, SVGO, custom linting scripts
- **Testing**: Browser dev tools, canvas performance monitors

### **Community Resources**
- **Component Libraries**: Open-source electronics symbol collections
- **Best Practices**: Industry standards for schematic design
- **Accessibility Guidelines**: WCAG compliance for technical diagrams

---

*These guidelines ensure BuildPCB's component library remains professional, performant, and maintainable while providing the best possible user experience for circuit design.*
