/**
 * RefDes (Reference Designator) Service
 *
 * Manages component reference designators (U1, R1, C1, etc.) for PCB schematics.
 * Follows KiCad-style numbering: no auto-renumber when components are deleted.
 */

// Standard component prefixes used in electronic schematics
export const STANDARD_REFDES_PREFIXES = {
  // Passive Components
  R: "Resistor",
  C: "Capacitor",
  L: "Inductor",
  FB: "Ferrite Bead",
  VR: "Variable Resistor",
  POT: "Potentiometer",

  // Semiconductors
  D: "Diode",
  LED: "LED",
  Q: "Transistor",
  U: "Integrated Circuit",
  IC: "Integrated Circuit",
  OP: "Op-Amp",
  REG: "Regulator",
  DRV: "Driver",

  // Connectors
  J: "Connector/Jack",
  P: "Plug",
  CN: "Connector",
  TP: "Test Point",

  // Switches & Relays
  SW: "Switch",
  K: "Relay",

  // Power
  BAT: "Battery",

  // Mechanical
  M: "Motor",
  F: "Fuse",
  H: "Hardware",
  MH: "Mounting Hole",
  SH: "Shield",

  // Crystals & Oscillators
  E: "Electrical Contact",
  X: "Crystal/Oscillator",
  Y: "Crystal",

  // Audio
  S: "Speaker",
  LS: "Loudspeaker",
  BZ: "Buzzer",
  MIC: "Microphone",

  // Transformers
  T: "Transformer",
} as const;

interface RefDesAssignment {
  componentId: string;
  refdes: string; // e.g., "U1", "R5"
  prefix: string; // e.g., "U", "R"
  number: number; // e.g., 1, 5
}

class RefDesService {
  // Map of componentId → assigned RefDes
  private assignments = new Map<string, RefDesAssignment>();

  // Map of prefix → highest number used (for getting next number)
  private prefixCounters = new Map<string, number>();

  /**
   * Extract RefDes prefix from SVG string
   * Looks for <text>U?</text>, <text>R?</text>, etc.
   */
  getRefDesFromSVG(svgString: string): string | null {
    // Match <text>PREFIX?</text> where PREFIX is one of our known prefixes
    const textMatch = svgString.match(/<text[^>]*>(.*?)<\/text>/i);

    console.log("🔍 RefDes extraction:", {
      hasMatch: !!textMatch,
      matchedText: textMatch ? textMatch[1] : null,
      svgSnippet: svgString.substring(0, 200),
    });

    if (!textMatch) return null;

    const textContent = textMatch[1].trim();

    console.log("🔍 Text content analysis:", {
      textContent,
      endsWithQuestion: textContent.endsWith("?"),
      prefix: textContent.slice(0, -1).trim().toUpperCase(),
    });

    // Check if it ends with "?" (unassigned marker)
    if (!textContent.endsWith("?")) return null;

    // Extract prefix (everything before the "?")
    const prefix = textContent.slice(0, -1).trim().toUpperCase();

    // Verify it's a known prefix
    if (prefix in STANDARD_REFDES_PREFIXES) {
      console.log(`✅ Valid RefDes prefix found: ${prefix}`);
      return prefix;
    }

    console.log(`❌ Unknown prefix: ${prefix}`);
    return null;
  }

  /**
   * Assign next RefDes number for a component
   */
  assignRefDes(componentId: string, prefix: string): string {
    // Check if already assigned
    const existing = this.assignments.get(componentId);
    if (existing) {
      return existing.refdes;
    }

    // Get next number for this prefix
    const currentMax = this.prefixCounters.get(prefix) || 0;
    const nextNumber = currentMax + 1;

    // Update counter
    this.prefixCounters.set(prefix, nextNumber);

    // Create assignment
    const refdes = `${prefix}${nextNumber}`;
    const assignment: RefDesAssignment = {
      componentId,
      refdes,
      prefix,
      number: nextNumber,
    };

    this.assignments.set(componentId, assignment);

    return refdes;
  }

  /**
   * Get assigned RefDes for a component (if any)
   */
  getRefDes(componentId: string): string | null {
    return this.assignments.get(componentId)?.refdes || null;
  }

  /**
   * Remove RefDes assignment (when component is deleted)
   * Note: Does NOT decrease counter (KiCad-style behavior)
   */
  unassignRefDes(componentId: string): void {
    this.assignments.delete(componentId);
  }

  /**
   * Re-annotate all components (renumber sequentially)
   * Use with caution - changes all RefDes numbers!
   */
  reAnnotate(): void {
    // Group assignments by prefix
    const byPrefix = new Map<string, RefDesAssignment[]>();

    for (const assignment of this.assignments.values()) {
      const list = byPrefix.get(assignment.prefix) || [];
      list.push(assignment);
      byPrefix.set(assignment.prefix, list);
    }

    // Reset counters
    this.prefixCounters.clear();

    // Renumber each prefix group sequentially
    for (const [prefix, list] of byPrefix) {
      list.sort((a, b) => a.number - b.number); // Sort by original number

      list.forEach((assignment, index) => {
        const newNumber = index + 1;
        assignment.number = newNumber;
        assignment.refdes = `${prefix}${newNumber}`;
        this.prefixCounters.set(prefix, newNumber);
      });
    }
  }

  /**
   * Manually set a specific RefDes (for imported designs)
   */
  setRefDes(componentId: string, refdes: string): void {
    // Parse the refdes (e.g., "U12" → prefix="U", number=12)
    const match = refdes.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid RefDes format: ${refdes}`);
    }

    const [, prefix, numberStr] = match;
    const number = parseInt(numberStr, 10);

    // Update counter if needed
    const currentMax = this.prefixCounters.get(prefix) || 0;
    if (number > currentMax) {
      this.prefixCounters.set(prefix, number);
    }

    // Create assignment
    const assignment: RefDesAssignment = {
      componentId,
      refdes,
      prefix,
      number,
    };

    this.assignments.set(componentId, assignment);
  }

  /**
   * Get all assignments (for serialization)
   */
  getAll(): RefDesAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Load assignments (for deserialization)
   */
  loadAssignments(assignments: RefDesAssignment[]): void {
    this.assignments.clear();
    this.prefixCounters.clear();

    for (const assignment of assignments) {
      this.assignments.set(assignment.componentId, assignment);

      // Update counter
      const currentMax = this.prefixCounters.get(assignment.prefix) || 0;
      if (assignment.number > currentMax) {
        this.prefixCounters.set(assignment.prefix, assignment.number);
      }
    }
  }

  /**
   * Clear all assignments
   */
  clear(): void {
    this.assignments.clear();
    this.prefixCounters.clear();
  }

  /**
   * Update SVG string to replace "U?" with assigned RefDes like "U1"
   */
  updateSVGWithRefDes(svgString: string, refdes: string): string {
    // Find <text>PREFIX?</text> and replace with <text>REFDES</text>
    return svgString.replace(
      /(<text[^>]*>)[A-Z]+\?(<\/text>)/i,
      `$1${refdes}$2`
    );
  }
}

// Export singleton instance
export const refDesService = new RefDesService();
