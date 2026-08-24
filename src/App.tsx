import { useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { ViewerProvider, useViewer } from '@/context/ViewerContext';
import { ViewerControlProvider, useViewerControl } from '@/context/ViewerControlContext';
import { I18nProvider, useI18n } from '@/i18n/I18nContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { initCornerstone } from '@/core/init';
import { setActiveTool as setCornerstoneActiveTool } from '@/core/toolManager';
import { LandingPage } from '@/components/dicom/LandingPage';
import { DisclaimerBanner } from '@/components/dicom/DisclaimerBanner';
import { ViewerShell } from '@/components/layout/ViewerShell';
import { TopBar } from '@/components/layout/TopBar';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { PatientsPanel } from '@/components/panels/PatientsPanel';
import { IntroTour } from '@/components/panels/IntroTour';
import { HelpPanel } from '@/components/panels/HelpPanel';
import { useDicomLoader } from '@/hooks/useDicomLoader';
import { serializePlan } from '@/core/planIO';
import { loadSample } from '@/core/sampleLoader';
import { exportPlanPdf, exportDrillGuideStl } from '@/core/viewerExports';
import {
  getMprSnapshot,
  resetViewerViewport,
  resizeViewer,
  setViewportSlice,
  stepViewportSlice,
} from '@/core/publicViewerController';
import { onViewerEvent } from '@/core/viewerEvents';
import type { PlanData } from '@/core/planIO';
import type { ViewportTool, ImplantData, LayoutMode, ViewKey } from '@/types/dicom';
import type {
  MainView,
  ViewerApiCallbacks,
  ViewerPublicState,
  ViewerViewport,
} from '@/types/viewerApi';

const SHORTCUT_MAP: Record<string, ViewportTool> = {
  w: 'windowLevel',
  p: 'pan',
  z: 'zoom',
  s: 'scroll',
  l: 'length',
  a: 'angle',
  e: 'ellipticalRoi',
  c: 'circleRoi',
  r: 'rectangleRoi',
  f: 'freehandRoi',
  b: 'bidirectional',
  h: 'probe',
  n: 'arrowAnnotate',
  x: 'crosshairs',
};

function inferMainView(layoutMode: LayoutMode, viewMode: string): MainView {
  if (layoutMode === 'OPG2+1') return 'panoramic';
  if (layoutMode === '1x1' && viewMode === '3D') return '3d';
  return 'mpr';
}

function toMprViewport(viewport?: ViewerViewport): 'axial' | 'coronal' | 'sagittal' {
  return viewport === 'coronal' || viewport === 'sagittal' ? viewport : 'axial';
}

export interface DicomViewerProps {
  patientId?: string;
  patientName?: string;
  initialPlan?: PlanData;
  initialLayout?: LayoutMode;
  lang?: string;
  onPlanChange?: (plan: PlanData) => void;
  onImplantsChange?: (implants: ImplantData[]) => void;
  callbacks?: ViewerApiCallbacks;
  className?: string;
  /** Host owns page-level consent; suppresses the built-in disclaimer. */
  embedded?: boolean;
  /**
   * Engine-only mode for a custom frontend. Hides the built-in top bar,
   * landing page, side panels and modal chrome while keeping the real
   * Cornerstone/vtk viewer and public ref API mounted.
   */
  headless?: boolean;
}

export interface DicomViewerHandle {
  getImplants(): ImplantData[];
  addImplant(implant: ImplantData): void;
  updateImplant(implant: ImplantData): void;
  removeImplant(id: string): void;
  getPlan(): PlanData;
  loadPlan(plan: PlanData): void;
  loadStudy(files: File[]): Promise<void>;
  unloadStudy(): void;
  loadSample(): Promise<void>;
  setLayout(mode: LayoutMode): void;
  setActiveView(view: ViewKey): void;
  setMainView(view: MainView): void;
  maximizeViewport(viewport: ViewerViewport): void;
  restoreLayout(): void;
  openArchEditor(): void;
  closeArchEditor(): void;
  openCrossSections(): void;
  closeCrossSections(): void;
  setActiveTool(tool: ViewportTool): void;
  resetView(viewport?: ViewerViewport): void;
  nextSlice(viewport?: ViewerViewport): void;
  previousSlice(viewport?: ViewerViewport): void;
  setSlice(index: number, viewport?: ViewerViewport): void;
  setCrossSection(index: number, count?: number): void;
  nextCrossSection(step?: number): void;
  previousCrossSection(step?: number): void;
  getViewerState(): ViewerPublicState;
  resize(): void;
  exportPdf(): Promise<void>;
  exportGuideStl(): Promise<boolean>;
}

function ViewerApp({
  props,
  handleRef,
}: {
  props: DicomViewerProps;
  handleRef: React.Ref<DicomViewerHandle>;
}) {
  const { state, dispatch } = useViewer();
  const control = useViewerControl();
  const { t, lang, setLang } = useI18n();
  const { theme } = useTheme();
  const { loadFiles } = useDicomLoader();

  const stateRef = useRef(state);
  stateRef.current = state;
  const controlRef = useRef(control);
  controlRef.current = control;
  const previousStudyRef = useRef(false);
  const previousMainViewRef = useRef<MainView>(inferMainView(state.layoutMode, state.viewMode));
  const previousToolRef = useRef(state.activeTool);
  const previousArchRef = useRef(state.archCurveControlPoints);
  const previousCrossSectionRef = useRef(state.crossSectionPosition);

  const planMeta = () => ({
    savedAt: new Date().toISOString(),
    studyInstanceUID: stateRef.current.study?.studyInstanceUID ?? null,
    patientId: stateRef.current.study?.patientId ?? null,
  });

  const buildPublicState = useCallback((): ViewerPublicState => {
    const current = stateRef.current;
    const controls = controlRef.current;
    const slices = getMprSnapshot();
    const progress = current.loadProgress && current.loadProgress.total > 0
      ? current.loadProgress.loaded / current.loadProgress.total
      : current.isLoading ? 0 : 1;
    return {
      studyLoaded: Boolean(current.study),
      mainView: inferMainView(current.layoutMode, current.viewMode),
      maximizedViewport: controls.maximizedViewport,
      currentSlices: {
        axial: slices.axial.index,
        coronal: slices.coronal.index,
        sagittal: slices.sagittal.index,
      },
      sliceCounts: {
        axial: slices.axial.total,
        coronal: slices.coronal.total,
        sagittal: slices.sagittal.total,
      },
      currentTool: current.activeTool,
      loading: current.isLoading,
      loadingProgress: Math.max(0, Math.min(1, progress)),
      archEditorOpen: controls.archEditorOpen,
      crossSectionsOpen: controls.crossSectionsOpen,
    };
  }, []);

  const openSample = useCallback(async () => {
    const { study, volumeId, windowLevel } = await loadSample();
    dispatch({ type: 'SET_STUDY', payload: study });
    dispatch({ type: 'SET_WINDOW_LEVEL', payload: windowLevel });
    dispatch({ type: 'SET_VOLUME_ID', payload: volumeId });
  }, [dispatch]);

  useImperativeHandle(handleRef, (): DicomViewerHandle => ({
    getImplants: () => stateRef.current.implants,
    addImplant: (implant) => dispatch({ type: 'ADD_IMPLANT', payload: implant }),
    updateImplant: (implant) => dispatch({ type: 'UPDATE_IMPLANT', payload: implant }),
    removeImplant: (id) => dispatch({ type: 'REMOVE_IMPLANT', payload: id }),
    getPlan: () => serializePlan(stateRef.current, planMeta()),
    loadPlan: (plan) => dispatch({ type: 'LOAD_PLAN', payload: plan }),
    loadStudy: (files) => loadFiles(files),
    unloadStudy: () => {
      controlRef.current.setMaximizedViewport(null);
      controlRef.current.setArchEditorOpen(false);
      controlRef.current.setCrossSectionsOpen(false);
      dispatch({ type: 'RESET' });
    },
    loadSample: openSample,
    setLayout: (mode) => dispatch({ type: 'SET_LAYOUT_MODE', payload: mode }),
    setActiveView: (view) => dispatch({ type: 'SET_VIEW_MODE', payload: view }),
    setMainView: (view) => {
      controlRef.current.setMaximizedViewport(null);
      if (view === 'panoramic') {
        dispatch({ type: 'SET_LAYOUT_MODE', payload: 'OPG2+1' });
      } else if (view === '3d') {
        dispatch({ type: 'SET_LAYOUT_MODE', payload: '1x1' });
        dispatch({ type: 'SET_VIEW_MODE', payload: '3D' });
      } else {
        dispatch({ type: 'SET_LAYOUT_MODE', payload: '1+3' });
        dispatch({
          type: 'SET_PANEL',
          payload: { big: 'AXIAL', small: ['CORONAL', 'SAGITTAL', '3D'] },
        });
      }
    },
    maximizeViewport: (viewport) => {
      controlRef.current.setMaximizedViewport(viewport);
      props.callbacks?.onViewportMaximized?.(viewport);
    },
    restoreLayout: () => {
      controlRef.current.setMaximizedViewport(null);
      props.callbacks?.onViewportRestored?.();
      queueMicrotask(resizeViewer);
    },
    openArchEditor: () => {
      controlRef.current.setArchEditorOpen(true);
      dispatch({ type: 'SET_LAYOUT_MODE', payload: 'OPG2+1' });
    },
    closeArchEditor: () => controlRef.current.setArchEditorOpen(false),
    openCrossSections: () => {
      controlRef.current.setCrossSectionsOpen(true);
      dispatch({ type: 'SET_LAYOUT_MODE', payload: 'OPG2+1' });
    },
    closeCrossSections: () => controlRef.current.setCrossSectionsOpen(false),
    setActiveTool: (tool) => {
      setCornerstoneActiveTool(tool);
      dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
    },
    resetView: (viewport) => resetViewerViewport(viewport),
    nextSlice: (viewport) => stepViewportSlice(toMprViewport(viewport), 1),
    previousSlice: (viewport) => stepViewportSlice(toMprViewport(viewport), -1),
    setSlice: (index, viewport) => setViewportSlice(toMprViewport(viewport), index),
    setCrossSection: (index, count = 101) => {
      const safeCount = Math.max(2, Math.round(count));
      const normalized = Math.max(0, Math.min(1, index / (safeCount - 1)));
      dispatch({ type: 'SET_CROSS_SECTION_POSITION', payload: normalized });
    },
    nextCrossSection: (step = 0.01) => dispatch({
      type: 'SET_CROSS_SECTION_POSITION',
      payload: Math.min(1, stateRef.current.crossSectionPosition + Math.abs(step)),
    }),
    previousCrossSection: (step = 0.01) => dispatch({
      type: 'SET_CROSS_SECTION_POSITION',
      payload: Math.max(0, stateRef.current.crossSectionPosition - Math.abs(step)),
    }),
    getViewerState: buildPublicState,
    resize: resizeViewer,
    exportPdf: () => exportPlanPdf(stateRef.current, t, lang),
    exportGuideStl: () => exportDrillGuideStl(stateRef.current).then((r) => r.ok),
  }), [dispatch, loadFiles, openSample, t, lang, buildPublicState, props.callbacks]);

  useEffect(() => {
    const loaded = Boolean(state.study);
    if (loaded !== previousStudyRef.current) {
      loaded ? props.callbacks?.onStudyLoaded?.() : props.callbacks?.onStudyUnloaded?.();
      previousStudyRef.current = loaded;
    }
  }, [state.study, props.callbacks]);

  useEffect(() => {
    const view = inferMainView(state.layoutMode, state.viewMode);
    if (view !== previousMainViewRef.current) {
      previousMainViewRef.current = view;
      props.callbacks?.onMainViewChanged?.(view);
    }
  }, [state.layoutMode, state.viewMode, props.callbacks]);

  useEffect(() => {
    if (state.activeTool !== previousToolRef.current) {
      previousToolRef.current = state.activeTool;
      props.callbacks?.onToolChanged?.(state.activeTool);
    }
  }, [state.activeTool, props.callbacks]);

  useEffect(() => {
    if (state.archCurveControlPoints !== previousArchRef.current) {
      previousArchRef.current = state.archCurveControlPoints;
      props.callbacks?.onArchChanged?.();
    }
  }, [state.archCurveControlPoints, props.callbacks]);

  useEffect(() => {
    if (state.crossSectionPosition !== previousCrossSectionRef.current) {
      previousCrossSectionRef.current = state.crossSectionPosition;
      props.callbacks?.onCrossSectionChanged?.(state.crossSectionPosition);
    }
  }, [state.crossSectionPosition, props.callbacks]);

  useEffect(() => {
    const progress = state.loadProgress && state.loadProgress.total > 0
      ? state.loadProgress.loaded / state.loadProgress.total
      : state.isLoading ? 0 : 1;
    props.callbacks?.onLoadingProgress?.(Math.max(0, Math.min(1, progress)));
  }, [state.loadProgress, state.isLoading, props.callbacks]);

  useEffect(() => {
    if (state.error) props.callbacks?.onError?.(state.error);
  }, [state.error, props.callbacks]);

  useEffect(() => {
    props.callbacks?.onStateChange?.(buildPublicState());
  }, [
    state.study,
    state.layoutMode,
    state.viewMode,
    state.activeTool,
    state.isLoading,
    state.loadProgress,
    state.archCurveControlPoints,
    state.crossSectionPosition,
    control.maximizedViewport,
    control.archEditorOpen,
    control.crossSectionsOpen,
    props.callbacks,
    buildPublicState,
  ]);

  useEffect(() => onViewerEvent<{ viewport: 'axial' | 'coronal' | 'sagittal'; index: number; total: number }>(
    'sliceChanged',
    ({ viewport, index, total }) => {
      props.callbacks?.onSliceChanged?.(viewport, index, total);
      props.callbacks?.onStateChange?.(buildPublicState());
    },
  ), [props.callbacks, buildPublicState]);

  useEffect(() => onViewerEvent<{ viewport: 'axial' | 'coronal' | 'sagittal' }>(
    'crosshairChanged',
    () => {
      props.callbacks?.onCrosshairChanged?.();
      props.callbacks?.onStateChange?.(buildPublicState());
    },
  ), [props.callbacks, buildPublicState]);

  const appliedInitial = useRef(false);
  useEffect(() => {
    if (appliedInitial.current || !state.isInitialized) return;
    appliedInitial.current = true;
    if (props.initialLayout) dispatch({ type: 'SET_LAYOUT_MODE', payload: props.initialLayout });
    if (props.initialPlan) dispatch({ type: 'LOAD_PLAN', payload: props.initialPlan });
  }, [state.isInitialized, props.initialLayout, props.initialPlan, dispatch]);

  useEffect(() => {
    if (props.lang && props.lang !== lang) setLang(props.lang as Parameters<typeof setLang>[0]);
  }, [props.lang, lang, setLang]);

  const onImplants = props.onImplantsChange;
  useEffect(() => {
    onImplants?.(state.implants);
  }, [state.implants, onImplants]);

  const onPlan = props.onPlanChange;
  useEffect(() => {
    if (!onPlan) return;
    const id = setTimeout(() => onPlan(serializePlan(stateRef.current, planMeta())), 500);
    return () => clearTimeout(id);
  }, [
    onPlan, state.implants, state.anatomy, state.measurements, state.archCurveControlPoints,
    state.crossSectionPosition, state.crossSectionTiltDeg, state.safety, state.report, state.guide,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const tool = SHORTCUT_MAP[e.key.toLowerCase()];
      if (tool) {
        setCornerstoneActiveTool(tool);
        dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    initCornerstone()
      .then(() => {
        dispatch({ type: 'SET_INITIALIZED' });
      })
      .catch((err) => {
        dispatch({
          type: 'SET_ERROR',
          payload: t('app.initError', { msg: err instanceof Error ? err.message : String(err) }),
        });
      });
  }, [dispatch, t]);

  let content;
  if (!state.isInitialized) {
    content = (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-dental-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          {!props.headless && <p className="text-gray-600 dark:text-gray-400">{t('app.initializing')}</p>}
        </div>
      </div>
    );
  } else if (state.error && !state.study) {
    content = props.headless ? (
      <div className="h-full w-full bg-black" />
    ) : (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <p className="text-red-500 dark:text-red-400 mb-4">{state.error}</p>
          <button
            onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
            className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            {t('app.retry')}
          </button>
        </div>
      </div>
    );
  } else if (!state.study) {
    content = props.headless ? <div className="h-full w-full bg-black" /> : <LandingPage />;
  } else {
    content = <ViewerShell headless={props.headless} />;
  }

  return (
    <div className={`dcv-root ${theme === 'dark' ? 'dark' : ''} ${props.className ?? ''} h-full w-full`}>
      <div className="flex flex-col h-full w-full overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        {!props.headless && <TopBar />}
        <div className="flex-1 min-h-0 overflow-hidden">{content}</div>
        {!props.headless && <SettingsPanel />}
        {!props.headless && <PatientsPanel />}
        {!props.headless && <IntroTour />}
        {!props.headless && <HelpPanel />}
        {!props.headless && !props.embedded && <DisclaimerBanner />}
      </div>
    </div>
  );
}

const DicomViewer = forwardRef<DicomViewerHandle, DicomViewerProps>((props, ref) => {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ViewerProvider>
          <ViewerControlProvider>
            <ViewerApp props={props} handleRef={ref} />
          </ViewerControlProvider>
        </ViewerProvider>
      </ThemeProvider>
    </I18nProvider>
  );
});
DicomViewer.displayName = 'DicomViewer';

export default DicomViewer;
