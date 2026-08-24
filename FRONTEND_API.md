# Frontend API

This document describes the host-facing API intended for a custom mobile/tablet frontend (for example a Bolt.new UI). The DICOM/Cornerstone/vtk engine remains inside `Dental-CBCT-Viewer`; the host controls it through a React ref and callbacks.

## Mount the viewer

```tsx
import { useRef } from 'react';
import { DicomViewer, type DicomViewerHandle } from 'dental-cbct-viewer';
import 'dental-cbct-viewer/style.css';

export function DentalScreen() {
  const viewerRef = useRef<DicomViewerHandle>(null);

  return (
    <DicomViewer
      ref={viewerRef}
      embedded
      lang="es"
      callbacks={{
        onStateChange: (state) => console.log(state),
        onSliceChanged: (viewport, index, total) =>
          console.log(viewport, index, total),
      }}
    />
  );
}
```

## Load / unload a local DICOM study

```ts
await viewerRef.current?.loadStudy(files);
viewerRef.current?.unloadStudy();
```

The current local-file flow remains supported. The API boundary is intentionally separate from the loader so a DICOMweb/Orthanc loader can be added later without changing the frontend control contract.

## Main dental modes

```ts
viewerRef.current?.setMainView('panoramic');
viewerRef.current?.setMainView('mpr');
viewerRef.current?.setMainView('3d');
```

`mpr` keeps the existing linked MPR + 3D engine alive. The mobile frontend can maximize any individual MPR plane when it wants a one-view experience.

## Maximize a viewport without reloading the study

```ts
viewerRef.current?.maximizeViewport('axial');
viewerRef.current?.maximizeViewport('coronal');
viewerRef.current?.maximizeViewport('sagittal');
viewerRef.current?.maximizeViewport('panoramic');
viewerRef.current?.maximizeViewport('crossSection');
viewerRef.current?.maximizeViewport('3d');

viewerRef.current?.restoreLayout();
```

Maximization is independent from the underlying layout mode. The shared Cornerstone volume remains loaded.

## MPR slice navigation

```ts
viewerRef.current?.setSlice(120, 'axial');
viewerRef.current?.nextSlice('axial');
viewerRef.current?.previousSlice('axial');
```

Valid MPR viewport names are `axial`, `coronal`, and `sagittal`. If omitted, the slice methods default to `axial`.

## Panoramic arch workflow

```ts
viewerRef.current?.openArchEditor();
viewerRef.current?.closeArchEditor();
```

`openArchEditor()` switches to the existing dental panoramic layout and marks the arch editor as active for the host state.

## Cross-sections

```ts
viewerRef.current?.openCrossSections();
viewerRef.current?.closeCrossSections();

viewerRef.current?.setCrossSection(50); // logical 0..100 position
viewerRef.current?.nextCrossSection();
viewerRef.current?.previousCrossSection();
```

Internally the existing engine stores cross-section position as a continuous 0..1 value along the arch. `setCrossSection(index, count = 101)` is a frontend-friendly indexed adapter.

## Tools

```ts
viewerRef.current?.setActiveTool('crosshairs');
viewerRef.current?.setActiveTool('windowLevel');
viewerRef.current?.setActiveTool('pan');
viewerRef.current?.setActiveTool('zoom');
viewerRef.current?.setActiveTool('length');
```

Only existing Cornerstone tools are exposed; no clinical tools are faked.

## Reset / resize

```ts
viewerRef.current?.resetView('axial');
viewerRef.current?.resize();
```

MPR viewports already use `ResizeObserver`; `resize()` is provided for host transitions/orientation changes that need an explicit engine resize.

## Read public state

```ts
const state = viewerRef.current?.getViewerState();
```

The returned shape contains:

```ts
{
  studyLoaded,
  mainView,
  maximizedViewport,
  currentSlices: { axial, coronal, sagittal },
  sliceCounts: { axial, coronal, sagittal },
  currentTool,
  loading,
  loadingProgress,
  archEditorOpen,
  crossSectionsOpen,
}
```

## Host callbacks

Pass a `callbacks` object to `DicomViewer`:

```ts
callbacks={{
  onStudyLoaded,
  onStudyUnloaded,
  onMainViewChanged,
  onViewportMaximized,
  onViewportRestored,
  onSliceChanged,
  onCrosshairChanged,
  onArchChanged,
  onCrossSectionChanged,
  onToolChanged,
  onLoadingProgress,
  onError,
  onStateChange,
}}
```

The first engine/frontend integration phase currently wires study, main-view, viewport-maximize/restore, slice, arch, cross-section, tool, loading, error, and aggregate-state events. `onCrosshairChanged` is reserved in the public contract for the touch/crosshair event bridge.

## Mobile integration rules

The host frontend should:

- keep the viewer mounted while switching Panoramic / MPR / 3D;
- use `maximizeViewport()` rather than unloading/remounting DICOM data;
- keep overlays outside the Cornerstone interaction surface whenever possible;
- not intercept pointer/touch events over the MPR/3D canvas;
- call `resize()` after major animated container transitions if needed;
- use `onSliceChanged` or `getViewerState()` to drive mobile slice labels/sliders.

## Current touch foundation

MPR interaction elements are marked with `touch-action: none` so browser page gestures do not steal CBCT manipulation. Cornerstone remains responsible for the actual clinical viewport interactions. Additional crosshair-specific mobile hit-area tuning belongs in the next engine phase and must preserve desktop behavior.
