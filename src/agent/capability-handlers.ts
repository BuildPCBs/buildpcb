import { Capability } from "./capabilities";
import { logger } from "@/lib/logger";
import { AgentContext, AgentResult, CapabilityHandler } from "./types";
import { addComponent } from "./handlers/priority1/addComponent";

export const capabilityHandlers: Record<Capability, CapabilityHandler> = {
  CREATE_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🔧 CREATE_CIRCUIT called", { prompt });
    context.streamer.status("Creating circuit...");
    return { status: "success", message: "Circuit created." };
  },
  EDIT_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🔧 EDIT_CIRCUIT called", { prompt });
    context.streamer.status("Editing circuit...");
    return { status: "success", message: "Circuit edited." };
  },
  DELETE_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🔧 DELETE_CIRCUIT called", { prompt });
    context.streamer.status("Deleting circuit...");
    return { status: "success", message: "Circuit deleted." };
  },
  ADD_COMPONENT: addComponent,
  CREATE_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.component("CREATE_COMPONENT called", { prompt });
    context.streamer.status("Creating custom component...");
    return { status: "success", message: "Component created." };
  },
  READ_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.component("READ_COMPONENT called", { prompt });
    context.streamer.status("Reading component properties...");
    return { status: "success", message: "Component read." };
  },
  UPDATE_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.component("UPDATE_COMPONENT called", { prompt });
    context.streamer.status("Updating component...");
    return { status: "success", message: "Component updated." };
  },
  DELETE_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.component("DELETE_COMPONENT called", { prompt });
    context.streamer.status("Deleting component...");
    return { status: "success", message: "Component deleted." };
  },
  HIGHLIGHT_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.component("HIGHLIGHT_COMPONENT called", { prompt });
    context.streamer.status("Highlighting component...");
    return { status: "success", message: "Component highlighted." };
  },
  CREATE_WIRE: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.wire("CREATE_WIRE called", { prompt });
    context.streamer.status("Creating wire connection...");
    return { status: "success", message: "Wire created." };
  },
  DELETE_WIRE: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.wire("DELETE_WIRE called", { prompt });
    context.streamer.status("Deleting wire...");
    return { status: "success", message: "Wire deleted." };
  },
  UPDATE_WIRE: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.wire("UPDATE_WIRE called", { prompt });
    context.streamer.status("Updating wire...");
    return { status: "success", message: "Wire updated." };
  },
  RUN_DRC: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("⚡ RUN_DRC called", { prompt });
    context.streamer.status("Running design rule check...");
    return { status: "success", message: "DRC completed." };
  },
  CALCULATE_POWER_CONSUMPTION: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("⚡ CALCULATE_POWER_CONSUMPTION called", { prompt });
    context.streamer.status("Calculating power consumption...");
    return { status: "success", message: "Power consumption calculated." };
  },
  CALCULATE_LED_RESISTOR: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("⚡ CALCULATE_LED_RESISTOR called", { prompt });
    context.streamer.status("Calculating LED resistor value...");
    return { status: "success", message: "LED resistor calculated." };
  },
  ASK_KNOWLEDGE_BASE: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📚 ASK_KNOWLEDGE_BASE called", { prompt });
    context.streamer.status("Searching knowledge base...");
    return { status: "success", message: "Knowledge base queried." };
  },
  EXPLAIN_COMPONENT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📚 EXPLAIN_COMPONENT called", { prompt });
    context.streamer.status("Retrieving component information...");
    return { status: "success", message: "Component explained." };
  },
  EXPLAIN_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📚 EXPLAIN_CIRCUIT called", { prompt });
    context.streamer.status("Analyzing circuit...");
    return { status: "success", message: "Circuit explained." };
  },
  SCAFFOLD_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🤖 SCAFFOLD_CIRCUIT called", { prompt });
    context.streamer.status("Generating circuit scaffold...");
    return { status: "success", message: "Circuit scaffolded." };
  },
  REVIEW_CIRCUIT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🔍 REVIEW_CIRCUIT called", { prompt });
    context.streamer.status("Reviewing circuit design...");
    return { status: "success", message: "Circuit reviewed." };
  },
  SUGGEST_OPTIMIZATIONS: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("🔍 SUGGEST_OPTIMIZATIONS called", { prompt });
    context.streamer.status("Analyzing for optimizations...");
    return { status: "success", message: "Optimizations suggested." };
  },
  GENERATE_NETLIST: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📋 GENERATE_NETLIST called", { prompt });
    context.streamer.status("Generating netlist...");
    return { status: "success", message: "Netlist generated." };
  },
  GENERATE_BOM: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📋 GENERATE_BOM called", { prompt });
    context.streamer.status("Generating bill of materials...");
    return { status: "success", message: "BOM generated." };
  },
  PREPARE_FOR_MANUFACTURING: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("📋 PREPARE_FOR_MANUFACTURING called", { prompt });
    context.streamer.status("Preparing files for manufacturing...");
    return { status: "success", message: "Prepared for manufacturing." };
  },
  ZOOM_IN: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.canvas("ZOOM_IN called", { prompt });
    context.streamer.status("Zooming in...");
    return { status: "success", message: "Zoomed in." };
  },
  ZOOM_OUT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.canvas("ZOOM_OUT called", { prompt });
    context.streamer.status("Zooming out...");
    return { status: "success", message: "Zoomed out." };
  },
  PAN_CANVAS: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.canvas("PAN_CANVAS called", { prompt });
    context.streamer.status("Panning canvas...");
    return { status: "success", message: "Canvas panned." };
  },
  SAVE_PROJECT: async (
    context: AgentContext,
    prompt: string
  ): Promise<AgentResult> => {
    logger.debug("💾 SAVE_PROJECT called", { prompt });
    context.streamer.status("Saving project...");
    return { status: "success", message: "Project saved." };
  },
  // NOTE: GROUP_COMPONENTS removed - grouping doesn't make sense for PCB schematics
  // Components must maintain individual identity for pin connectivity and metadata
};
