import { useEffect } from "react";
import { useDunn } from "@/lib/store";

export function HydrateDunn() {
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useDunn.persist.rehydrate()).then(() => {
      if (cancelled) return;
      useDunn.getState().seedIfEmpty();
      useDunn.getState().setHydrated();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

export function useHasHydrated() {
  return useDunn((s) => s.hydrated);
}
