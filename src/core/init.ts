import {
  init as csRenderInit,
  getWebWorkerManager,
  volumeLoader,
  cornerstoneStreamingImageVolumeLoader,
  type Types,
} from '@cornerstonejs/core';
import { init as csToolsInit } from '@cornerstonejs/tools';
import * as dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import DecodeImageFrameWorker from '../workers/decodeImageFrameWorker.ts?worker&inline';

let initialized = false;

export async function initCornerstone(): Promise<void> {
  if (initialized) return;

  console.log('[DQ-DICOM] Initializing...');

  // 1. Core + Tools
  csRenderInit();
  csToolsInit();

  // 2. Register wadouri/wadors loaders with Cornerstone.
  dicomImageLoader.wadouri.register();
  dicomImageLoader.wadors.register();

  // 3. Register the decode worker manually.
  //
  // `?worker&inline` is deliberate: Dental-CBCT-Viewer is consumed as a
  // library by another Vite application. Emitting a separate worker asset from
  // the library caused the consumer bundler to treat the generated worker path
  // as a new entry module. Inlining keeps the worker self-contained inside the
  // package while still running it in a real Web Worker at runtime.
  const workerFn = () => {
    const w = new DecodeImageFrameWorker();
    w.onerror = (e) => console.error('[DQ-DICOM] Worker load error:', e);
    return w;
  };

  const maxWorkers = navigator.hardwareConcurrency
    ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
    : 1;

  const workerManager = getWebWorkerManager();
  workerManager.registerWorker('dicomImageLoader', workerFn, {
    maxWorkerInstances: maxWorkers,
  });

  // 4. Register streaming volume loader for MPR.
  volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader as unknown as Types.VolumeLoaderFn,
  );

  initialized = true;
  console.log('[DQ-DICOM] Ready');
}
