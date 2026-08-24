import type { ViewportTool } from './dicom';

export type MainView = 'panoramic' | 'mpr' | '3d';

export type ViewerViewport =
  | 'axial'
  | 'coronal'
  | 'sagittal'
  | 'panoramic'
  | 'crossSection'
  | '3d';

export interface ViewerSliceState {
  index: number;
  total: number;
}

export interface ViewerPublicState {
  studyLoaded: boolean;
  mainView: MainView;
  maximizedViewport: ViewerViewport | null;
  currentSlices: {
    axial: number;
    coronal: number;
    sagittal: number;
  };
  sliceCounts: {
    axial: number;
    coronal: number;
    sagittal: number;
  };
  currentTool: ViewportTool;
  loading: boolean;
  loadingProgress: number;
  archEditorOpen: boolean;
  crossSectionsOpen: boolean;
}

export interface ViewerApiCallbacks {
  onStudyLoaded?: () => void;
  onStudyUnloaded?: () => void;
  onMainViewChanged?: (view: MainView) => void;
  onViewportMaximized?: (viewport: ViewerViewport) => void;
  onViewportRestored?: () => void;
  onSliceChanged?: (
    viewport: 'axial' | 'coronal' | 'sagittal',
    index: number,
    total: number,
  ) => void;
  onCrosshairChanged?: () => void;
  onArchChanged?: () => void;
  onCrossSectionChanged?: (position: number) => void;
  onToolChanged?: (tool: ViewportTool) => void;
  onLoadingProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: ViewerPublicState) => void;
}
