# Electrical Engineering Design Rules for BuildPCB.ai

## 1. Fundamental Laws & Principles

- **Ohm's Law (V=IR):** The relationship between voltage (V), current (I), and resistance (R) is the foundation of all circuit analysis. The AI must ensure components can handle the calculated current and voltage.
- **Kirchhoff's Current Law (KCL):** The sum of currents entering a node must equal the sum of currents leaving it. This is critical for the wiring tool to ensure all connections are valid and there are no open circuits.
- **Kirchhoff's Voltage Law (KVL):** The sum of all voltages around any closed loop in a circuit must equal zero. This helps in analyzing voltage drops and ensuring components receive the correct voltage levels.
- **Power Law (P=VI):** Power dissipation must be calculated for all components. Heat sinks and thermal vias may be required for high-power components.
- **Capacitive Reactance (Xc = 1/(2πfC)):** Frequency-dependent impedance of capacitors affects filtering and decoupling effectiveness.
- **Inductive Reactance (XL = 2πfL):** Frequency-dependent impedance of inductors affects filtering and EMI suppression.
- **Impedance Matching:** Source and load impedances should match for maximum power transfer or signal integrity.

---

## 2. Power Supply & Distribution Rules

- **Decoupling Capacitors:** Place small capacitors (typically 0.1µF) as close as possible to the power and ground pins of every integrated circuit (IC). This stabilizes the power supply by filtering out high-frequency noise.
- **Power & Ground Planes:** For multi-layer PCBs, use dedicated power and ground planes to provide a low-impedance path for current, which improves stability and reduces noise.
- **Trace Width for Current:** The width of a PCB trace must be sufficient for the amount of current it's expected to carry. A trace that is too thin will act like a fuse and burn out. The AI should use a standard trace width calculator model to determine appropriate widths.
- **Power Supply Sequencing:** Ensure proper power-up sequencing for multi-voltage systems to prevent latch-up or damage to sensitive components.
- **Voltage Regulation:** Use appropriate voltage regulators with sufficient input/output capacitance and heat dissipation capabilities.
- **Power Distribution Network (PDN) Analysis:** Calculate impedance vs frequency for power delivery to ensure stability across all operating frequencies.
- **Bulk Capacitance:** Place large electrolytic capacitors at power entry points for low-frequency filtering and energy storage.
- **Power Integrity:** Maintain power supply ripple within component specifications (typically <5% for digital circuits).

---

## 3. Signal Integrity Rules

- **Keep Traces Short & Direct:** Route traces as directly as possible between components, especially for high-speed signals (like clocks or data lines) to minimize noise and signal delays.
- **Avoid Right-Angle Bends:** Use 45-degree bends instead of sharp 90-degree angles in traces. Sharp corners can cause signal reflections and create impedance discontinuities.
- **Separate Analog & Digital Grounds:** If a circuit has both analog and digital sections, they should have separate ground planes that are connected at a single point to prevent digital noise from interfering with sensitive analog signals.
- **Controlled Impedance Routing:** For high-speed signals, maintain consistent trace width and dielectric thickness for controlled impedance.
- **Differential Pair Routing:** Route differential signals with equal length, parallel traces, and consistent spacing to maintain common-mode rejection.
- **Signal Return Paths:** Ensure every signal has a low-impedance return path, preferably on an adjacent ground plane.
- **Crosstalk Prevention:** Maintain adequate spacing between parallel traces (3W rule: space = 3x trace width for parallel traces).
- **Termination:** Use appropriate termination (series, parallel, or AC) for transmission lines to prevent reflections.
- **Via Stubs:** Minimize via stub length in high-speed designs by using back-drilling or blind/buried vias.
- **Signal Layer Stackup:** Place high-speed signals on inner layers between ground planes for best signal integrity.

---

## 4. Component Placement Rules

- **Group Related Components:** Place components that are part of the same sub-circuit (e.g., a power supply section, a microcontroller and its crystal) close together. This keeps connecting traces short.
- **Isolate Noisy Components:** Keep high-frequency or high-power components (like switching regulators or microcontrollers) away from sensitive analog components (like op-amps or sensors).
- **Thermal Management:** Components that dissipate a lot of heat (like voltage regulators or power transistors) should have adequate copper area around them to act as a heat sink and should be placed away from temperature-sensitive components.
- **Clock Distribution:** Place clock sources centrally and distribute clock signals with equal trace lengths (clock tree synthesis).
- **Connector Placement:** Position connectors to allow easy cable routing and minimize trace lengths from connectors to processing components.
- **BGA Fanout:** For Ball Grid Array packages, ensure adequate via density and trace routing for all balls, especially power and ground.
- **Component Orientation:** Orient polarized components consistently and ensure test points are accessible.
- **Mechanical Constraints:** Consider mechanical mounting requirements, clearance for heatsinks, and component height restrictions.

---

## 5. Safety & Protection Rules

- **Fuses & Overcurrent Protection:** Always include a fuse or other overcurrent protection device at the main power input of a circuit to protect against short circuits.
- **Input Protection:** Use diodes or other protection circuits on external inputs to protect against reverse voltage or electrostatic discharge (ESD).
- **Proper Grounding:** Ensure a single, solid ground reference for the entire circuit. All ground connections should return to this common point.
- **Creepage & Clearance:** Maintain adequate spacing between conductive parts at different voltages, especially in high-voltage circuits.
- **Insulation Coordination:** Design insulation levels to withstand expected overvoltages and transients.
- **Fault Tolerance:** Include redundant circuits for critical functions and fail-safe mechanisms.
- **Electrical Safety Standards:** Comply with relevant safety standards (UL, IEC, etc.) for the intended application.
- **Touch Current Limits:** Ensure touch currents remain below safety limits for accessible conductive parts.

---

## 6. EMI/EMC Design Rules

- **Ground Plane Integrity:** Maintain continuous ground planes without splits under high-frequency circuits.
- **Shielding:** Use ground planes as shields for sensitive circuits and route high-speed signals between ground planes.
- **Loop Area Minimization:** Reduce loop areas in power and signal paths to minimize radiated emissions.
- **Filtering:** Include EMI filters at power entry and I/O ports for conducted emissions control.
- **Component Selection:** Choose components with good EMI performance (low radiated emissions, high immunity).
- **Cable Shielding:** Specify shielded cables for external connections and ensure proper shield termination.
- **PCB Layer Stackup:** Use multi-layer boards with proper layer arrangement for EMI control.
- **Radiated Emissions:** Keep high-frequency components away from board edges and use guard traces for sensitive signals.

---

## 7. High-Speed Design Rules

- **Transmission Line Theory:** Treat traces longer than λ/10 as transmission lines (λ = c/f where c is speed of light).
- **Rise Time Budgeting:** Calculate total system rise time and design accordingly for signal integrity.
- **Jitter Analysis:** Consider timing jitter in high-speed interfaces and ensure setup/hold time requirements are met.
- **Eye Diagram Analysis:** Maintain adequate eye opening for reliable data transmission.
- **SerDes Design:** For serial interfaces, ensure proper equalization and pre-emphasis settings.
- **Clock Jitter:** Minimize clock jitter by using low-jitter oscillators and proper clock distribution.
- **Signal Conditioning:** Use appropriate drivers, receivers, and conditioning circuits for high-speed signals.
- **Power Delivery for HS Circuits:** Ensure low-impedance power delivery for high-speed components.

---

## 8. Manufacturing & Assembly Rules

- **Design for Manufacturability (DFM):** Ensure designs can be reliably manufactured with available processes.
- **Panelization:** Design boards for efficient panelization to minimize waste and improve yield.
- **Solder Mask & Paste:** Ensure adequate solder mask clearance and stencil aperture design for reliable soldering.
- **Test Point Access:** Provide test points for all critical signals and power rails.
- **Fiducial Marks:** Include fiducial marks for automated assembly and inspection.
- **Component Spacing:** Maintain adequate spacing between components for assembly and rework.
- **Thermal Relief:** Use thermal relief patterns for through-hole components to improve solderability.
- **Solder Joint Reliability:** Design for reliable solder joints considering thermal cycling and mechanical stress.

---

## 9. Thermal Management Rules

- **Heat Dissipation Analysis:** Calculate total power dissipation and ensure adequate cooling.
- **Thermal Resistance:** Consider junction-to-ambient thermal resistance for all heat-generating components.
- **Heat Sink Design:** Size heat sinks appropriately and ensure adequate airflow or conduction paths.
- **Thermal Vias:** Use thermal vias to conduct heat from components to ground planes or heat sinks.
- **Temperature Rise Limits:** Keep component temperatures within manufacturer specifications.
- **Thermal Coupling:** Avoid placing heat-sensitive components near heat sources.
- **Power Plane as Heat Spreader:** Utilize power and ground planes for heat spreading in multi-layer boards.
- **Environmental Considerations:** Account for ambient temperature, altitude, and cooling method in thermal design.

---

## 10. Design Rule Check (DRC) Rules

- **Minimum Trace Width:** Enforce minimum trace widths based on current carrying capacity and manufacturing capabilities.
- **Minimum Trace Spacing:** Maintain adequate spacing between traces for voltage rating and manufacturing.
- **Minimum Annular Ring:** Ensure adequate annular rings for reliable via connections.
- **Drill Size Limits:** Respect minimum and maximum drill sizes for through-holes and vias.
- **Solder Mask Clearance:** Maintain proper solder mask clearance around pads and traces.
- **Silk Screen Clearance:** Ensure silk screen legends don't interfere with solder mask or component placement.
- **Copper Pour Clearance:** Maintain clearance between copper pours and traces/pads.
- **Hole-to-Trace Clearance:** Maintain adequate clearance between holes and traces.

---

## 11. Reliability & Quality Rules

- **Component Derating:** Operate components below their maximum ratings for improved reliability.
- **Thermal Cycling:** Design for expected thermal cycling in the operating environment.
- **Mechanical Stress:** Consider vibration, shock, and mechanical stress in component selection and mounting.
- **Corrosion Prevention:** Use appropriate materials and coatings for corrosive environments.
- **Moisture Protection:** Include conformal coating or potting for moisture-sensitive applications.
- **Component Obsolescence:** Select components with long-term availability or design for easy replacement.
- **Failure Mode Analysis:** Consider potential failure modes and design mitigations.
- **Quality Standards:** Comply with relevant quality standards (IPC, MIL, etc.).

---

## 12. Standards & Compliance Rules

- **IPC Standards:** Follow IPC design and manufacturing standards for PCB design.
- **Industry Standards:** Comply with relevant industry standards (USB, Ethernet, PCIe, etc.) for interfaces.
- **Regulatory Compliance:** Meet regulatory requirements for EMI, safety, and environmental standards.
- **RoHS Compliance:** Use RoHS-compliant materials and components.
- **REACH Compliance:** Ensure materials comply with REACH chemical restrictions.
- **UL Recognition:** Design for UL recognition where required for safety-critical applications.
- **CE Marking:** Meet CE marking requirements for European market access.

---

## 13. Cost Optimization Rules

- **Component Selection:** Balance performance requirements with cost considerations.
- **Board Size Optimization:** Minimize board size while maintaining design requirements.
- **Layer Count Optimization:** Use minimum layers necessary for functionality.
- **Material Selection:** Choose cost-effective materials that meet performance requirements.
- **Manufacturing Process Selection:** Select appropriate manufacturing processes based on cost and requirements.
- **Design for Test:** Include DFT features to reduce testing costs and improve yield.
- **Schematic Optimization:** Minimize unique component values to reduce procurement complexity.

---

## 14. Wiring & Routing Rules for the Wiring Tool

- **Trace Spacing:** Traces must have a minimum clearance between them to prevent short circuits. This is especially important for high-voltage circuits. Your tool should enforce minimum spacing based on standard design rules.
- **Via Usage:** Use vias to move signals between different layers of a PCB. However, avoid placing vias in the pads of surface-mount components unless it's a "via-in-pad" design.
- **No Overlapping Traces:** The wiring tool must ensure that traces on the same layer never cross or overlap.
- **Clear Return Paths:** For every signal, there must be a clear, uninterrupted path for the return current on the ground plane. Avoid routing signals over splits or gaps in the ground plane.
- **Manhattan Routing:** Use horizontal and vertical trace segments for easier routing and better EMI performance.
- **Via Minimization:** Minimize via count to reduce cost and improve signal integrity.
- **Layer Transitions:** Use appropriate via types for layer transitions (through, blind, buried).
- **Routing Priority:** Route critical signals first (power, high-speed, clock) before secondary signals.
- **Length Matching:** Match trace lengths for parallel signals (buses, differential pairs).
- **Impedance Control:** Maintain consistent trace geometry for controlled impedance traces.
- **Crosstalk Management:** Apply proper spacing and guard traces for sensitive signals.
- **Power/Ground Routing:** Ensure adequate power and ground distribution with appropriate trace widths.
- **Teardrop Pads:** Use teardrop connections at trace-pad junctions to improve reliability.
- **Acute Angle Prevention:** Avoid acute angles in traces to prevent manufacturing issues and signal reflections.
