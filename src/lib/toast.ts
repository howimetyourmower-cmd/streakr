type ToastPayload = { id?: string; kind?: "success"|"info"|"error"; msg: string; ms?: number };
const TOAST_EVENT = "streakr:toast";
export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}
export function onToast(handler: (p: ToastPayload)=>void) {
  const fn = (e: Event) => handler((e as CustomEvent).detail as ToastPayload);
  window.addEventListener(TOAST_EVENT, fn);
  return () => window.removeEventListener(TOAST_EVENT, fn);
}
