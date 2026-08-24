import { getRenderingEngine, utilities } from '@cornerstonejs/core';
import { RENDERING_ENGINE_ID, VP_AXIAL, VP_CORONAL, VP_SAGITTAL, VP_3D } from '@/core/constants';
import type { ViewerViewport } from '@/types/viewerApi';

type MprViewport = 'axial' | 'coronal' | 'sagittal';

const MPR_IDS: Record<MprViewport, string> = {
  axial: VP_AXIAL,
  coronal: VP_CORONAL,
  sagittal: VP_SAGITTAL,
};

function getViewport(viewport: MprViewport) {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID);
  return engine?.getViewport(MPR_IDS[viewport]);
}

export function getSliceState(viewport: MprViewport) {
  const vp = getViewport(viewport) as any;
  if (!vp || typeof vp.getSliceIndex !== 'function' || typeof vp.getNumberOfSlices !== 'function') {
    return { index: 0, total: 0 };
  }
  return {
    index: vp.getSliceIndex() as number,
    total: vp.getNumberOfSlices() as number,
  };
}

export function setViewportSlice(viewport: MprViewport, targetIndex: number) {
  const vp = getViewport(viewport) as any;
  if (!vp || typeof vp.getSliceIndex !== 'function' || typeof vp.getNumberOfSlices !== 'function') return;
  const total = vp.getNumberOfSlices() as number;
  if (total <= 0) return;
  const next = Math.max(0, Math.min(total - 1, Math.round(targetIndex)));
  const current = vp.getSliceIndex() as number;
  const delta = next - current;
  if (delta !== 0) utilities.scroll(vp, { delta });
}

export function stepViewportSlice(viewport: MprViewport, delta: number) {
  const current = getSliceState(viewport);
  setViewportSlice(viewport, current.index + delta);
}

export function resetViewerViewport(viewport?: ViewerViewport) {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID);
  if (!engine) return;

  let ids: string[];
  if (viewport === '3d') {
    ids = [VP_3D];
  } else if (viewport && viewport in MPR_IDS) {
    ids = [MPR_IDS[viewport as MprViewport]];
  } else if (!viewport) {
    ids = [VP_AXIAL, VP_CORONAL, VP_SAGITTAL, VP_3D];
  } else {
    // Panoramic and cross-section are canvas-derived views and do not expose a
    // Cornerstone camera. Their frontend-specific reset remains a no-op here.
    ids = [];
  }

  ids.forEach((id) => {
    try {
      const vp = engine.getViewport(id) as any;
      if (!vp) return;
      if (typeof vp.resetCamera === 'function') {
        vp.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true });
      }
      if (typeof vp.render === 'function') vp.render();
    } catch {
      // A viewport may not currently be mounted in the active layout.
    }
  });
}

export function resizeViewer() {
  const engine = getRenderingEngine(RENDERING_ENGINE_ID);
  engine?.resize(true, false);
}

export function getMprSnapshot() {
  const axial = getSliceState('axial');
  const coronal = getSliceState('coronal');
  const sagittal = getSliceState('sagittal');
  return { axial, coronal, sagittal };
}
