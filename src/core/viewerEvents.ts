type Listener<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Listener>>();

export function emitViewerEvent<T>(event: string, payload: T) {
  listeners.get(event)?.forEach((listener) => listener(payload));
}

export function onViewerEvent<T>(event: string, listener: Listener<T>) {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener as Listener);
  return () => {
    set?.delete(listener as Listener);
    if (set?.size === 0) listeners.delete(event);
  };
}
