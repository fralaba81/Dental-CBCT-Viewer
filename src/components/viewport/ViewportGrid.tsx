import { useViewer } from '@/context/ViewerContext';
import { useViewerControl } from '@/context/ViewerControlContext';
import { normalizePanelViews, type ViewKey } from '@/types/dicom';
import { Viewport2D } from './Viewport2D';
import { ViewportMPR } from './ViewportMPR';
import { Viewport3D } from './Viewport3D';
import { ViewportPanoramic } from './ViewportPanoramic';
import { ViewportCrossSection } from './ViewportCrossSection';
import { ArchCurveEditor } from '@/components/panoramic/ArchCurveEditor';
import { ImplantAxialOverlay } from '@/components/implant/ImplantAxialOverlay';
import { Viewport1x1Chrome } from './Viewport1x1Chrome';
import { PanoramaChrome } from './PanoramaChrome';

export function ViewportGrid({ headless = false }: { headless?: boolean }) {
  const { state } = useViewer();
  const { maximizedViewport, archEditorOpen, crossSectionsOpen } = useViewerControl();
  const vid = state.volumeId;

  // Public/mobile API maximization is intentionally independent from the
  // underlying layout mode. This preserves the current study/volume state and
  // lets the host restore the previous layout without reloading DICOM data.
  if (maximizedViewport && vid) {
    if (maximizedViewport === '3d') {
      return <Viewport3D volumeId={vid} />;
    }
    if (maximizedViewport === 'panoramic') {
      return (
        <div className="relative w-full h-full">
          <ViewportPanoramic volumeId={vid} showCrossSectionLine />
          {!headless && <PanoramaChrome />}
        </div>
      );
    }
    if (maximizedViewport === 'crossSection') {
      return <ViewportCrossSection volumeId={vid} />;
    }

    const orientation = maximizedViewport === 'axial'
      ? 'AXIAL'
      : maximizedViewport === 'coronal'
        ? 'CORONAL'
        : 'SAGITTAL';

    return (
      <div className="relative w-full h-full">
        <ViewportMPR orientation={orientation} volumeId={vid} />
        {orientation === 'AXIAL' && <ImplantAxialOverlay />}
      </div>
    );
  }

  // 1×1 mode: the selected view. In headless mode the host frontend owns all
  // chrome, so the engine renders only medical content.
  if (state.layoutMode === '1x1') {
    if (!vid) return <Viewport2D />;
    return (
      <div className="relative w-full h-full">
        {state.viewMode === '3D'
          ? <Viewport3D volumeId={vid} />
          : <ViewportMPR orientation={state.viewMode} volumeId={vid} />}
        {state.viewMode === 'AXIAL' && <ImplantAxialOverlay />}
        {!headless && <Viewport1x1Chrome />}
      </div>
    );
  }

  // Multi-viewport layouts need a volume
  if (!vid) return <Viewport2D />;

  // External/mobile frontend: the public `mpr` mode is a true three-plane MPR
  // layout (Axial large on top, Coronal + Sagittal below). The real Cornerstone
  // viewports remain mounted inside this single engine instance.
  if (headless && state.layoutMode === '1+3') {
    return (
      <div className="flex flex-col w-full h-full gap-px bg-gray-700">
        <div className="relative h-3/5 min-h-0">
          <ViewportMPR orientation="AXIAL" volumeId={vid} />
          <ImplantAxialOverlay />
        </div>
        <div className="flex flex-1 min-h-0 gap-px">
          <div className="flex-1 min-w-0 min-h-0">
            <ViewportMPR orientation="CORONAL" volumeId={vid} />
          </div>
          <div className="flex-1 min-w-0 min-h-0">
            <ViewportMPR orientation="SAGITTAL" volumeId={vid} />
          </div>
        </div>
      </div>
    );
  }

  // External/mobile panoramic flow: the host UI decides whether the user is
  // viewing the panorama, editing the real dental arch, or browsing the real
  // perpendicular cross-sections. No fake geometry is drawn by the frontend.
  if (headless && state.layoutMode === 'OPG2+1') {
    if (archEditorOpen) {
      return (
        <div className="relative w-full h-full">
          <ViewportMPR orientation="AXIAL" volumeId={vid} />
          <ArchCurveEditor />
          <ImplantAxialOverlay />
        </div>
      );
    }
    if (crossSectionsOpen) {
      return <ViewportCrossSection volumeId={vid} />;
    }
    return (
      <div className="relative w-full h-full">
        <ViewportPanoramic volumeId={vid} showCrossSectionLine />
      </div>
    );
  }

  // 2×2 — used by the registration flow (four equal MPR/3D panes)
  if (state.layoutMode === '2x2') {
    return (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px bg-gray-700">
        <ViewportMPR orientation="AXIAL" volumeId={vid} />
        <ViewportMPR orientation="SAGITTAL" volumeId={vid} />
        <ViewportMPR orientation="CORONAL" volumeId={vid} />
        <Viewport3D volumeId={vid} />
      </div>
    );
  }

  // "3D view" (1+3 or 2×2 grid), configurable via state.panel
  if (state.layoutMode === '1+3') {
    const renderView = (key: ViewKey) =>
      key === '3D' ? <Viewport3D volumeId={vid} /> : <ViewportMPR orientation={key} volumeId={vid} />;
    const { arrangement, grid } = state.panel;
    // Guarantee four distinct views (each maps to one viewport id) and key each
    // pane by its view, so changing a panel reorders panes instead of
    // re-enabling a viewport in place — which left panes black.
    const { big, small } = normalizePanelViews(state.panel.big, state.panel.small);

    if (grid === '2x2') {
      const four = [big, ...small];
      return (
        <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px bg-gray-700">
          {four.map((k) => <div key={k} className="min-w-0 min-h-0">{renderView(k)}</div>)}
        </div>
      );
    }

    if (arrangement === 'top') {
      return (
        <div className="flex flex-col w-full h-full gap-px bg-gray-700">
          <div key={big} className="flex-1 min-h-0">{renderView(big)}</div>
          <div className="h-1/3 flex gap-px min-h-0">
            {small.map((k) => <div key={k} className="flex-1 min-w-0">{renderView(k)}</div>)}
          </div>
        </div>
      );
    }
    return (
      <div className="flex w-full h-full gap-px bg-gray-700">
        <div key={big} className="flex-1 h-full min-w-0">{renderView(big)}</div>
        <div className="w-1/3 h-full flex flex-col gap-px">
          {small.map((k) => <div key={k} className="flex-1 min-h-0">{renderView(k)}</div>)}
        </div>
      </div>
    );
  }

  // "Panoramic view" — one big panoramic + three small (axial, cross-section, coronal)
  if (state.layoutMode === 'OPG2+1') {
    const smallNodes = [
      <div key="ax" className="relative flex-1 min-w-0 min-h-0">
        <ViewportMPR orientation="AXIAL" volumeId={vid} />
        <ArchCurveEditor />
        <ImplantAxialOverlay />
      </div>,
      <div key="cs" className="flex-1 min-w-0 min-h-0">
        <ViewportCrossSection volumeId={vid} />
      </div>,
      <div key="co" className="flex-1 min-w-0 min-h-0">
        <ViewportMPR orientation="CORONAL" volumeId={vid} />
      </div>,
    ];
    const pano = (
      <div className="relative w-full h-full">
        <ViewportPanoramic volumeId={vid} showCrossSectionLine />
        <PanoramaChrome />
      </div>
    );

    if (state.panel.panoArrangement === 'left') {
      return (
        <div className="flex w-full h-full gap-px bg-gray-700">
          <div className="flex-1 min-w-0">{pano}</div>
          <div className="w-1/3 flex flex-col gap-px">{smallNodes}</div>
        </div>
      );
    }
    return (
      <div className="flex flex-col w-full h-full gap-px bg-gray-700">
        <div className="flex-1 min-h-0">{pano}</div>
        <div className="h-1/3 flex gap-px min-h-0">{smallNodes}</div>
      </div>
    );
  }

  return <Viewport2D />;
}
