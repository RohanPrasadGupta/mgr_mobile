import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./motion";

/** Tweens a number to `target` (ease-out, ~600 ms) so totals roll to their new value; returns `target` as is when motion is reduced. */
export function useCountUp(target: number | undefined, duration = 600): number | undefined {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<number | null>(null);
  const from = useRef<number | undefined>(undefined);
  useEffect(() => {
    const a = from.current ?? 0;
    from.current = target;
    if (target === undefined || a === target || reduced) return;
    const start = Date.now();
    let raf = requestAnimationFrame(function tick() {
      const k = Math.min(1, (Date.now() - start) / duration), eased = 1 - (1 - k) ** 3;
      setFrame(k < 1 ? Math.round(a + (target - a) * eased) : null);
      if (k < 1) raf = requestAnimationFrame(tick);
    });
    return () => { cancelAnimationFrame(raf); setFrame(null); };
  }, [target, duration, reduced]);
  return target === undefined ? undefined : (frame ?? target);
}
