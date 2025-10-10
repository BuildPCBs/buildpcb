/**
 * Reference Designator (RefDes) Service
 * 
 * Manages automatic numbering of components on the schematic canvas.
 * Follows KiCad approach:
 * - Auto-increment on add (U1, U2, R1, R2, etc.)
 * - Preserve gaps on delete (deleted U2 leaves gap: U1, U3)
 * - Per-prefix counters (separate sequences for U, R, C, D, etc.)
 * 
 * Standard PCB RefDes Prefixes:
 * - U = IC/Integrated Circuit
 * - R = Resistor
 * - C = Capacitor
 * - D = Diode
 * - Q = Transistor
 * - L = Inductor
 * - J = Connector
 * - SW = Switch
 * - LED = LED
 * - etc.
 */

import { logger } from "@/lib/logger";

interface RefDesAssignment {
  componentId: string;
  refDes: string; // e.g., "U1", "R5"
  prefix: string; // e.g., "U", "R"
  number: number; // e.g., 1, 5
}

class RefDesService {
  // Map of componentId -> RefDes assignment
  private assignments: Map<string, RefDesAssignment> = new Map();
  
  // Track highest number used for each prefix
  // e.g., { "U": 3, "R": 5, "C": 2 }
  private prefixCounters: Map<string, number> = new Map();
  
  /**
   * Extract RefDes prefix from component name
   * Examples:
   * - "U?" → "U"
   * - "D1" → "D"
   * - "R?" → "R"
   * - "LED?" → "LED"
   * - "NE555P_unit1" → "U" (fallback for ICs)
   */
  private extractPrefix(componentName: string): string {
    // First, try to match standard RefDes pattern (letter + optional number)
    const match = componentName.match(/^([A-Z]+)\??(\d+)?/i);
    
    if (match) {
      const prefix = match[1].toUpperCase();
      
      // Validate against known prefixes
      const validPrefixes = ['U', 'R', 'C', 'D', 'Q', 'L', 'J', 'SW', 'LED', 'TP', 'F', 'T', 'X', 'Y'];
      if (validPrefixes.includes(prefix)) {
        return prefix;
      }
    }
    
    // Fallback: try to infer from component type/name
    const nameLower = componentName.toLowerCase();
    if (nameLower.includes('555') || nameLower.includes('ic') || nameLower.includes('_unit')) {
      return 'U'; // IC
    } else if (nameLower.includes('led')) {
      return 'LED';
    } else if (nameLower.includes('resistor')) {
      return 'R';
    } else if (nameLower.includes('capacitor')) {
      return 'C';
    } else if (nameLower.includes('diode')) {
      return 'D';
    } else if (nameLower.includes('transistor')) {
      return 'Q';
    }
    
    // Ultimate fallback: use first letter
    return componentName.charAt(0).toUpperCase() || 'X';
  }
  
  /**
   * Get next available number for a given prefix
   */
  private getNextNumber(prefix: string): number {
    const current = this.prefixCounters.get(prefix) || 0;
    const next = current + 1;
    this.prefixCounters.set(prefix, next);
    return next;
  }
  
  /**
   * Assign a RefDes to a component
   * Returns the assigned RefDes (e.g., "U1", "R5")
   */
  assignRefDes(componentId: string, componentName: string): string {
    // Check if already assigned
    const existing = this.assignments.get(componentId);
    if (existing) {
      logger.component(`RefDes already assigned: ${existing.refDes}`, { componentId });
      return existing.refDes;
    }
    
    // Extract prefix from name
    const prefix = this.extractPrefix(componentName);
    
    // Get next number
    const number = this.getNextNumber(prefix);
    
    // Create RefDes
    const refDes = `${prefix}${number}`;
    
    // Store assignment
    const assignment: RefDesAssignment = {
      componentId,
      refDes,
      prefix,
      number,
    };
    
    this.assignments.set(componentId, assignment);
    
    logger.component(`RefDes assigned: ${refDes}`, { componentId, componentName, prefix, number });
    
    return refDes;
  }
  
  /**
   * Get RefDes for a component
   */
  getRefDes(componentId: string): string | null {
    const assignment = this.assignments.get(componentId);
    return assignment ? assignment.refDes : null;
  }
  
  /**
   * Remove RefDes assignment (when component is deleted)
   * NOTE: Does NOT renumber - preserves gaps like KiCad
   */
  removeAssignment(componentId: string): void {
    const assignment = this.assignments.get(componentId);
    if (assignment) {
      logger.component(`RefDes unassigned: ${assignment.refDes}`, { componentId });
      this.assignments.delete(componentId);
      // Note: We do NOT decrement prefixCounters - gaps are intentional
    }
  }
  
  /**
   * Clear all assignments (for new project)
   */
  clear(): void {
    this.assignments.clear();
    this.prefixCounters.clear();
    logger.component("RefDes service cleared");
  }
  
  /**
   * Get all assignments (for serialization)
   */
  getAllAssignments(): RefDesAssignment[] {
    return Array.from(this.assignments.values());
  }
  
  /**
   * Restore assignments from saved data
   */
  restoreAssignments(assignments: RefDesAssignment[]): void {
    this.clear();
    
    assignments.forEach(assignment => {
      this.assignments.set(assignment.componentId, assignment);
      
      // Update counter to highest number seen
      const currentMax = this.prefixCounters.get(assignment.prefix) || 0;
      if (assignment.number > currentMax) {
        this.prefixCounters.set(assignment.prefix, assignment.number);
      }
    });
    
    logger.component(`Restored ${assignments.length} RefDes assignments`, {
      prefixCounters: Object.fromEntries(this.prefixCounters),
    });
  }
  
  /**
   * Get statistics for debugging
   */
  getStats(): {
    totalAssignments: number;
    prefixCounts: Record<string, number>;
  } {
    const prefixCounts: Record<string, number> = {};
    
    this.assignments.forEach(assignment => {
      prefixCounts[assignment.prefix] = (prefixCounts[assignment.prefix] || 0) + 1;
    });
    
    return {
      totalAssignments: this.assignments.size,
      prefixCounts,
    };
  }
}

// Singleton instance
export const refDesService = new RefDesService();
