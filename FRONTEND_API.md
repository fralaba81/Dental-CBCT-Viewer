# Frontend API

This document describes the host-facing API intended for a custom mobile/tablet frontend such as Bolt.new. The DICOM/Cornerstone/vtk engine remains inside `Dental-CBCT-Viewer`; the host controls it through a React ref and callbacks.

## Mount the viewer for a custom frontend

Use `headless` when another application owns all visible navigation, buttons and patient chrome:

```tsx
import { useRef } from 'react';
import { DicomViewer, type DicomViewerHandle } from 'dental-cbct-viewer';
import 'dental-cbct-viewer/style.css';

export function DentalScreen() {
  const viewerRef = useRef<DicomViewerHandle>(null);

  return (
    <div className="viewer-host">
      <DicomViewer
        ref={viewerRef}
        headless
        embedded
        lang="es"
        callbacks={{
          onStateChange: (state) => console.log(state),
          onSliceChanged: (viewport, index, total) =>
            console.log(viewport, index, total),
          onCrosshairChanged: () => console.log('MPR geometry changed'),
        }}
      />
    </div>
  );
}
```

`headless` hides the built-in landing page, top bar, left/series panels and internal modal chrome. The real Cornerstone/vtk viewports remain mounted. The host should give the component a non-zero width and height.

Without `headless`, the original desktop UI remains available and backwards-compatible.

## Load / unload a local DICOM study

```ts
await viewerRef.current?.loadStudy(files);
viewerRef.current?.unloadStudy();
```

The existing local-file flow remains supported. The API boundary is intentionally separate from the loader so a future DICOMweb/Orthanc loader can be added without changing the frontend control contract.

## Main dental modes

```ts
viewerRef.current?.setMainView('panoramic');
viewerRef.current?.setMainView('mpr');
viewerRef.current?.setMainView('3d');
```

The same cached CBCT volume is reused while switching modes.

## Maximize a viewport

```ts
viewerRef.current?.maximizeViewport('axial');
viewerRef.current?.maximizeViewport('coronal');
viewerRef.current?.maximizeViewport('sagittal');
viewerRef.current?.maximizeViewport('panoramic');
viewerRef.current?.maximizeViewport('crossSection');
viewerRef.current?.maximizeViewport('3d');

viewerRef.current?.restoreLayout();
```

Maximization is independent from study loading. The cached volume is not rebuilt. MPR cameras are persisted across viewport remounts so slice/focal point/zoom/pan survive layout changes as far as the underlying Cornerstone camera supports them.

## MPR slice navigation

```ts
viewerRef.current?.setSlice(120, 'axial');
viewerRef.current?.nextSlice('axial');
viewerRef.current?.previousSlice('axial');
```

Valid MPR viewport names are `axial`, `coronal`, and `sagittal`. If omitted, slice methods default to `axial`.

The frontend can drive its own large mobile slider from `onSliceChanged` and `getViewerState()`.

## Panoramic arch workflow

```ts
viewerRef.current?.openArchEditor();
viewerRef.current?.closeArchEditor();
```

The existing dental arch mathematics are preserved. The axial arch editor now uses Pointer Events and separates visual marker size from touch hit size: control nodes keep a small visible radius but have an approximately 36 px diameter invisible finger target. The cross-section locator uses a 30 px invisible line target.

## Cross-sections

```ts
viewerRef.current?.openCrossSections();
viewerRef.current?.closeCrossSections();

viewerRef.current?.setCrossSection(50); // logical 0..100 position
viewerRef.current?.nextCrossSection();
viewerRef.current?.previousCrossSection();
```

Internally the engine stores position as a continuous 0..1 value along the dental arch. `setCrossSection(index, count = 101)` is a frontend-friendly indexed adapter.

On touch devices the cross-section viewport also supports horizontal finger dragging to move along the arch. Desktop mouse dragging keeps the existing window/level behavior.

## Tools

```ts
viewerRef.current?.setActiveTool('crosshairs');
viewerRef.current?.setActiveTool('windowLevel');
viewerRef.current?.setActiveTool('pan');
viewerRef.current?.setActiveTool('zoom');
viewerRef.current?.setActiveTool('length');
```

Only existing Cornerstone tools are exposed; no clinical tool is simulated.

For the installed Cornerstone Tools 2.19.x engine, touch configuration is enabled for the Crosshairs tool with a larger mobile handle radius. One-finger interaction is assigned to the active tool. Two touch points are assigned to Cornerstone's `ZoomTool`, whose native pinch handler also pans while pinching. In 3D, one finger rotates and two fingers use the native pinch zoom/pan behavior.

## Reset / resize

```ts
viewerRef.current?.resetView('axial');
viewerRef.current?.resetView('3d');
viewerRef.current?.resize();
```

`resetView()` targets the requested Cornerstone camera. Panoramic/cross-section are canvas-derived views and therefore have no Cornerstone camera reset at engine level.

MPR viewports use `ResizeObserver`; `resize()` remains available after host animations or orientation transitions.

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

```tsx
<DicomViewer
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
/>
```

`onCrosshairChanged` is emitted from linked MPR camera geometry changes. Cornerstone also emits camera changes for pan/zoom, so treat this callback as a UI refresh signal rather than an audit/clinical event.

For lower-level integrations the event bridge is also exported:

```ts
import { onViewerEvent } from 'dental-cbct-viewer';

const off = onViewerEvent('crosshairChanged', () => {
  // update host UI
});

off();
```

## Mobile gesture foundation

The viewer reserves CBCT viewport surfaces for medical gestures using `touch-action: none`, `overscroll-behavior: contain` and Pointer Events where custom overlays are involved. This prevents Safari/Chrome page scrolling from stealing drags over the image while leaving the surrounding host application free to scroll.

MPR currently provides:

- one-finger active Cornerstone tool interaction;
- mobile Crosshairs mode with enlarged handles;
- two-finger native Cornerstone pinch zoom/pan;
- wheel/host API slice navigation;
- double-tap reset for MPR viewports;
- Pointer Event support for mouse, touch and stylus.

Dental panoramic editing provides:

- large invisible touch targets around control nodes;
- pointer capture while dragging;
- large invisible target around the active cross-section line;
- direct finger movement of the cross-section position along the arch.

Cross-section viewing provides:

- horizontal touch drag along the arch;
- enlarged 30 px axial-Z drag target;
- desktop W/L mouse behavior preserved.

## Mobile integration rules for Bolt/new UI

The host frontend should:

- mount `<DicomViewer headless embedded />` inside the viewport area;
- keep the viewer mounted while switching Panoramic / MPR / 3D;
- call the ref API rather than importing internal Cornerstone stores;
- use `maximizeViewport()` rather than unloading the study;
- keep UI overlays outside the imaging surface whenever possible;
- never place an invisible overlay over the canvas that intercepts gestures;
- call `resize()` after large animated container transitions when needed;
- use callbacks/state to drive labels, slice sliders and mobile bottom sheets;
- keep patient/navigation UI outside the engine component.

## Performance notes

The engine keeps one shared `RenderingEngine` per loaded viewer and one cached volume ID for the study. Layout and main-view changes reuse the cached volume rather than recreating the DICOM volume. MPR camera state is saved/restored across viewport layout transitions. No mobile quality mode currently reduces clinical resolution automatically.

Actual iOS/Android performance must still be validated on physical phones with representative dental CBCT datasets; browser GPU/WebGL limits vary by device.
