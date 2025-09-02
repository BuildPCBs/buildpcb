import { z } from "zod";

// Defines a single connection point in the circuit (a "net" in PCB terms)
// It connects a specific component's pin to another component's pin.
const ConnectionModelSchema = z.object({
  from: z.object({
    componentId: z
      .string()
      .min(1, "Connection must have a source component ID"),
    pin: z.string().min(1, "Connection must have a source pin name"),
  }),
  to: z.object({
    componentId: z
      .string()
      .min(1, "Connection must have a target component ID"),
    pin: z.string().min(1, "Connection must have a target pin name"),
  }),
});

// Defines a single component in the circuit.
// This is the core building block of the schematic.
const ComponentModelSchema = z.object({
  id: z.string().min(1, "Component ID cannot be empty"),
  type: z.string().min(1, "Component type cannot be empty"),
  value: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  datasheet: z.string().url().optional(),
  explanation: z.string().min(10, "Explanation must be at least 10 characters"),
});

// Defines the entire circuit structure that the AI will generate.
// This is the "single source of truth" for a schematic.
export const CircuitSchema = z.object({
  mode: z.enum(["full", "edit"]),
  description: z.string().optional(),
  components: z.array(ComponentModelSchema),
  connections: z.array(ConnectionModelSchema),
});

// We can infer the TypeScript types directly from our Zod schemas.
// This ensures our types always match our validation rules.
export type Circuit = z.infer<typeof CircuitSchema>;
export type ComponentModel = z.infer<typeof ComponentModelSchema>;
export type ConnectionModel = z.infer<typeof ConnectionModelSchema>;
