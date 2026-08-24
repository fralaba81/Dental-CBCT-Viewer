import {
  addTool,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  TrackballRotateTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  CircleROITool,
  RectangleROITool,
  PlanarFreehandROITool,
  BidirectionalTool,
  ArrowAnnotateTool,
  ProbeTool,
  CrosshairsTool,
  Enums as csToolsEnums,
} from '@cornerstonejs/tools';
import { TOOL_GROUP_ID, TOOL_GROUP_3D_ID } from './constants';
import type { ViewportTool } from '@/types/dicom';

const CROSSHAIR_YELLOW = 'rgb(255, 214, 60)';
const CROSSHAIR_BLUE = 'rgb(74, 163, 255)';
function referenceLineColor(refVpId: string): string {
  return refVpId.includes('AXIAL') ? CROSSHAIR_YELLOW : CROSSHAIR_BLUE;
}

let toolGroupCreated = false;

export function setupTools(): void {
  if (toolGroupCreated) return;

  addTool(WindowLevelTool);
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(StackScrollTool);
  addTool(TrackballRotateTool);
  addTool(LengthTool);
  addTool(AngleTool);
  addTool(EllipticalROITool);
  addTool(CircleROITool);
  addTool(RectangleROITool);
  addTool(PlanarFreehandROITool);
  addTool(BidirectionalTool);
  addTool(ArrowAnnotateTool);
  addTool(ProbeTool);
  addTool(CrosshairsTool);

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) return;

  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(LengthTool.toolName);
  toolGroup.addTool(AngleTool.toolName);
  toolGroup.addTool(EllipticalROITool.toolName);
  toolGroup.addTool(CircleROITool.toolName);
  toolGroup.addTool(RectangleROITool.toolName);
  toolGroup.addTool(PlanarFreehandROITool.toolName);
  toolGroup.addTool(BidirectionalTool.toolName);
  toolGroup.addTool(ArrowAnnotateTool.toolName);
  toolGroup.addTool(ProbeTool.toolName);
  toolGroup.addTool(CrosshairsTool.toolName, {
    getReferenceLineColor: (vpId: string) => referenceLineColor(vpId),
    getReferenceLineControllable: () => true,
    getReferenceLineDraggableRotatable: () => true,
    getReferenceLineSlabThicknessControlsOn: () => false,
    // Cornerstone's CrosshairsTool has a dedicated mobile rendering mode.
    // It increases the effective handle target while keeping the reference
    // lines visually thin enough for diagnostic viewing.
    mobile: {
      enabled: true,
      opacity: 0.9,
      handleRadius: 12,
    },
  });

  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
  });

  setActiveTool('windowLevel');

  const toolGroup3D = ToolGroupManager.createToolGroup(TOOL_GROUP_3D_ID);
  if (toolGroup3D) {
    toolGroup3D.addTool(TrackballRotateTool.toolName);
    toolGroup3D.addTool(PanTool.toolName);
    toolGroup3D.addTool(ZoomTool.toolName);

    toolGroup3D.setToolActive(TrackballRotateTool.toolName, {
      bindings: [
        { mouseButton: csToolsEnums.MouseBindings.Primary },
        { numTouchPoints: 1 },
      ],
    });
    toolGroup3D.setToolActive(PanTool.toolName, {
      bindings: [
        { mouseButton: csToolsEnums.MouseBindings.Auxiliary },
        { numTouchPoints: 3 },
      ],
    });
    toolGroup3D.setToolActive(ZoomTool.toolName, {
      bindings: [
        { mouseButton: csToolsEnums.MouseBindings.Secondary },
        { mouseButton: csToolsEnums.MouseBindings.Wheel },
        { numTouchPoints: 2 },
      ],
    });
  }

  toolGroupCreated = true;
}

const TOOL_NAME_MAP: Record<ViewportTool, string> = {
  windowLevel: WindowLevelTool.toolName,
  pan: PanTool.toolName,
  zoom: ZoomTool.toolName,
  scroll: StackScrollTool.toolName,
  length: LengthTool.toolName,
  angle: AngleTool.toolName,
  ellipticalRoi: EllipticalROITool.toolName,
  circleRoi: CircleROITool.toolName,
  rectangleRoi: RectangleROITool.toolName,
  freehandRoi: PlanarFreehandROITool.toolName,
  bidirectional: BidirectionalTool.toolName,
  arrowAnnotate: ArrowAnnotateTool.toolName,
  probe: ProbeTool.toolName,
  crosshairs: CrosshairsTool.toolName,
};

const ALL_PRIMARY_TOOLS = Object.values(TOOL_NAME_MAP);

export function setActiveTool(tool: ViewportTool): void {
  const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) return;

  for (const t of ALL_PRIMARY_TOOLS) {
    if (t === CrosshairsTool.toolName) {
      toolGroup.setToolDisabled(t);
    } else {
      toolGroup.setToolPassive(t);
    }
  }

  const csToolName = TOOL_NAME_MAP[tool];
  if (!csToolName) return;

  if (tool === 'crosshairs') {
    const vpIds = toolGroup.getViewportIds();
    if (vpIds.length < 2) {
      console.warn('[DQ-DICOM] Crosshairs requires MPR layout (2+ viewports)');
      return;
    }
  }

  // Primary mouse and one-finger touch execute the currently selected tool.
  // Pinch zoom remains globally reachable with two touch points below.
  toolGroup.setToolActive(csToolName, {
    bindings: [
      { mouseButton: csToolsEnums.MouseBindings.Primary },
      { numTouchPoints: 1 },
    ],
  });

  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
  });

  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [
      { mouseButton: csToolsEnums.MouseBindings.Secondary },
      { numTouchPoints: 2 },
    ],
  });

  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
  });
}

export function addViewportToToolGroup(viewportId: string, renderingEngineId: string): void {
  const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (toolGroup) {
    toolGroup.addViewport(viewportId, renderingEngineId);
  }
}

export function addViewportTo3DToolGroup(viewportId: string, renderingEngineId: string): void {
  const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_3D_ID);
  if (toolGroup) {
    toolGroup.addViewport(viewportId, renderingEngineId);
  }
}
