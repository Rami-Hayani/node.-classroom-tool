"use client";

export default function StarsBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-white pointer-events-none" aria-hidden="true">
      <img
        src="/node-circuit-stencil.png"
        alt=""
        className="node-stencil absolute left-1/2 top-1/2 h-[108%] w-[108%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover"
      />
      <style jsx>{`
        .node-stencil {
          animation: stencil-drift 24s ease-in-out infinite alternate;
          transform-origin: center;
        }
        @keyframes stencil-drift {
          from { transform: translate(-50%, -50%) scale(1); }
          to { transform: translate(-49.5%, -50.5%) scale(1.035); }
        }
        @media (prefers-reduced-motion: reduce) {
          .node-stencil { animation: none; }
        }
      `}</style>
    </div>
  );
}
