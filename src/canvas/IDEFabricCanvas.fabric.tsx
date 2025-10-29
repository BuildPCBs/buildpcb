"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import {
  debugUndoRedo,
  debugHistoryStack,
  debugStateSaving,
} from "./undo-redo";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useSimpleWiringTool } from "./hooks/useSimpleWiringTool";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useHistoryStack } from "./hooks/useHistoryStack";
import { memoryMonitor } from "@/lib/memory-monitor";
import { logger } from "@/lib/logger";
import { canvasCommandManager } from "./canvas-command-manager";
import { setupComponentHandler } from "./componentHandlerSetup";
import { createSimpleComponentData } from "./SimpleComponentFactory";
import { ContextMenu } from "./ui/ContextMenu";
import { HorizontalRuler } from "./ui/HorizontalRuler";
import { VerticalRuler } from "./ui/VerticalRuler";
import { ComponentPickerOverlay } from "./ui/ComponentPickerOverlay";
import { CanvasProvider } from "../contexts/CanvasContext";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/lib/supabase";
import { EditableProjectName } from "@/components/project/EditableProjectName";
import { refDesService } from "@/lib/refdes-service";

interface IDEFabricCanvasProps {
  className?: string;
  onCanvasReady?: (canvas: any) => void;
  onNetlistReady?: (getNetlist: () => any) => void;
  onSave?: (overrideMessages?: any[]) => Promise<void>;
}

export function IDEFabricCanvas({
  className = "",
  onCanvasReady,
  onNetlistReady,
  onSave,
}: IDEFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [areRulersVisible, setAreRulersVisible] = useState(false);
  const [restorationInProgress, setRestorationInProgress] = useState(false);
  const [chatRestored, setChatRestored] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1); // Track current zoom level
  const lastZoomRef = useRef(1); // Use ref to avoid stale closure issues
  const [gridVisible, setGridVisible] = useState(false); // Manual grid toggle
  const [isComponentPickerVisible, setIsComponentPickerVisible] =
    useState(false);

  // Grid toggle function
  const toggleGrid = () => {
    const newGridVisible = !gridVisible;
    setGridVisible(newGridVisible);
    if (fabricCanvas) {
      const gridPattern = createGridPattern(
        fabricCanvas,
        gridSize,
        currentZoom
      );
      if (gridPattern) {
        fabricCanvas.backgroundColor = gridPattern;
        fabricCanvas.renderAll();
      }
    }
  };

  // Context menu and clipboard state - Refactored per specification
  const [menuState, setMenuState] = useState({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0, // Canvas coordinates for paste
    canvasY: 0, // Canvas coordinates for paste
    type: "canvas" as "object" | "canvas",
    target: null as fabric.Object | null,
  });
  const [clipboard, setClipboard] = useState<fabric.Object | null>(null);

  // Track last mouse position for smart paste positioning
  const lastMousePosition = useRef<{ x: number; y: number }>({
    x: 400,
    y: 300,
  });

  // Use viewport control hooks - DISABLED: These hooks are now Konva-only
  // useCanvasZoom(fabricCanvas);
  // const panState = useCanvasPan(fabricCanvas);
  // const viewportState = useCanvasViewport(fabricCanvas);

  // Placeholder values for disabled hooks
  const panState = { isPanMode: false, isDragging: false };
  const viewportState = { viewportTransform: [1, 0, 0, 1, 0, 0], zoom: 1 };

  const [netlist, setNetlist] = useState<any[]>([]);
  const netlistRef = useRef<any[]>([]);
  const [isNetlistRestored, setIsNetlistRestored] = useState(false);

  // Feature flag: Enable/disable multi-select wire movement
  // Set to false to disable multi-component selection entirely
  const ENABLE_MULTI_SELECT_WIRE_MOVEMENT = false;

  // Simple Wiring Tool - Works with Database Pin Data
  const wiringTool = useSimpleWiringTool({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
    initialNetlist: netlist, // Use restored netlist as initial state
    onNetlistChange: (nets) => {
      logger.wire("📡 Netlist updated from wiring tool:", {
        netCount: nets.length,
        totalConnections: nets.reduce(
          (sum, net) => sum + net.connections.length,
          0
        ),
        isRestored: isNetlistRestored,
      });
      setNetlist(nets);
      netlistRef.current = nets; // Update ref immediately for immediate access
    },
  });

  // Expose wiringTool globally for agent access
  // This allows the agent's drawWireTool to register wires properly
  // Update the reference whenever wiringTool changes (without re-logging)
  useEffect(() => {
    (window as any).__wiringTool = wiringTool;
    return () => {
      delete (window as any).__wiringTool;
    };
  }, [wiringTool]);

  // Keep netlistRef in sync with parent's netlist state (source of truth)
  useEffect(() => {
    netlistRef.current = netlist;
  }, [netlist]);

  const { currentProject, restoreCanvasData } = useProject();

  // Reset chat restoration flag when project changes
  const previousProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentProjectId = currentProject?.id || null;

    if (previousProjectIdRef.current !== currentProjectId) {
      logger.canvas("🔄 Project changed - resetting chat restoration flag", {
        from: previousProjectIdRef.current,
        to: currentProjectId,
      });

      setChatRestored(false);
      previousProjectIdRef.current = currentProjectId;
    }
  }, [currentProject?.id]);

  // History stack for undo/redo - DISABLED: Now Konva-only
  // const {
  //   saveState,
  //   initializeHistory,
  //   handleUndo: historyUndo,
  //   handleRedo: historyRedo,
  //   canUndo,
  //   canRedo,
  // } = useHistoryStack({ canvas: fabricCanvas });

  // Placeholder values for disabled history
  const saveState = () => {};
  const initializeHistory = () => {};
  const historyUndo = () => {};
  const historyRedo = () => {};
  const canUndo = false;
  const canRedo = false;

  // Debounced saveState to prevent excessive history saves
  const saveStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveState = useCallback(() => {
    if (saveStateTimeoutRef.current) {
      clearTimeout(saveStateTimeoutRef.current);
    }
    saveStateTimeoutRef.current = setTimeout(() => {
      saveState();
    }, 500); // 500ms debounce
  }, [saveState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveStateTimeoutRef.current) {
        clearTimeout(saveStateTimeoutRef.current);
      }
    };
  }, []);

  // Initialize history when canvas becomes available
  useEffect(() => {
    if (fabricCanvas && initializeHistory) {
      initializeHistory();

      // Add temporary debug logging
      const cleanup = debugUndoRedo();
      debugHistoryStack(fabricCanvas);
      debugStateSaving(fabricCanvas);

      return cleanup;
    }
  }, [fabricCanvas]); // Remove initializeHistory from deps to prevent re-running

  // Canvas restoration effect - only run once when both canvas and data are ready
  useEffect(() => {
    if (
      fabricCanvas &&
      currentProject?.canvas_settings &&
      !restorationInProgress
    ) {
      logger.canvas("Canvas ready, attempting to restore canvas data");
      logger.canvas("Canvas data to restore", {
        timestamp: new Date().toISOString(),
        hasObjects: currentProject.canvas_settings.objects?.length || 0,
        hasViewport: !!currentProject.canvas_settings.viewportTransform,
        zoom: currentProject.canvas_settings.zoom,
        hasChatData: !!currentProject.canvas_settings.chatData,
        chatMessageCount:
          currentProject.canvas_settings.chatData?.messages?.length || 0,
      });

      // Always try to restore chat data first, regardless of canvas objects
      if (currentProject.canvas_settings.chatData && !chatRestored) {
        logger.canvas("Chat data found, dispatching restoration event");
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("chatDataRestored", {
              detail: { chatData: currentProject.canvas_settings.chatData },
            })
          );
          setChatRestored(true);
        }, 100);
      }

      // Check if canvas already has objects (might have been restored already)
      const existingObjects = fabricCanvas.getObjects();
      if (existingObjects.length > 0) {
        logger.canvas(
          "Canvas already has objects, skipping canvas restoration but chat was restored"
        );
        return;
      }

      // Prevent multiple restorations
      setRestorationInProgress(true);

      restoreCanvasData(fabricCanvas)
        .then(() => {
          logger.canvas("Canvas restoration completed");

          // Reapply grid pattern after restoration
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            logger.canvas("Reapplying grid pattern after restoration");
            fabricCanvas.backgroundColor = gridPattern;
          } else {
            logger.canvas("Failed to recreate grid pattern after restoration");
          }

          fabricCanvas.renderAll();
          setRestorationInProgress(false);
        })
        .catch((error) => {
          console.error("❌ Canvas restoration failed:", error);

          // Still apply grid even if restoration failed
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            logger.canvas("Applying grid pattern after restoration failure");
            fabricCanvas.backgroundColor = gridPattern;
            fabricCanvas.renderAll();
          }

          setRestorationInProgress(false);
        });
    }
  }, [
    fabricCanvas,
    currentProject?.canvas_settings,
    restoreCanvasData,
    chatRestored,
  ]);

  // Global debugging functions for chat restoration testing
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).testChatRestoration = () => {
        logger.canvas("Testing chat restoration...");
        logger.canvas(
          "Current project chat data:",
          currentProject?.canvas_settings?.chatData
        );
        logger.canvas("Chat restored state:", chatRestored);
        logger.canvas("Restoration in progress:", restorationInProgress);
        return {
          hasChatData: !!currentProject?.canvas_settings?.chatData,
          chatRestored,
          restorationInProgress,
          messageCount:
            currentProject?.canvas_settings?.chatData?.messages?.length || 0,
        };
      };

      (window as any).manualChatRestore = () => {
        logger.canvas("Manual chat restoration triggered");
        if (currentProject?.canvas_settings?.chatData) {
          window.dispatchEvent(
            new CustomEvent("chatDataRestored", {
              detail: { chatData: currentProject.canvas_settings.chatData },
            })
          );
          setChatRestored(true);
          logger.canvas("Manual chat restoration event dispatched");
        } else {
          logger.canvas("No chat data available for manual restoration");
        }
      };

      (window as any).checkChatMessages = () => {
        logger.canvas("Checking current chat messages...");
        // This will be handled by the AIChatContext
        window.dispatchEvent(new CustomEvent("checkChatMessages"));
      };
    }
  }, [currentProject, chatRestored, restorationInProgress]);

  const wiringToolRef = useRef(wiringTool);

  // Update ref when wiringTool changes
  useEffect(() => {
    wiringToolRef.current = wiringTool;
  }, [wiringTool]);

  // Stable callback for toggle wire mode
  const toggleWireMode = useCallback(() => {
    wiringToolRef.current?.toggleWireMode();
  }, []);

  // Netlist restoration listener
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleNetlistRestored = (event: CustomEvent) => {
        const { netlist: restoredNetlist } = event.detail;
        logger.wire("Netlist restored from project data:", {
          netCount: restoredNetlist?.nets?.length || 0,
          totalConnections:
            restoredNetlist?.nets?.reduce(
              (sum: number, net: any) => sum + (net.connections?.length || 0),
              0
            ) || 0,
        });

        // Update the netlist state FIRST before recreating wiring tool
        if (restoredNetlist?.nets) {
          logger.wire("Setting restored netlist as initial state...");
          setNetlist(restoredNetlist.nets);
          netlistRef.current = restoredNetlist.nets;
          setIsNetlistRestored(true);

          // UPDATE THE WIRING TOOL'S NETLIST: Call setNetlist on the wiring tool to update its internal netlist
          if (wiringTool && wiringTool.setNetlist) {
            logger.wire(
              "🔄 Updating wiring tool netlist with restored nets..."
            );
            wiringTool.setNetlist(restoredNetlist.nets);
          }
        }

        // Recreate visual wires on the canvas
        if (fabricCanvas && restoredNetlist?.nets) {
          logger.wire("Recreating visual wires from restored netlist...");

          // Clear pin wire tracker for fresh offset calculation
          pinWireTracker.current.clear();

          // Clear any existing wires first
          const existingWires = fabricCanvas
            .getObjects()
            .filter(
              (obj: any) =>
                obj.wireType === "connection" ||
                (obj.data?.type === "junctionDot" && obj.data?.pinConnection)
            );
          existingWires.forEach((wire) => fabricCanvas.remove(wire));

          // Recreate wires for each net
          let totalWiresCreated = 0;
          restoredNetlist.nets.forEach((net: any, netIndex: number) => {
            logger.wire(
              `🔗 Processing net ${netIndex + 1}/${
                restoredNetlist.nets.length
              }: ${net.netId}`,
              {
                connections: net.connections.length,
                netConnections: net.connections,
              }
            );

            // Log detailed connection analysis
            if (net.connections && net.connections.length >= 2) {
              logger.wire(`🔍 Analyzing connections for net ${net.netId}:`);
              net.connections.forEach((conn: any, idx: number) => {
                logger.wire(
                  `  ${idx + 1}. ${conn.componentId}:${conn.pinNumber}`
                );
              });

              // Check for same starting pins
              const connectionsByPin = new Map<string, any[]>();
              net.connections.forEach((conn: any) => {
                const pinId = `${conn.componentId}:${conn.pinNumber}`;
                if (!connectionsByPin.has(pinId)) {
                  connectionsByPin.set(pinId, []);
                }
                connectionsByPin.get(pinId)!.push(conn);
              });

              // Log pin analysis
              connectionsByPin.forEach((conns, pinId) => {
                if (conns.length > 1) {
                  logger.wire(
                    `⚠️ Multiple connections from/to same pin ${pinId}: ${conns.length} connections`
                  );
                }
              });
            }

            if (net.connections && net.connections.length >= 2) {
              // Create wires between consecutive connections in the net
              logger.wire(
                `🔗 Creating ${
                  net.connections.length - 1
                } consecutive wire pairs for net ${net.netId}`
              );

              for (let i = 0; i < net.connections.length - 1; i++) {
                const fromConn = net.connections[i];
                const toConn = net.connections[i + 1];

                logger.wire(
                  `🔍 Wire ${i + 1}/${
                    net.connections.length - 1
                  }: Looking for pins: ${fromConn.componentId}:${
                    fromConn.pinNumber
                  } → ${toConn.componentId}:${toConn.pinNumber}`
                );

                // Find the pins for these connections
                const fromPin = findPinForConnection(
                  fromConn.componentId,
                  fromConn.pinNumber
                );
                const toPin = findPinForConnection(
                  toConn.componentId,
                  toConn.pinNumber
                );

                logger.wire(
                  `📍 Pin search results: fromPin=${!!fromPin}, toPin=${!!toPin}`
                );

                if (fromPin && toPin) {
                  // Create the visual wire
                  logger.wire(`✅ Creating wire between found pins`);
                  const wire = createWireBetweenPins(fromPin, toPin);
                  if (wire) {
                    totalWiresCreated++;
                    // Register the wire with the wiring tool so it follows component movement
                    wiringTool.registerRestoredWire(
                      wire,
                      fromConn.componentId,
                      fromConn.pinNumber.toString(),
                      toConn.componentId,
                      toConn.pinNumber.toString()
                    );

                    // Add junction dots
                    addJunctionDotsToWire(wire);
                    logger.wire(
                      `🔴 Wire created, registered with wiring tool, and dots added successfully`
                    );
                  } else {
                    logger.wire(`❌ Failed to create wire object`);
                  }
                } else {
                  logger.wire(
                    `❌ Missing pins: fromPin=${!!fromPin}, toPin=${!!toPin}, skipping wire creation`
                  );

                  // Debug: List all available components and pins
                  const allComponents = fabricCanvas
                    .getObjects()
                    .filter(
                      (obj) =>
                        (obj.type === "group" &&
                          (obj as any).data?.type === "component") ||
                        (obj as any).data?.type === "component"
                    );
                  logger.wire(
                    `🔍 Available components on canvas:`,
                    allComponents.map((comp) => {
                      const compData = (comp as any).data;
                      return {
                        componentId: compData?.componentId,
                        type: compData?.componentType,
                        pins:
                          comp.type === "group"
                            ? (comp as fabric.Group)
                                .getObjects()
                                .filter(
                                  (obj) => (obj as any).data?.type === "pin"
                                ).length
                            : 0,
                      };
                    })
                  );
                }
              }
            } else {
              logger.wire(
                `⚠️ Net ${net.netId} has insufficient connections (${
                  net.connections?.length || 0
                }), skipping`
              );
            }
          });

          fabricCanvas.renderAll();
          logger.wire("Visual wires recreated successfully", {
            totalWiresCreated,
            totalNetsProcessed: restoredNetlist.nets.length,
            currentCanvasObjects: fabricCanvas.getObjects().length,
          });
        }
      };

      // Handle component deletion from external sources (like AI commands)
      const handleDeleteComponent = (event: CustomEvent) => {
        const { componentId, component } = event.detail;
        logger.canvas(`🗑️ External component deletion request: ${componentId}`);

        if (component && fabricCanvas) {
          // Find and execute deletion logic similar to handleObjectDeletion
          // This will be executed by the proper handler defined later
          window.dispatchEvent(
            new CustomEvent("executeDelete", {
              detail: { component },
            })
          );
        }
      };

      window.addEventListener(
        "netlistRestored",
        handleNetlistRestored as EventListener
      );

      window.addEventListener(
        "deleteComponent",
        handleDeleteComponent as EventListener
      );

      return () => {
        window.removeEventListener(
          "netlistRestored",
          handleNetlistRestored as EventListener
        );
        window.removeEventListener(
          "deleteComponent",
          handleDeleteComponent as EventListener
        );
      };
    }
  }, [fabricCanvas]);

  // Helper function to find a pin by component ID and pin number
  const findPinForConnection = useCallback(
    (componentId: string, pinNumber: string) => {
      if (!fabricCanvas) {
        logger.wire(`❌ findPinForConnection: No canvas`);
        return null;
      }

      logger.wire(
        `🔍 findPinForConnection: Looking for ${componentId}:${pinNumber}`
      );

      const objects = fabricCanvas.getObjects();
      let totalPinsChecked = 0;
      let foundComponents = 0;

      for (const obj of objects) {
        if (obj.type === "group") {
          const groupData = (obj as any).data;
          if (groupData?.type === "component") {
            foundComponents++;
            logger.wire(
              `📦 Checking component group: ${groupData.componentId}`
            );
          }

          // CRITICAL FIX: Check if THIS GROUP is the right component first
          // This prevents wires from connecting to the wrong instance when multiple components exist
          const isTargetComponent =
            (obj as any).id === componentId ||
            (obj as any).data?.componentId === componentId;

          if (!isTargetComponent) {
            continue; // Skip this group - it's not the component we're looking for
          }

          logger.wire(`✅ Found target component group: ${componentId}`);

          // Check objects within THIS specific group
          const groupObjects = (obj as fabric.Group).getObjects();
          for (const groupObj of groupObjects) {
            const pinData = (groupObj as any).data;
            if (pinData && pinData.type === "pin") {
              totalPinsChecked++;
              logger.wire(
                `📍 Found pin in target component: ${pinData.pinNumber}`
              );

              if (pinData.pinNumber.toString() === pinNumber.toString()) {
                logger.wire(
                  `✅ Found matching pin: ${componentId}:${pinNumber}`
                );
                return groupObj;
              }
            }
          }
        } else {
          // Check direct objects
          const pinData = (obj as any).data;
          if (pinData && pinData.type === "pin") {
            totalPinsChecked++;
            logger.wire(
              `📍 Found direct pin: ${pinData.componentId}:${pinData.pinNumber}`
            );

            if (
              pinData.componentId === componentId &&
              pinData.pinNumber.toString() === pinNumber.toString()
            ) {
              logger.wire(
                `✅ Found matching direct pin: ${componentId}:${pinNumber}`
              );
              return obj;
            }
          }
        }
      }

      logger.wire(
        `❌ Pin not found: ${componentId}:${pinNumber}. Checked ${totalPinsChecked} pins across ${foundComponents} components`
      );
      return null;
    },
    [fabricCanvas]
  );

  // Helper function to track pin wire connections for offset calculation
  const pinWireTracker = useRef<Map<string, number>>(new Map());

  // Helper function to get offset for multiple wires from same pin
  const getPinWireOffset = useCallback(
    (pinId: string, pinCenter: fabric.Point) => {
      const currentCount = pinWireTracker.current.get(pinId) || 0;
      pinWireTracker.current.set(pinId, currentCount + 1);

      if (currentCount === 0) {
        // First wire from this pin - no offset
        logger.wire(`📍 Pin ${pinId}: First wire, no offset applied`);
        return pinCenter;
      }

      // Apply circular offset for additional wires (3px radius)
      const offsetRadius = 3;
      const angleStep = (2 * Math.PI) / 8; // Support up to 8 wires per pin
      const angle = angleStep * currentCount;

      const offsetPoint = new fabric.Point(
        pinCenter.x + Math.cos(angle) * offsetRadius,
        pinCenter.y + Math.sin(angle) * offsetRadius
      );

      logger.wire(
        `📍 Pin ${pinId}: Wire #${currentCount + 1}, offset applied`,
        {
          original: { x: pinCenter.x, y: pinCenter.y },
          offset: { x: offsetPoint.x, y: offsetPoint.y },
          angle: angle * (180 / Math.PI), // Convert to degrees for readability
        }
      );

      return offsetPoint;
    },
    []
  );

  // Helper function to create a wire between two pins
  const createWireBetweenPins = useCallback(
    (fromPin: fabric.Object, toPin: fabric.Object) => {
      if (!fabricCanvas) return null;

      const fromCenter = getAbsoluteCenter(fromPin);
      const toCenter = getAbsoluteCenter(toPin);

      // Generate unique pin identifiers
      const fromPinData = (fromPin as any).data;
      const toPinData = (toPin as any).data;
      const fromPinId = `${fromPinData.componentId}:${fromPinData.pinNumber}`;
      const toPinId = `${toPinData.componentId}:${toPinData.pinNumber}`;

      // Apply offsets for multiple wires from same pin
      const offsetFromCenter = getPinWireOffset(fromPinId, fromCenter);
      const offsetToCenter = getPinWireOffset(toPinId, toCenter);

      // Calculate orthogonal path (L-shaped with 90° corners) using offset centers
      const dx = offsetToCenter.x - offsetFromCenter.x;
      const dy = offsetToCenter.y - offsetFromCenter.y;

      // Decide whether to go horizontal first or vertical first
      const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

      // Create SVG path data for smooth wire rendering
      let pathData = `M ${offsetFromCenter.x} ${offsetFromCenter.y}`;

      if (goHorizontalFirst) {
        // Horizontal first, then vertical
        if (Math.abs(dx) > 1) {
          pathData += ` L ${offsetToCenter.x} ${offsetFromCenter.y}`;
        }
        if (Math.abs(dy) > 1) {
          pathData += ` L ${offsetToCenter.x} ${offsetToCenter.y}`;
        }
      } else {
        // Vertical first, then horizontal
        if (Math.abs(dy) > 1) {
          pathData += ` L ${offsetFromCenter.x} ${offsetToCenter.y}`;
        }
        if (Math.abs(dx) > 1) {
          pathData += ` L ${offsetToCenter.x} ${offsetToCenter.y}`;
        }
      }

      logger.wire(`🎨 Creating wire path: ${pathData}`, {
        fromPinId,
        toPinId,
        offsetFromCenter: { x: offsetFromCenter.x, y: offsetFromCenter.y },
        offsetToCenter: { x: offsetToCenter.x, y: offsetToCenter.y },
      });

      // Create a single path object for smooth wire rendering
      const wirePath = new fabric.Path(pathData, {
        stroke: "#0038DF",
        strokeWidth: 1,
        fill: "",
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });

      // Add connection data to the path
      (wirePath as any).connectionData = {
        fromComponentId: fromPinData.componentId,
        fromPinNumber: fromPinData.pinNumber.toString(),
        toComponentId: toPinData.componentId,
        toPinNumber: toPinData.pinNumber.toString(),
      };

      // Mark as wire
      (wirePath as any).wireType = "connection";

      fabricCanvas.add(wirePath);

      // Debug: Confirm wire was added to canvas
      logger.wire(`✅ Wire added to canvas`, {
        pathData,
        canvasObjectCount: fabricCanvas.getObjects().length,
        wireId: (wirePath as any).connectionData,
      });

      return wirePath;
    },
    [fabricCanvas]
  );

  // Helper function to get absolute center of a pin (accounting for group transformations)
  const getAbsoluteCenter = useCallback((pin: fabric.Object) => {
    if (pin.group) {
      const pinCenter = new fabric.Point(pin.left || 0, pin.top || 0);
      return fabric.util.transformPoint(
        pinCenter,
        pin.group.calcTransformMatrix()
      );
    }
    return new fabric.Point(pin.left || 0, pin.top || 0);
  }, []);

  // Helper function to add junction dots to a wire
  const addJunctionDotsToWire = useCallback(
    (wire: fabric.Line | fabric.Path) => {
      if (!fabricCanvas) return;

      // Get the actual wire endpoints from the wire's path
      const endpoints = getWireEndpoints(wire);
      if (!endpoints) return;

      // Create junction dots at wire endpoints
      const createJunctionDot = (position: fabric.Point) => {
        const dot = new fabric.Circle({
          radius: 3,
          fill: "#0038DF",
          stroke: "#ffffff",
          strokeWidth: 1,
          left: position.x,
          top: position.y,
          selectable: false,
          hasControls: false,
          hasBorders: false,
          evented: false,
          originX: "center",
          originY: "center",
        });
        (dot as any).data = { type: "junctionDot", pinConnection: true };
        return dot;
      };

      const startDot = createJunctionDot(
        new fabric.Point(endpoints.start.x, endpoints.start.y)
      );
      const endDot = createJunctionDot(
        new fabric.Point(endpoints.end.x, endpoints.end.y)
      );

      fabricCanvas.add(startDot);
      fabricCanvas.add(endDot);
    },
    [fabricCanvas]
  );

  // Helper function to get wire endpoints
  const getWireEndpoints = useCallback((wire: fabric.Line | fabric.Path) => {
    if (wire.type === "line") {
      const line = wire as fabric.Line;
      return {
        start: { x: line.x1 || 0, y: line.y1 || 0 },
        end: { x: line.x2 || 0, y: line.y2 || 0 },
      };
    } else if (wire.type === "path") {
      const path = wire as fabric.Path;
      const pathData = path.path;
      if (pathData && pathData.length > 0) {
        // Get the first move command (start point)
        const startCmd = pathData[0];
        if (
          startCmd.length >= 3 &&
          typeof startCmd[1] === "number" &&
          typeof startCmd[2] === "number"
        ) {
          const start = { x: startCmd[1] as number, y: startCmd[2] as number };

          // Find the last line command with coordinates
          let end = start;
          for (let i = pathData.length - 1; i >= 0; i--) {
            const cmd = pathData[i];
            if (
              cmd[0] === "L" &&
              cmd.length >= 3 &&
              typeof cmd[1] === "number" &&
              typeof cmd[2] === "number"
            ) {
              end = { x: cmd[1] as number, y: cmd[2] as number };
              break;
            }
          }

          return { start, end };
        }
      }
    }
    return null;
  }, []);

  // Ruler dimensions and grid settings
  const rulerSize = 30;
  const gridSize = 10; // Grid spacing in pixels

  // Helper function to create background grid pattern
  const createGridPattern = (
    canvas: fabric.Canvas,
    gridSize: number,
    zoom: number = 1
  ) => {
    logger.canvas("Creating grid pattern with size:", gridSize, "zoom:", zoom);
    // Create a temporary canvas for the pattern
    const patternCanvas = document.createElement("canvas");
    const patternCtx = patternCanvas.getContext("2d");
    if (!patternCtx) return null;

    // Set pattern canvas size to grid size
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;

    // Calculate grid line opacity based on zoom level and manual toggle
    // Grid lines are invisible at normal zoom, become visible when zoomed in or manually enabled
    let lineOpacity = 0;

    if (gridVisible) {
      // Manual grid toggle always shows grid at 50% opacity
      lineOpacity = 0.5;
    } else if (zoom >= 1.5) {
      // Auto-show grid at 1.5x zoom and above
      lineOpacity = Math.min((zoom - 1.5) * 0.3, 0.8); // Max opacity 0.8
    }

    if (lineOpacity > 0) {
      // Draw grid lines
      patternCtx.strokeStyle = `rgba(204, 204, 204, ${lineOpacity})`; // Semi-transparent gray
      patternCtx.lineWidth = Math.max(0.5, 1 / zoom); // Thinner lines when zoomed out
      patternCtx.beginPath();

      // Vertical line
      patternCtx.moveTo(gridSize, 0);
      patternCtx.lineTo(gridSize, gridSize);

      // Horizontal line
      patternCtx.moveTo(0, gridSize);
      patternCtx.lineTo(gridSize, gridSize);

      patternCtx.stroke();
      logger.canvas(
        `Grid pattern created with opacity: ${lineOpacity} (manual: ${gridVisible})`
      );
    } else {
      logger.canvas("Grid pattern created (invisible at current zoom)");
    }

    // Create Fabric.js pattern
    const pattern = new fabric.Pattern({
      source: patternCanvas,
      repeat: "repeat",
    });

    return pattern;
  };

  // Context menu paste handler - uses right-click position
  const handleContextPaste = () => {
    logger.canvas("handleContextPaste called");
    logger.canvas("menuState:", menuState);
    handlePaste({ x: menuState.canvasX, y: menuState.canvasY });
  };

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Check if canvas element already has a Fabric.js instance
    const existingCanvas = (canvasRef.current as any).fabric;
    if (existingCanvas) {
      logger.canvas("Disposing existing canvas before creating new one");
      existingCanvas.dispose();
    }

    // Get initial container dimensions
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Account for ruler space
    const canvasWidth = rect.width - rulerSize;
    const canvasHeight = rect.height - rulerSize;

    logger.canvas(
      `Creating new canvas with dimensions: ${canvasWidth}x${canvasHeight}`
    );

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#FFFFFF", // White background for better grid visibility
      enableRetinaScaling: true, // Enable high-DPI rendering
      imageSmoothingEnabled: false, // Disable image smoothing for crisp rendering
      renderOnAddRemove: true,
      selection: false, // DISABLE multi-selection (no drag-to-select box)
    });

    // Initialize wire mode flag on canvas
    (canvas as any).wireMode = false;

    // Set canvas context to disable image smoothing for crisp rendering at all zoom levels
    const ctx = canvas.getContext();
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      // @ts-expect-error - browser prefixes
      ctx.webkitImageSmoothingEnabled = false;
      // @ts-expect-error - browser prefixes
      ctx.mozImageSmoothingEnabled = false;
      // @ts-expect-error - browser prefixes
      ctx.msImageSmoothingEnabled = false;
      // @ts-expect-error - browser prefixes
      ctx.oImageSmoothingEnabled = false;
    }

    // Create and apply grid pattern immediately
    const gridPattern = createGridPattern(canvas, gridSize, 1); // Start with zoom = 1
    if (gridPattern) {
      logger.canvas("Applying initial grid pattern to canvas");
      canvas.backgroundColor = gridPattern;
      canvas.renderAll();
      logger.canvas("Grid pattern applied and canvas rendered");
    } else {
      logger.canvas("Failed to create initial grid pattern");
      // Fallback: ensure white background
      canvas.backgroundColor = "#FFFFFF";
      canvas.renderAll();
    }

    setFabricCanvas(canvas);
    setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

    // Notify parent that canvas is ready
    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    // Provide netlist access to parent
    if (onNetlistReady) {
      onNetlistReady(() => {
        const currentNetlist = netlistRef.current; // Use ref for current value (avoids stale closure)

        // DEBUG: Let's see what the actual netlist contains
        logger.wire("🔍 DEBUG - netlist inspection:", {
          netlistType: typeof netlistRef.current,
          netlistIsArray: Array.isArray(netlistRef.current),
          netlistLength: netlistRef.current?.length || 0,
          netlistContent: netlistRef.current,
          currentNetlistIsArray: Array.isArray(currentNetlist),
          currentNetlistLength: currentNetlist?.length || 0,
        });

        logger.wire("Netlist getter called, returning current netlist:", {
          netCount: currentNetlist.length,
          totalConnections: currentNetlist.reduce(
            (sum, net) => sum + (net.connections?.length || 0),
            0
          ),
        });
        return currentNetlist;
      });
    }

    // Register canvas with command manager
    canvasCommandManager.setCanvas(canvas);

    // Start memory monitoring
    memoryMonitor.startMonitoring();

    // Setup component handler with the new canvas
    const cleanupComponentHandler = setupComponentHandler(canvas);

    // Final render to ensure everything is visible
    setTimeout(() => {
      canvas.renderAll();
      logger.canvas("Final canvas render completed");
    }, 100);

    // Cleanup function to dispose canvas when component unmounts or useEffect re-runs
    return () => {
      logger.canvas("Disposing canvas in cleanup function");

      // Stop memory monitoring
      memoryMonitor.stopMonitoring();

      // Clean up component event listeners
      if (cleanupComponentHandler) {
        cleanupComponentHandler();
      }

      canvas.dispose();
    };
  }, [rulerSize]);

  // Update grid when zoom or visibility changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const updateGrid = () => {
      const gridPattern = createGridPattern(
        fabricCanvas,
        gridSize,
        currentZoom
      );
      if (gridPattern) {
        fabricCanvas.backgroundColor = gridPattern;
        fabricCanvas.renderAll();
      }
    };

    updateGrid();
  }, [fabricCanvas, currentZoom, gridSize, gridVisible]);

  // Dynamic canvas resizing with ResizeObserver
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Account for ruler space
        const canvasWidth = width - rulerSize;
        const canvasHeight = height - rulerSize;

        // Only resize if dimensions actually changed
        if (canvasWidth > 0 && canvasHeight > 0) {
          fabricCanvas.setDimensions({
            width: canvasWidth,
            height: canvasHeight,
          });
          setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

          // Reapply grid pattern after resize
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            logger.canvas(
              "Reapplying grid pattern after ResizeObserver resize"
            );
            fabricCanvas.backgroundColor = gridPattern;
          }

          fabricCanvas.renderAll();

          logger.canvas(`Canvas resized to: ${canvasWidth}x${canvasHeight}`);
        }
      }
    });

    // Start observing the container
    resizeObserver.observe(containerRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [fabricCanvas, rulerSize]);

  // Additional window resize listener as backup
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const handleWindowResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasWidth = rect.width - rulerSize;
        const canvasHeight = rect.height - rulerSize;

        if (canvasWidth > 0 && canvasHeight > 0) {
          fabricCanvas.setDimensions({
            width: canvasWidth,
            height: canvasHeight,
          });
          setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

          // Reapply grid pattern after resize
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            logger.canvas("Reapplying grid pattern after window resize");
            fabricCanvas.backgroundColor = gridPattern;
          }

          fabricCanvas.renderAll();
        }
      }
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [fabricCanvas, rulerSize]);

  // PART 2: Component-Wire Follow Logic + Ruler Visibility + Snap-to-Grid + Alignment Guides
  useEffect(() => {
    if (!fabricCanvas) return;

    logger.canvas(
      "Setting up component-wire follow logic, ruler visibility, snap-to-grid, and alignment guides"
    );

    // Helper function to snap coordinate to grid
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Helper function to remove all alignment guides
    const removeAlignmentGuides = () => {
      const guidesToRemove = fabricCanvas
        .getObjects()
        .filter((obj) => (obj as any).isAlignmentGuide);
      guidesToRemove.forEach((guide) => fabricCanvas.remove(guide));
    };

    // Helper function to create alignment guide line
    const createAlignmentGuide = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => {
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: "#FF0000",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as any).isAlignmentGuide = true;
      return line;
    };

    // Helper function to check for alignments and draw guides
    const checkAlignments = (movingObject: fabric.Object) => {
      removeAlignmentGuides(); // Clear previous guides

      const movingBounds = movingObject.getBoundingRect();
      const movingCenterX = movingBounds.left + movingBounds.width / 2;
      const movingCenterY = movingBounds.top + movingBounds.height / 2;
      const tolerance = 5; // Alignment tolerance in pixels

      // Get all other objects (excluding the moving object and existing guides)
      const otherObjects = fabricCanvas
        .getObjects()
        .filter(
          (obj) =>
            obj !== movingObject &&
            !(obj as any).isAlignmentGuide &&
            obj.visible &&
            obj.selectable
        );

      otherObjects.forEach((obj) => {
        const objBounds = obj.getBoundingRect();
        const objCenterX = objBounds.left + objBounds.width / 2;
        const objCenterY = objBounds.top + objBounds.height / 2;

        // Vertical alignment guides (X-axis alignments)
        // Left edges align
        if (Math.abs(movingBounds.left - objBounds.left) <= tolerance) {
          const guide = createAlignmentGuide(
            objBounds.left,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objBounds.left,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Center X align
        if (Math.abs(movingCenterX - objCenterX) <= tolerance) {
          const guide = createAlignmentGuide(
            objCenterX,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objCenterX,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Right edges align
        if (
          Math.abs(
            movingBounds.left +
              movingBounds.width -
              (objBounds.left + objBounds.width)
          ) <= tolerance
        ) {
          const guide = createAlignmentGuide(
            objBounds.left + objBounds.width,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objBounds.left + objBounds.width,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Horizontal alignment guides (Y-axis alignments)
        // Top edges align
        if (Math.abs(movingBounds.top - objBounds.top) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objBounds.top
          );
          fabricCanvas.add(guide);
        }

        // Center Y align
        if (Math.abs(movingCenterY - objCenterY) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objCenterY,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objCenterY
          );
          fabricCanvas.add(guide);
        }

        // Bottom edges align
        if (
          Math.abs(
            movingBounds.top +
              movingBounds.height -
              (objBounds.top + objBounds.height)
          ) <= tolerance
        ) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top + objBounds.height,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objBounds.top + objBounds.height
          );
          fabricCanvas.add(guide);
        }
      });

      fabricCanvas.renderAll();
    };

    const handleObjectMoving = (e: any) => {
      const movingObject = e.target;

      // Show rulers when any object starts moving
      setAreRulersVisible(true);

      // DEBUG: Track component pins during movement
      if (movingObject && movingObject.type === "group") {
        const groupObjects = (movingObject as fabric.Group).getObjects();
        const pins = groupObjects.filter(
          (obj: any) => obj.data?.type === "pin"
        );
        const visiblePins = pins.filter((pin: any) => pin.visible !== false);

        logger.canvas(`🎯 Component moving - pins status:`, {
          totalPins: pins.length,
          visiblePins: visiblePins.length,
          pinDetails: pins.map((pin: any) => ({
            id: pin.data?.pinId,
            visible: pin.visible,
            opacity: pin.opacity,
          })),
        });
      }

      // PART 2: Snap-to-Grid Logic
      if (
        movingObject &&
        movingObject.left !== undefined &&
        movingObject.top !== undefined
      ) {
        const snappedLeft = snapToGrid(movingObject.left, gridSize);
        const snappedTop = snapToGrid(movingObject.top, gridSize);

        movingObject.set({
          left: snappedLeft,
          top: snappedTop,
        });
      }

      // PART 3: Smart Alignment Guides
      if (movingObject) {
        checkAlignments(movingObject);
      }

      // PART 4: Update wires for moving components (handles both single and multi-select)
      if (movingObject) {
        // Handle multiple selected components (ActiveSelection)
        if (
          movingObject.type === "activeSelection" &&
          ENABLE_MULTI_SELECT_WIRE_MOVEMENT
        ) {
          const selectedObjects = (movingObject as any)._objects || [];
          const componentIds: string[] = [];

          selectedObjects.forEach((obj: any) => {
            const componentId =
              obj.data?.componentId || obj.id || (obj as any).componentId;

            const isComponent =
              obj.data?.type === "component" ||
              obj.componentType === "component" ||
              obj.type === "group";

            if (isComponent && componentId) {
              componentIds.push(componentId);
            }
          });

          if (componentIds.length > 0) {
            componentIds.forEach((componentId) => {
              wiringTool.updateWiresForComponent(componentId);
            });
          }
        }
        // Handle single component movement
        else if (
          ((movingObject as any).componentType ||
            movingObject.type === "group") &&
          movingObject.type === "group"
        ) {
          const componentId =
            (movingObject as any).data?.componentId ||
            (movingObject as any).id ||
            `component_${Date.now()}`;
          wiringTool.updateWiresForComponent(componentId);
        }
      }
    };

    const handleObjectMoved = (e: any) => {
      const movedObject = e.target;

      // DEBUG: Track component pins after movement
      if (movedObject && movedObject.type === "group") {
        const groupObjects = (movedObject as fabric.Group).getObjects();
        const pins = groupObjects.filter(
          (obj: any) => obj.data?.type === "pin"
        );
        const visiblePins = pins.filter((pin: any) => pin.visible !== false);

        logger.canvas(`✅ Component moved - pins status:`, {
          totalPins: pins.length,
          visiblePins: visiblePins.length,
          pinDetails: pins.map((pin: any) => ({
            id: pin.data?.pinId,
            visible: pin.visible,
            opacity: pin.opacity,
          })),
        });
      }

      // Remove alignment guides when movement stops
      removeAlignmentGuides();

      // Final position update for components (handles both single and multi-select)
      if (movedObject) {
        // Handle multiple selected components (ActiveSelection)
        if (
          movedObject.type === "activeSelection" &&
          ENABLE_MULTI_SELECT_WIRE_MOVEMENT
        ) {
          const selectedObjects = (movedObject as any)._objects || [];
          const componentIds: string[] = [];

          selectedObjects.forEach((obj: any) => {
            const componentId =
              obj.data?.componentId || obj.id || (obj as any).componentId;

            const isComponent =
              obj.data?.type === "component" ||
              obj.componentType === "component" ||
              obj.type === "group";

            if (isComponent && componentId) {
              componentIds.push(componentId);
            }
          });

          if (componentIds.length > 0) {
            componentIds.forEach((componentId) => {
              wiringTool.updateWiresForComponent(componentId);
            });
            // Recalculate intersection dots ONLY after movement completes
            // This prevents duplicate dots during continuous dragging
            if (wiringTool.addWireIntersectionDots) {
              wiringTool.addWireIntersectionDots();
            }
          }
        }
        // Handle single component movement
        else if (
          ((movedObject as any).componentType ||
            movedObject.type === "group") &&
          movedObject.type === "group"
        ) {
          const componentId =
            (movedObject as any).data?.componentId ||
            (movedObject as any).id ||
            `component_${Date.now()}`;
          wiringTool.updateWiresForComponent(componentId);
          // Recalculate intersection dots ONLY after movement completes
          // This prevents duplicate dots during continuous dragging
          if (wiringTool.addWireIntersectionDots) {
            wiringTool.addWireIntersectionDots();
          }
        }
      }

      // Save state for undo/redo
      debouncedSaveState();
    };

    // New ruler visibility handlers per design requirements
    const handleSelectionCreated = () => {
      logger.canvas("Object selected - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionUpdated = () => {
      logger.canvas("Selection updated - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionCleared = () => {
      logger.canvas("Selection cleared - hiding rulers");
      setAreRulersVisible(false);
      // Also remove any lingering alignment guides
      removeAlignmentGuides();
    };

    // Attach all listeners
    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectMoved);
    fabricCanvas.on("object:added", () => {
      // Debounce saveState to prevent multiple rapid calls
      debouncedSaveState();
    });
    fabricCanvas.on("object:removed", () => {
      // Debounce saveState to prevent multiple rapid calls
      debouncedSaveState();
    });
    fabricCanvas.on("selection:created", handleSelectionCreated);
    fabricCanvas.on("selection:updated", handleSelectionUpdated);
    fabricCanvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectMoved);
      fabricCanvas.off("object:added", () => {
        debouncedSaveState();
      });
      fabricCanvas.off("object:removed", () => {
        debouncedSaveState();
      });
      fabricCanvas.off("selection:created", handleSelectionCreated);
      fabricCanvas.off("selection:updated", handleSelectionUpdated);
      fabricCanvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [fabricCanvas, debouncedSaveState]);

  // Canvas memory optimization
  const optimizeCanvasMemory = useCallback(() => {
    if (!fabricCanvas) return;

    logger.canvas("Optimizing canvas memory...");

    const objects = fabricCanvas.getObjects();
    let removedCount = 0;

    // Remove objects that are off-screen and not visible
    objects.forEach((obj) => {
      const bounds = obj.getBoundingRect();
      const canvasWidth = fabricCanvas.width || 0;
      const canvasHeight = fabricCanvas.height || 0;

      // Remove objects that are completely off-screen
      if (
        bounds.left > canvasWidth + 100 ||
        bounds.top > canvasHeight + 100 ||
        bounds.left + bounds.width < -100 ||
        bounds.top + bounds.height < -100
      ) {
        // Don't remove components, wires, junction dots, or important objects
        if (
          !(obj as any).componentType &&
          !(obj as any).isAlignmentGuide &&
          !(obj as any).wireType &&
          !((obj as any).data?.type === "junctionDot")
        ) {
          logger.canvas("Removing off-screen object:", {
            type: obj.type,
            componentType: (obj as any).componentType,
            wireType: (obj as any).wireType,
            dataType: (obj as any).data?.type,
            bounds,
          });

          fabricCanvas.remove(obj);
          removedCount++;
        } else {
          logger.canvas("Keeping protected object:", {
            type: obj.type,
            componentType: (obj as any).componentType,
            wireType: (obj as any).wireType,
            dataType: (obj as any).data?.type,
            isProtected: true,
          });
        }
      }
    });

    if (removedCount > 0) {
      logger.canvas(`Removed ${removedCount} off-screen objects`);
      fabricCanvas.renderAll();
    }

    // Force garbage collection hint (if available)
    if (window.gc) {
      window.gc();
    }
  }, [fabricCanvas]);

  // Auto-optimize memory periodically
  useEffect(() => {
    if (!fabricCanvas) return;

    const memoryCheckInterval = setInterval(() => {
      // Check memory usage and optimize if needed
      if ("memory" in performance) {
        const memoryInfo = (performance as any).memory;
        const memoryUsageRatio =
          memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;

        if (memoryUsageRatio > 0.7) {
          // If using more than 70% of heap
          logger.canvas("High memory usage detected, optimizing canvas...");
          optimizeCanvasMemory();
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(memoryCheckInterval);
  }, [fabricCanvas, optimizeCanvasMemory]);
  const handleGroup = () => {
    logger.canvas("--- ACTION START: handleGroup ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();

    // Check if we have multiple objects selected (activeSelection)
    if (activeObject && activeObject.type === "activeSelection") {
      logger.canvas("--- Grouping existing activeSelection ---");

      // Get the objects from the ActiveSelection
      const objects = (activeObject as any)._objects || [];
      if (objects.length < 2) {
        logger.canvas(
          "--- ACTION FAILED: ActiveSelection has less than 2 objects ---"
        );
        return;
      }

      // Store original positions before removing from canvas
      const objectsWithPositions = objects.map((obj: fabric.Object) => ({
        object: obj,
        originalLeft: obj.left,
        originalTop: obj.top,
      }));

      // Remove objects from canvas temporarily
      objects.forEach((obj: fabric.Object) => fabricCanvas.remove(obj));

      // Create a new Group with these objects, preserving their relative positions
      const group = new fabric.Group(objects);

      // Set the group position to maintain the visual location
      group.set({
        left: activeObject.left,
        top: activeObject.top,
      });

      // Add the group to canvas and select it
      fabricCanvas.add(group);
      fabricCanvas.setActiveObject(group);
      fabricCanvas.renderAll();
      logger.canvas(
        "--- ACTION SUCCESS: handleGroup (from activeSelection) ---"
      );
      return;
    }

    // Get all selectable objects on canvas
    const allObjects = fabricCanvas
      .getObjects()
      .filter(
        (obj) => obj.selectable && obj.visible && !(obj as any).isAlignmentGuide
      );

    if (allObjects.length < 2) {
      logger.canvas("--- ACTION FAILED: Need at least 2 objects to group ---");
      return;
    }

    logger.canvas(`--- Found ${allObjects.length} objects to group ---`);

    // Calculate the bounding box of all objects
    let minLeft = Infinity,
      minTop = Infinity,
      maxRight = -Infinity,
      maxBottom = -Infinity;
    allObjects.forEach((obj) => {
      const bounds = obj.getBoundingRect();
      if (bounds.left < minLeft) minLeft = bounds.left;
      if (bounds.top < minTop) minTop = bounds.top;
      if (bounds.left + bounds.width > maxRight)
        maxRight = bounds.left + bounds.width;
      if (bounds.top + bounds.height > maxBottom)
        maxBottom = bounds.top + bounds.height;
    });

    // Remove all objects from canvas
    allObjects.forEach((obj) => fabricCanvas.remove(obj));

    // Create a Group with all objects
    const group = new fabric.Group(allObjects);

    // Set the group position to the calculated center
    group.set({
      left: minLeft + (maxRight - minLeft) / 2,
      top: minTop + (maxBottom - minTop) / 2,
    });

    // Add the group to canvas and select it
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();

    logger.canvas("--- ACTION SUCCESS: handleGroup (created new group) ---");
    // saveState(); // We can add this back later
  };

  const handleUngroup = async () => {
    logger.canvas("--- ACTION START: handleUngroup ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== "group") {
      logger.canvas("--- ACTION FAILED: Selected object is not a group ---");
      return;
    }

    logger.canvas("--- Ungrouping selected group ---");

    const group = activeObject as fabric.Group;

    // Get the objects from the group
    const objects = group.getObjects();

    // Get the group's current position and transforms
    const groupMatrix = group.calcTransformMatrix();

    // Remove the group from canvas
    fabricCanvas.remove(group);

    // Add each object back to canvas with correct absolute positioning
    const addedObjects: fabric.Object[] = [];

    // Process objects sequentially to avoid async issues
    for (const obj of objects) {
      try {
        // Clone the object properly
        const clonedObj = await obj.clone();

        // Calculate the absolute position of the object
        const objPoint = fabric.util.transformPoint(
          { x: obj.left || 0, y: obj.top || 0 },
          groupMatrix
        );

        // Set the object's absolute position
        clonedObj.set({
          left: objPoint.x,
          top: objPoint.y,
          // Preserve the object's own scale and rotation if any
          scaleX: (obj.scaleX || 1) * (group.scaleX || 1),
          scaleY: (obj.scaleY || 1) * (group.scaleY || 1),
          angle: (obj.angle || 0) + (group.angle || 0),
        });

        fabricCanvas.add(clonedObj);
        addedObjects.push(clonedObj);
      } catch (error) {
        console.error("Error cloning object during ungroup:", error);
      }
    }

    // Select all ungrouped objects if more than one
    if (addedObjects.length > 1) {
      const selection = new fabric.ActiveSelection(addedObjects, {
        canvas: fabricCanvas,
      });
      fabricCanvas.setActiveObject(selection);
    } else if (addedObjects.length === 1) {
      fabricCanvas.setActiveObject(addedObjects[0]);
    }

    fabricCanvas.renderAll();
    logger.canvas(
      `--- ACTION SUCCESS: handleUngroup (ungrouped ${addedObjects.length} objects) ---`
    );

    // saveState(); // We can add this back later
  };

  const handleDelete = () => {
    logger.canvas("--- ACTION START: handleDelete ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No object selected to delete ---");
      return;
    }

    // Handle multiple selected objects (activeSelection)
    if (activeObject.type === "activeSelection") {
      const objects = (activeObject as any)._objects || [];
      objects.forEach((obj: fabric.Object) => {
        handleObjectDeletion(obj);
      });
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      debouncedSaveState();
      logger.canvas(
        `--- ACTION SUCCESS: handleDelete (deleted ${objects.length} objects) ---`
      );
      return;
    }

    // Handle single object
    handleObjectDeletion(activeObject);
    fabricCanvas.renderAll();
    debouncedSaveState();
    logger.canvas("--- ACTION SUCCESS: handleDelete (deleted 1 object) ---");
  };

  // Helper function to handle deletion of individual objects with proper cleanup
  const handleObjectDeletion = useCallback(
    (obj: fabric.Object) => {
      if (!fabricCanvas) return;

      const objData = (obj as any).data;
      logger.canvas(`🗑️ handleObjectDeletion called for object:`, {
        type: obj.type,
        objDataType: objData?.type,
        componentId: objData?.componentId,
        hasData: !!objData,
      });

      // Check if this is a component
      if (objData?.type === "component" || obj.type === "group") {
        let componentId = objData?.componentId;

        // Fallback: try to get componentId from group objects if not found
        if (!componentId && obj.type === "group") {
          const groupObjects = (obj as fabric.Group).getObjects();
          for (const groupObj of groupObjects) {
            const groupObjData = (groupObj as any).data;
            if (groupObjData?.componentId) {
              componentId = groupObjData.componentId;
              logger.canvas(
                `🔄 Found componentId from group object: ${componentId}`
              );
              break;
            }
          }
        }

        logger.canvas(`🗑️ Deleting component: ${componentId}`);

        if (componentId) {
          // Remove RefDes assignment (preserves gaps like KiCad)
          refDesService.unassignRefDes(componentId);
          logger.canvas(`🏷️ RefDes removed for: ${componentId}`);

          // Find and remove all wires connected to this component
          const connectedWires = fabricCanvas
            .getObjects()
            .filter((wire: any) => {
              return (
                wire.wireType === "connection" &&
                wire.connectionData &&
                (wire.connectionData.fromComponentId === componentId ||
                  wire.connectionData.toComponentId === componentId)
              );
            });

          logger.canvas(
            `🔗 Found ${connectedWires.length} connected wires to remove`
          );

          // Remove connected wires from canvas
          connectedWires.forEach((wire) => {
            fabricCanvas.remove(wire);
            logger.canvas(
              `🔗 Removed wire: ${JSON.stringify((wire as any).connectionData)}`
            );
          });

          // Remove junction dots for deleted wires (both pin connection dots and intersection dots)
          const wiresToClean = connectedWires;
          wiresToClean.forEach((wire) => {
            const wireConnectionData = (wire as any).connectionData;
            if (wireConnectionData) {
              // Remove pin connection dots for this wire
              const dotsToRemove = fabricCanvas
                .getObjects()
                .filter((dot: any) => {
                  if (
                    dot.type === "circle" &&
                    dot.data?.type === "junctionDot"
                  ) {
                    // Check if this dot is associated with the deleted component
                    const dotComponentId = dot.data?.componentId;
                    return dotComponentId === componentId;
                  }
                  return false;
                });

              dotsToRemove.forEach((dot) => {
                fabricCanvas.remove(dot);
                logger.canvas(
                  `🔵 Removed junction dot for component: ${componentId}`
                );
              });
            }
          });

          // Update netlist: remove all connections involving this component
          if (obj.type === "group") {
            const groupObjects = (obj as fabric.Group).getObjects();
            groupObjects.forEach((groupObj) => {
              const pinData = (groupObj as any).data;
              if (pinData?.type === "pin") {
                // Update the local netlist state
                setNetlist((prevNets) => {
                  const updatedNets = prevNets
                    .map((net) => ({
                      ...net,
                      connections: net.connections.filter(
                        (conn: any) =>
                          !(
                            conn.componentId === componentId &&
                            conn.pinNumber === pinData.pinNumber
                          )
                      ),
                    }))
                    .filter((net) => net.connections.length > 0); // Remove empty nets

                  netlistRef.current = updatedNets;
                  return updatedNets;
                });

                logger.canvas(
                  `🔗 Removed netlist connection: ${componentId}:${pinData.pinNumber}`
                );

                // Clean up pin wire tracker
                const pinId = `${componentId}:${pinData.pinNumber}`;
                pinWireTracker.current.delete(pinId);
                logger.canvas(`📍 Cleaned up pin tracker for: ${pinId}`);
              }
            });
          }

          // Update the wiring tool's netlist as well
          if (wiringTool && wiringTool.setNetlist) {
            wiringTool.setNetlist(netlistRef.current);
          }

          // Refresh junction dots for remaining wires (recalculate intersections)
          if (wiringTool && wiringTool.refreshAllJunctionDots) {
            logger.canvas(
              `🔵 Refreshing junction dots after component deletion`
            );
            wiringTool.refreshAllJunctionDots();
          }

          // Auto-save removed - manual save only via Export button
        }
      }

      // Check if this is a wire
      else if ((obj as any).wireType === "connection") {
        const connectionData = (obj as any).connectionData;
        logger.canvas(`🔗 Deleting wire: ${JSON.stringify(connectionData)}`);

        if (connectionData) {
          // Update the local netlist state to remove wire connections
          setNetlist((prevNets) => {
            const updatedNets = prevNets
              .map((net) => ({
                ...net,
                connections: net.connections.filter(
                  (conn: any) =>
                    !(
                      (conn.componentId === connectionData.fromComponentId &&
                        conn.pinNumber === connectionData.fromPinNumber) ||
                      (conn.componentId === connectionData.toComponentId &&
                        conn.pinNumber === connectionData.toPinNumber)
                    )
                ),
              }))
              .filter((net) => net.connections.length > 0); // Remove empty nets

            netlistRef.current = updatedNets;
            return updatedNets;
          });

          logger.canvas(`🔗 Removed wire from netlist`);

          // Update pin wire tracker counts
          const fromPinId = `${connectionData.fromComponentId}:${connectionData.fromPinNumber}`;
          const toPinId = `${connectionData.toComponentId}:${connectionData.toPinNumber}`;

          // Decrement or remove tracker entries
          const fromCount = pinWireTracker.current.get(fromPinId) || 0;
          const toCount = pinWireTracker.current.get(toPinId) || 0;

          if (fromCount <= 1) {
            pinWireTracker.current.delete(fromPinId);
          } else {
            pinWireTracker.current.set(fromPinId, fromCount - 1);
          }

          if (toCount <= 1) {
            pinWireTracker.current.delete(toPinId);
          } else {
            pinWireTracker.current.set(toPinId, toCount - 1);
          }

          logger.canvas(
            `📍 Updated pin trackers: ${fromPinId}=${
              fromCount - 1
            }, ${toPinId}=${toCount - 1}`
          );

          // Update the wiring tool's netlist as well
          if (wiringTool && wiringTool.setNetlist) {
            wiringTool.setNetlist(netlistRef.current);
          }

          // Refresh junction dots for remaining wires (recalculate intersections)
          if (wiringTool && wiringTool.refreshAllJunctionDots) {
            logger.canvas(`🔵 Refreshing junction dots after wire deletion`);
            wiringTool.refreshAllJunctionDots();
          }

          // Auto-save removed - manual save only via Export button
        }
      }

      // Remove the object from canvas
      fabricCanvas.remove(obj);

      // For components (groups), pins are INSIDE the group, not on canvas
      // So we don't need to search for orphaned pins separately
      if (objData?.type === "component" || obj.type === "group") {
        const componentId = objData?.componentId;
        logger.canvas(
          `✅ Component ${componentId} removed (pins were inside the group)`
        );

        // Still check for any OTHER orphaned objects related to this component (not pins)
        const allObjects = fabricCanvas.getObjects();
        const orphanedObjects = allObjects.filter((canvasObj: any) => {
          const canvasObjData = canvasObj.data;
          // Don't look for pins - they were in the group
          return (
            canvasObjData?.componentId === objData?.componentId &&
            canvasObjData?.type !== "pin"
          );
        });

        if (orphanedObjects.length > 0) {
          logger.canvas(
            `🔍 Found ${orphanedObjects.length} orphaned objects for component ${objData?.componentId}:`
          );
          orphanedObjects.forEach((orphanObj, index) => {
            const orphanData = (orphanObj as any).data;
            logger.canvas(
              `  ${index + 1}. Type: ${orphanData?.type}, ComponentId: ${
                orphanData?.componentId
              }`
            );
            fabricCanvas.remove(orphanObj);
          });
        }
      }

      logger.canvas(`✅ Object removed from canvas`);
    },
    [fabricCanvas, netlist, wiringTool]
  );

  // Listen for external delete requests (from agent/AI commands)
  useEffect(() => {
    const handleExecuteDelete = (event: CustomEvent) => {
      const { component } = event.detail;
      if (component && fabricCanvas) {
        logger.canvas("🤖 Executing AI-triggered deletion with cleanup");
        handleObjectDeletion(component);
        fabricCanvas.renderAll();
        debouncedSaveState(); // Save for undo/redo
      }
    };

    window.addEventListener(
      "executeDelete",
      handleExecuteDelete as EventListener
    );

    return () => {
      window.removeEventListener(
        "executeDelete",
        handleExecuteDelete as EventListener
      );
    };
  }, [fabricCanvas, handleObjectDeletion, debouncedSaveState]);

  const handleCopy = () => {
    logger.canvas("DEBUG: handleCopy called");
    logger.canvas("--- ACTION START: handleCopy ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No object selected to copy ---");
      return;
    }

    // Simple copy implementation
    setClipboard(activeObject);
    logger.canvas("--- ACTION SUCCESS: handleCopy ---");
  };

  const handlePaste = (position?: { x: number; y: number }) => {
    logger.canvas("--- ACTION START: handlePaste ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    if (!clipboard) {
      logger.canvas(
        "--- ACTION FAILED: Nothing to paste (clipboard empty) ---"
      );
      return;
    }

    // Smart paste implementation - place at mouse cursor position
    clipboard.clone().then((cloned: any) => {
      // Use provided position or current mouse position for paste location
      const pastePos = position || lastMousePosition.current;

      cloned.set({
        left: pastePos.x,
        top: pastePos.y,
      });

      // Check if this is a component that needs pin recreation
      const componentData = cloned.data;
      const componentType = cloned.componentType;

      if (
        componentData &&
        componentData.type === "component" &&
        componentType
      ) {
        logger.canvas(
          `Pasted component detected: ${
            componentData.componentName || componentType
          }`
        );

        // Dynamically import the appropriate pin recreation function based on component characteristics
        const recreateComponentPins = async () => {
          try {
            // Try SVG factory first (most feature-complete)
            const { recreateComponentPins: svgRecreate } = await import(
              "./SVGComponentFactory"
            );
            let recreatedComponent = svgRecreate(cloned, fabricCanvas);

            // If that didn't work, try intelligent factory
            if (!recreatedComponent || recreatedComponent === cloned) {
              const { recreateIntelligentComponentPins } = await import(
                "./IntelligentComponentFactory"
              );
              recreatedComponent = recreateIntelligentComponentPins(
                cloned,
                fabricCanvas
              );
            }

            // TODO: Implement Konva paste functionality
            // // If that didn't work, try simple factory
            // if (!recreatedComponent || recreatedComponent === cloned) {
            //   const { recreateSimpleComponentPins } = await import(
            //     "./SimpleComponentFactory"
            //   );
            //   recreatedComponent = recreateSimpleComponentPins(
            //     cloned,
            //     fabricCanvas
            //   );
            // }

            // fabricCanvas.add(recreatedComponent);
            fabricCanvas.setActiveObject(recreatedComponent);
            fabricCanvas.renderAll();
            debouncedSaveState();

            logger.canvas(
              `--- ACTION SUCCESS: handlePaste with pin recreation at position (${pastePos.x}, ${pastePos.y}) ---`
            );
          } catch (error) {
            logger.canvas("Failed to recreate component pins:", error);
            // Fallback: add the cloned component as-is
            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.renderAll();
            debouncedSaveState();

            logger.canvas(
              `--- ACTION SUCCESS: handlePaste (fallback) at position (${pastePos.x}, ${pastePos.y}) ---`
            );
          }
        };

        recreateComponentPins();
      } else {
        // Regular object - just add it
        fabricCanvas.add(cloned);
        fabricCanvas.setActiveObject(cloned);
        fabricCanvas.renderAll();
        debouncedSaveState();
        logger.canvas(
          `--- ACTION SUCCESS: handlePaste at position (${pastePos.x}, ${pastePos.y}) ---`
        );
      }
    });
    // saveState(); // We can add this back later
  };

  const handleRotate = () => {
    logger.canvas("--- ACTION START: handleRotate ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No component selected to rotate ---");
      return;
    }

    // Only rotate components (not wires or other objects)
    if (!(activeObject as any).componentType) {
      logger.canvas(
        "--- ACTION FAILED: Selected object is not a component ---"
      );
      return;
    }

    // Rotate by 90 degrees
    const currentAngle = activeObject.angle || 0;
    const newAngle = (currentAngle + 90) % 360;

    activeObject.set("angle", newAngle);
    fabricCanvas.renderAll();
    debouncedSaveState();

    logger.canvas(
      `--- ACTION SUCCESS: handleRotate (${currentAngle}° → ${newAngle}°) ---`
    );
  };

  const handleUndo = () => {
    logger.canvas("--- ACTION START: handleUndo ---");
    console.log("🔍 DEBUG: handleUndo wrapper called - calling historyUndo");
    const result = historyUndo();
    console.log("🔍 DEBUG: historyUndo returned:", result);
    logger.canvas("--- ACTION END: handleUndo ---");
  };

  const handleRedo = () => {
    logger.canvas("--- ACTION START: handleRedo ---");
    console.log("🔍 DEBUG: handleRedo wrapper called - calling historyRedo");
    const result = historyRedo();
    console.log("🔍 DEBUG: historyRedo returned:", result);
    logger.canvas("--- ACTION END: handleRedo ---");
  };

  const handleSave = useCallback(async () => {
    logger.canvas("🔵 --- ACTION START: handleSave ---");
    logger.canvas("🔍 handleSave debug:", {
      hasCurrentProject: !!currentProject,
      projectId: currentProject?.id,
      hasOnSave: !!onSave,
    });

    if (!currentProject) {
      logger.canvas("❌ Cannot save: no project loaded");
      alert("Cannot save: No project loaded");
      return;
    }

    try {
      // Use the shared save function
      if (onSave) {
        logger.canvas("✅ Calling onSave prop function...");
        await onSave();
        logger.canvas("✅ onSave completed successfully");
      } else {
        throw new Error("Save function not available");
      }
      logger.canvas("🟢 --- ACTION END: handleSave ---");
    } catch (error) {
      logger.canvas("🔴 --- ACTION FAILED: handleSave ---", error);
      console.error("Save failed:", error);

      // Show error notification
      const errorNotification = document.createElement("div");
      errorNotification.textContent = `❌ Save failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      errorNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(errorNotification);
      setTimeout(() => errorNotification.remove(), 3000);
    }
  }, [currentProject, onSave]);

  // PART 3: The Connection (The Central Hub)
  // PART 3: The Connection (The Central Hub) - TEMPORARILY DISABLED FOR DIRECT TESTING
  // useEffect(() => {
  //   if (!fabricCanvas) return;

  //   console.log('Setting up centralized command handlers...');

  //   const unsubscribeGroup = canvasCommandManager.on('action:group', () => {
  //     console.log('Handler: "action:group" command received.');
  //     handleGroup();
  //   });

  //   const unsubscribeUngroup = canvasCommandManager.on('action:ungroup', () => {
  //     console.log('Handler: "action:ungroup" command received.');
  //     handleUngroup();
  //   });

  //   const unsubscribeDelete = canvasCommandManager.on('action:delete', () => {
  //     console.log('Handler: "action:delete" command received.');
  //     handleDelete();
  //   });

  //   const unsubscribeCopy = canvasCommandManager.on('action:copy', () => {
  //     console.log('Handler: "action:copy" command received.');
  //     handleCopy();
  //   });

  //   const unsubscribePaste = canvasCommandManager.on('action:paste', () => {
  //     console.log('Handler: "action:paste" command received.');
  //     handlePaste();
  //   });

  //   const unsubscribeUndo = canvasCommandManager.on('action:undo', () => {
  //     console.log('Handler: "action:undo" command received.');
  //     handleUndo();
  //   });

  //   const unsubscribeRedo = canvasCommandManager.on('action:redo', () => {
  //     console.log('Handler: "action:redo" command received.');
  //     handleRedo();
  //   });

  //   // Cleanup function
  //   return () => {
  //     unsubscribeGroup();
  //     unsubscribeUngroup();
  //     unsubscribeDelete();
  //     unsubscribeCopy();
  //     unsubscribePaste();
  //     unsubscribeUndo();
  //     unsubscribeRedo();
  //   };
  // }, [fabricCanvas, handleGroup, handleUngroup, handleDelete, handleCopy, handlePaste, handleUndo, handleRedo]);

  // Cross-platform keyboard shortcuts - PART 2: Direct Function Connection Test
  // Cross-platform keyboard shortcuts - DISABLED: Now Konva-only
  // useCanvasHotkeys({
  //   canvas: fabricCanvas,
  //   enabled: !!fabricCanvas,
  //   onDelete: handleDelete,
  //   onCopy: handleCopy,
  //   onPaste: handlePaste,
  //   onUndo: handleUndo,
  //   onRedo: handleRedo,
  //   onRotate: handleRotate,
  //   onSave: handleSave,
  //   onToggleGrid: toggleGrid, // Add grid toggle
  //   onComponentPicker: () => setIsComponentPickerVisible(true), // Add component picker
  //   onToggleWireMode: toggleWireMode, // Add wire mode toggle
  // });

  // Right-click context menu handler - Completely refactored per specification
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const containerDiv = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      logger.canvas("IDEFabricCanvas handleContextMenu triggered!");
      logger.canvas("- Event:", e);
      logger.canvas("- clientX:", e.clientX, "clientY:", e.clientY);

      e.preventDefault(); // Stop the default browser menu

      // Use canvas.findTarget() to determine if user right-clicked on an object
      const target = fabricCanvas.findTarget(e);
      logger.canvas("- Fabric target found:", target);
      logger.canvas("- Target name:", target ? (target as any).name : "none");

      if (target && (target as any).name !== "workspace") {
        logger.canvas("Showing OBJECT context menu");
        // Case A: Right-Click on an Object
        // Make that object the active selection on the canvas
        fabricCanvas.setActiveObject(target);
        fabricCanvas.renderAll();

        // Show context menu with "Copy" and "Delete" options
        const objectMenuState = {
          visible: true,
          x: e.clientX,
          y: e.clientY,
          canvasX: fabricCanvas.getPointer(e).x,
          canvasY: fabricCanvas.getPointer(e).y,
          type: "object" as const,
          target: target,
        };
        logger.canvas("Setting OBJECT menu state:", objectMenuState);
        setMenuState(objectMenuState);
      } else {
        logger.canvas("Showing CANVAS context menu");
        // Case B: Right-Click on Empty Canvas
        // Show context menu with only "Paste" option
        const canvasMenuState = {
          visible: true,
          x: e.clientX,
          y: e.clientY,
          canvasX: fabricCanvas.getPointer(e).x,
          canvasY: fabricCanvas.getPointer(e).y,
          type: "canvas" as const,
          target: null,
        };
        logger.canvas("Setting CANVAS menu state:", canvasMenuState);
        setMenuState(canvasMenuState);
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Close context menu on any regular click, but not on right-click
      // Right-click (button 2) should not close the menu that it just opened
      if (e.button === 0) {
        // Only close on left-click
        setMenuState((prev) => ({ ...prev, visible: false }));
      }
    };

    // Attach listeners to the canvas container div
    containerDiv.addEventListener("contextmenu", handleContextMenu);
    containerDiv.addEventListener("click", handleClick);

    return () => {
      containerDiv.removeEventListener("contextmenu", handleContextMenu);
      containerDiv.removeEventListener("click", handleClick);
    };
  }, [fabricCanvas]);

  // Track mouse position for smart paste placement
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseMove = (event: fabric.TEvent) => {
      const pointer = fabricCanvas.getPointer(event.e);
      lastMousePosition.current = { x: pointer.x, y: pointer.y };
    };

    fabricCanvas.on("mouse:move", handleMouseMove);

    return () => {
      fabricCanvas.off("mouse:move", handleMouseMove);
    };
  }, [fabricCanvas]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full canvas-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Rulers Layout - Always rendered, visibility controlled by opacity */}
      <div className="relative w-full h-full">
        {/* Top-left corner space */}
        <div
          className="absolute top-0 left-0 border-b border-r border-gray-300 transition-opacity duration-200"
          style={{
            width: rulerSize,
            height: rulerSize,
            background: "linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)",
            zIndex: 10,
            opacity: areRulersVisible ? 1 : 0,
            pointerEvents: areRulersVisible ? "auto" : "none",
          }}
        />

        {/* Horizontal Ruler */}
        <div
          className="absolute top-0 transition-opacity duration-200"
          style={{
            left: rulerSize,
            width: canvasDimensions.width,
            height: rulerSize,
            zIndex: 10,
            opacity: areRulersVisible ? 1 : 0,
            pointerEvents: areRulersVisible ? "auto" : "none",
          }}
        >
          <HorizontalRuler
            width={canvasDimensions.width}
            height={rulerSize}
            viewportTransform={viewportState.viewportTransform}
            zoom={viewportState.zoom}
          />
        </div>

        {/* Vertical Ruler */}
        <div
          className="absolute left-0 transition-opacity duration-200"
          style={{
            top: rulerSize,
            width: rulerSize,
            height: canvasDimensions.height,
            zIndex: 10,
            opacity: areRulersVisible ? 1 : 0,
            pointerEvents: areRulersVisible ? "auto" : "none",
          }}
        >
          <VerticalRuler
            width={rulerSize}
            height={canvasDimensions.height}
            viewportTransform={viewportState.viewportTransform}
            zoom={viewportState.zoom}
          />
        </div>

        {/* Main Canvas */}
        <div
          className="absolute"
          style={{
            top: rulerSize,
            left: rulerSize,
            width: canvasDimensions.width,
            height: canvasDimensions.height,
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Context Menu - PART 2: Direct Function Connection Test */}
      <ContextMenu
        visible={menuState.visible}
        top={menuState.y}
        left={menuState.x}
        menuType={menuState.type}
        canPaste={clipboard !== null}
        onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onPaste={handleContextPaste}
      />

      {/* Optional debug info */}
      {panState.isPanMode && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          Pan Mode {panState.isDragging ? "- Dragging" : ""}
        </div>
      )}

      {/* Grid and Snap indicator */}
      <div className="absolute bottom-2 left-2 bg-green-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs">
        Grid: {gridSize}px • C=components • R=rotate • W=wire ✓
      </div>

      {/* Memory usage indicator */}
      <div className="absolute bottom-2 right-2 bg-blue-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs">
        <button
          onClick={() => {
            memoryMonitor.logMemoryUsage("Manual Check");
            optimizeCanvasMemory();
          }}
          className="hover:bg-blue-700 px-1 rounded text-xs"
          title="Click to check memory and optimize"
        >
          RAM: {memoryMonitor.getMemoryInfo()?.formattedUsage || "N/A"}
        </button>
      </div>

      {/* Netlist debug indicator */}
      {/* {netlist.length > 0 && (
        <div className="absolute top-16 right-2 bg-purple-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm font-medium max-w-xs">
          <div className="text-xs opacity-80 mb-1">Electrical Nets:</div>
          {netlist.slice(0, 3).map((net: any, index: number) => (
            <div key={net.netId} className="text-xs">
              {net.netId}: {net.connections.length} pins
            </div>
          ))}
          {netlist.length > 3 && (
            <div className="text-xs opacity-60">
              ...and {netlist.length - 3} more
            </div>
          )}
        </div>
      )} */}

      {/* Component Picker Overlay */}
      <ComponentPickerOverlay
        isVisible={isComponentPickerVisible}
        onClose={() => setIsComponentPickerVisible(false)}
      />
    </div>
  );
}
