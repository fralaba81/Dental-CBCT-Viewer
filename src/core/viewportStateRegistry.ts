type SavedViewportState = {
  camera?: unknown;
};

const registry = new Map<string, SavedViewportState>();

/**
 * Persist only view state that is safe to restore against the same cached
 * volume. The DICOM volume itself remains owned by Cornerstone's cache.
 */
export function saveViewportState(viewportId: string, viewport: any) {
  if (!viewport) return;
  try {
    const camera = typeof viewport.getCamera === 'function' ? viewport.getCamera() : undefined;
    registry.set(viewportId, { camera: camera ? { ...camera } : undefined });
  } catch {
    // A viewport may be in teardown already; persistence is best-effort.
  }
}

export function restoreViewportState(viewportId: string, viewport: any) {
  if (!viewport) return false;
  const saved = registry.get(viewportId);
  if (!saved) return false;
  try {
    if (saved.camera && typeof viewport.setCamera === 'function') {
      viewport.setCamera(saved.camera);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearViewportStates() {
  registry.clear();
}
