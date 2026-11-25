export type ToastKind = "success" | "error" | "info";
type Listener = (kind: ToastKind, message: string) => void;
const listeners = new Set<Listener>();

/** Tiny event bus: anything can raise a toast; the <ToastHost> in the root layout shows them one at a time. */
export const toast = {
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  show(kind: ToastKind, message: string) { listeners.forEach((l) => l(kind, message)); },
  success: (m: string) => toast.show("success", m),
  error: (m: string) => toast.show("error", m),
  info: (m: string) => toast.show("info", m),
};
