export const capabilities = {
  // 🔥 PRIORITY 1 - Core circuit building blocks (full AgentContext: canvas, command manager, project)
  circuit: {
    CREATE_CIRCUIT: "CREATE_CIRCUIT",
    EDIT_CIRCUIT: "EDIT_CIRCUIT",
    DELETE_CIRCUIT: "DELETE_CIRCUIT",
  },
  // 🔥 PRIORITY 1 - Essential component operations (canvas-heavy, start here)
  component: {
    ADD_COMPONENT: "ADD_COMPONENT",
    READ_COMPONENT: "READ_COMPONENT",
    UPDATE_COMPONENT: "UPDATE_COMPONENT",
    DELETE_COMPONENT: "DELETE_COMPONENT",
    HIGHLIGHT_COMPONENT: "HIGHLIGHT_COMPONENT",

    // below mean drawing components from decription
    CREATE_COMPONENT: "CREATE_COMPONENT", // 🔚 VERY LAST - Complex: custom component creation from scratch
  },
  // 🔥 PRIORITY 1 - Wiring connects everything (Fabric canvas + netlist)
  wiring: {
    CREATE_WIRE: "CREATE_WIRE",
    DELETE_WIRE: "DELETE_WIRE",
    UPDATE_WIRE: "UPDATE_WIRE",
  },
  // ⚡ PRIORITY 2 - Analysis & validation (project/circuit data only, easier to implement)
  analysis: {
    RUN_DRC: "RUN_DRC",
    CALCULATE_POWER_CONSUMPTION: "CALCULATE_POWER_CONSUMPTION",
    CALCULATE_LED_RESISTOR: "CALCULATE_LED_RESISTOR",
  },
  // ⚡ PRIORITY 2 - Knowledge base for explanations (project context + RAG)
  knowledge: {
    ASK_KNOWLEDGE_BASE: "ASK_KNOWLEDGE_BASE",
    EXPLAIN_COMPONENT: "EXPLAIN_COMPONENT",
    EXPLAIN_CIRCUIT: "EXPLAIN_CIRCUIT",
  },
  // 📦 PRIORITY 3 - Advanced AI generation (complex, build after basics work)
  scaffolding: {
    SCAFFOLD_CIRCUIT: "SCAFFOLD_CIRCUIT",
  },
  // 📦 PRIORITY 3 - Design review (needs analysis + knowledge systems)
  review: {
    REVIEW_CIRCUIT: "REVIEW_CIRCUIT",
    SUGGEST_OPTIMIZATIONS: "SUGGEST_OPTIMIZATIONS",
  },
  // 📦 PRIORITY 3 - Manufacturing export (depends on complete circuit)
  netlist: {
    GENERATE_NETLIST: "GENERATE_NETLIST",
    GENERATE_BOM: "GENERATE_BOM",
    PREPARE_FOR_MANUFACTURING: "PREPARE_FOR_MANUFACTURING",
  },
  // 🎨 PRIORITY 2 - Canvas utilities (Fabric-specific, nice-to-have early)
  project: {
    ZOOM_IN: "ZOOM_IN",
    ZOOM_OUT: "ZOOM_OUT",
    PAN_CANVAS: "PAN_CANVAS",
    SAVE_PROJECT: "SAVE_PROJECT",
    GROUP_COMPONENTS: "GROUP_COMPONENTS",
  },
} as const;

export type Capability =
  (typeof capabilities)[keyof typeof capabilities][keyof (typeof capabilities)[keyof typeof capabilities]];
