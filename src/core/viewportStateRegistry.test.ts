import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearViewportStates, restoreViewportState, saveViewportState } from './viewportStateRegistry';

describe('viewportStateRegistry', () => {
  beforeEach(() => clearViewportStates());

  it('restores a saved camera to a remounted viewport', () => {
    const camera = { focalPoint: [1, 2, 3], position: [4, 5, 6], parallelScale: 12 };
    saveViewportState('AXIAL', { getCamera: () => camera });

    const setCamera = vi.fn();
    const restored = restoreViewportState('AXIAL', { setCamera });

    expect(restored).toBe(true);
    expect(setCamera).toHaveBeenCalledWith(camera);
  });

  it('returns false when there is no saved viewport state', () => {
    expect(restoreViewportState('CORONAL', { setCamera: vi.fn() })).toBe(false);
  });
});
