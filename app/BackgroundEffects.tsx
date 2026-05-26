"use client";

import { useEffect, useRef } from "react";

export function BackgroundEffects() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const background = backgroundRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!background || prefersReducedMotion) {
      return;
    }

    let animationFrame = 0;
    let pointerX = window.innerWidth * 0.5;
    let pointerY = window.innerHeight * 0.35;

    const paintPointer = () => {
      background.style.setProperty("--mouse-x", `${pointerX}px`);
      background.style.setProperty("--mouse-y", `${pointerY}px`);
      background.style.setProperty("--mouse-alpha", "1");
      animationFrame = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        return;
      }

      pointerX = event.clientX;
      pointerY = event.clientY;

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(paintPointer);
      }
    };

    const dimPointer = () => {
      background.style.setProperty("--mouse-alpha", "0.25");
    };

    paintPointer();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", dimPointer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", dimPointer);

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div aria-hidden="true" className="vr-bg" ref={backgroundRef}>
      <div className="vr-bg__cursor" />
    </div>
  );
}
