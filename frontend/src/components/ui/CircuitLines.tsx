"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import {
  createCircuitRoutes,
  type CircuitRoute,
  type CircuitSide,
  type MeasuredAnchor,
} from "@/lib/circuit-paths";

type CircuitLinesProps = {
  containerRef: RefObject<HTMLElement | null>;
};

function readAnchors(container: HTMLElement): MeasuredAnchor[] {
  const containerBox = container.getBoundingClientRect();

  return Array.from(container.querySelectorAll<HTMLElement>("[data-circuit-anchor]"))
    .map((element, index) => {
      const box = element.getBoundingClientRect();
      const side = element.dataset.circuitSide as CircuitSide | undefined;

      return {
        id: element.dataset.circuitAnchor || `anchor-${index}`,
        left: box.left - containerBox.left,
        top: box.top - containerBox.top,
        width: box.width,
        height: box.height,
        side,
        order: Number(element.dataset.circuitOrder ?? index),
      };
    })
    .filter((anchor) => anchor.width > 0 && anchor.height > 0)
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...anchor }) => anchor);
}

function useCircuitRoutes(containerRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ width: number; height: number; routes: CircuitRoute[] }>({
    width: 0,
    height: 0,
    routes: [],
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let frameId: number | undefined;

    const measure = () => {
      if (frameId !== undefined) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const box = container.getBoundingClientRect();
        const anchors = readAnchors(container);
        setState({
          width: box.width,
          height: box.height,
          routes: createCircuitRoutes(anchors, { clearance: 16, cornerRadius: 22 }),
        });
      });
    };

    const debouncedMeasure = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(measure, 80);
    };

    const observer = new ResizeObserver(debouncedMeasure);
    observer.observe(container);
    container.querySelectorAll<HTMLElement>("[data-circuit-anchor]").forEach((anchor) => observer.observe(anchor));
    window.addEventListener("resize", debouncedMeasure, { passive: true });
    measure();

    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", debouncedMeasure);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (frameId !== undefined) cancelAnimationFrame(frameId);
    };
  }, [containerRef]);

  return state;
}

export default function CircuitLines({ containerRef }: CircuitLinesProps) {
  const { width, height, routes } = useCircuitRoutes(containerRef);
  if (!width || !height || routes.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      {routes.map((route, index) => (
        <g key={`${route.source.x}-${route.target.x}-${index}`}>
          <path
            d={route.d}
            stroke="var(--circuit-accent, #286da8)"
            strokeWidth="1.5"
            opacity="0.28"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={route.d}
            pathLength="100"
            className="circuit-flow-path"
            style={{ animationDelay: `${index * -0.8}s` }}
          />
          <circle cx={route.source.x} cy={route.source.y} r="4" className="circuit-content-circle" />
          <rect
            x={route.target.x - 4}
            y={route.target.y - 4}
            width="8"
            height="8"
            rx="1"
            className="circuit-content-square"
          />
          {route.bends.map((bend, bendIndex) => (
            <rect
              key={`${bend.x}-${bend.y}-${bendIndex}`}
              x={bend.x - 6}
              y={bend.y - 6}
              width="12"
              height="12"
              rx="1"
              transform={`rotate(45 ${bend.x} ${bend.y})`}
              className="circuit-junction-diamond"
            />
          ))}
        </g>
      ))}
      <style>{`
        .circuit-flow-path {
          stroke: var(--circuit-accent, #286da8);
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 12 88;
          opacity: 0.12;
          animation: circuit-flow 6s linear infinite, circuit-fade 3s ease-in-out infinite;
        }
        .circuit-content-circle,
        .circuit-content-square,
        .circuit-junction-diamond {
          fill: white;
          stroke: var(--circuit-accent, #286da8);
          vector-effect: non-scaling-stroke;
        }
        .circuit-content-circle { fill: var(--circuit-accent, #286da8); stroke: none; }
        .circuit-content-square { fill: var(--circuit-accent, #286da8); stroke: none; }
        .circuit-junction-diamond { stroke-width: 1.5; opacity: 0.82; }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes circuit-fade {
          0%, 100% { opacity: 0.08; }
          45%, 60% { opacity: 0.72; }
        }
        @media (prefers-reduced-motion: reduce) {
          .circuit-flow-path { animation: none; opacity: 0.4; }
        }
      `}</style>
    </svg>
  );
}
