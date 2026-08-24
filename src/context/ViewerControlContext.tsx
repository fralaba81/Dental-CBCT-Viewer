import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ViewerViewport } from '@/types/viewerApi';

interface ViewerControlContextValue {
  maximizedViewport: ViewerViewport | null;
  setMaximizedViewport: (viewport: ViewerViewport | null) => void;
  archEditorOpen: boolean;
  setArchEditorOpen: (open: boolean) => void;
  crossSectionsOpen: boolean;
  setCrossSectionsOpen: (open: boolean) => void;
}

const ViewerControlContext = createContext<ViewerControlContextValue | null>(null);

export function ViewerControlProvider({ children }: { children: ReactNode }) {
  const [maximizedViewport, setMaximizedViewport] = useState<ViewerViewport | null>(null);
  const [archEditorOpen, setArchEditorOpen] = useState(false);
  const [crossSectionsOpen, setCrossSectionsOpen] = useState(false);

  const value = useMemo(
    () => ({
      maximizedViewport,
      setMaximizedViewport,
      archEditorOpen,
      setArchEditorOpen,
      crossSectionsOpen,
      setCrossSectionsOpen,
    }),
    [maximizedViewport, archEditorOpen, crossSectionsOpen],
  );

  return (
    <ViewerControlContext.Provider value={value}>
      {children}
    </ViewerControlContext.Provider>
  );
}

export function useViewerControl() {
  const context = useContext(ViewerControlContext);
  if (!context) throw new Error('useViewerControl must be used within ViewerControlProvider');
  return context;
}
