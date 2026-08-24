import { describe, expect, it, vi } from 'vitest';
import { emitViewerEvent, onViewerEvent } from './viewerEvents';

describe('viewerEvents', () => {
  it('delivers events and unsubscribes cleanly', () => {
    const listener = vi.fn();
    const unsubscribe = onViewerEvent<{ index: number }>('sliceChanged', listener);

    emitViewerEvent('sliceChanged', { index: 12 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ index: 12 });

    unsubscribe();
    emitViewerEvent('sliceChanged', { index: 13 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps event channels isolated', () => {
    const slice = vi.fn();
    const crosshair = vi.fn();
    const offSlice = onViewerEvent('sliceChanged', slice);
    const offCrosshair = onViewerEvent('crosshairChanged', crosshair);

    emitViewerEvent('crosshairChanged', { viewport: 'axial' });

    expect(crosshair).toHaveBeenCalledTimes(1);
    expect(slice).not.toHaveBeenCalled();

    offSlice();
    offCrosshair();
  });
});
