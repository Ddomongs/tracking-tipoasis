"use client";

import { useEffect } from "react";

export const SplineBackground = () => {
  useEffect(() => {
    document.documentElement.dataset.bgIntensity = "ultra";
    document.documentElement.dataset.bgTone = "dark";
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      document.documentElement.style.setProperty("--bg-mouse-x", x.toFixed(4));
      document.documentElement.style.setProperty("--bg-mouse-y", y.toFixed(4));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div aria-hidden="true" className="spline-bg-shell">
      <iframe
        src="https://my.spline.design/nexbotrobotcharacterconcept-JfDDJ0Z0WLoCN9Ec1FyBSALC/"
        className="spline-bg-frame"
        frameBorder="0"
        tabIndex={-1}
        loading="lazy"
        title="Decorative background scene"
      />
      <div className="spline-bg-overlay" />
    </div>
  );
};
