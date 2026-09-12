"use client";

const accent = "#286da8";

const paths = [
  "M0 120H135Q205 120 205 190V315Q205 385 275 385H500",
  "M0 450H115Q185 450 185 520V625Q185 695 255 695H475",
  "M80 0V70Q80 140 150 140H370Q440 140 440 210V285H610",
  "M475 0V55Q475 125 545 125H760Q830 125 830 195V280H960",
  "M1000 0V80Q1000 150 930 150H820Q750 150 750 220V300H650",
  "M1370 0V95Q1370 165 1300 165H1160Q1090 165 1090 235V320H990",
  "M1440 250H1325Q1255 250 1255 320V445H1080",
  "M1440 545H1310Q1240 545 1240 615V700H1070",
  "M0 760H120Q190 760 190 690V585H350",
  "M0 900H235Q305 900 305 830V755H500",
  "M140 900V845Q140 775 210 775H365Q435 775 435 705V640H565",
  "M600 900V850Q600 780 670 780H820Q890 780 890 710V640H1000",
  "M1010 900V845Q1010 775 1080 775H1220Q1290 775 1290 705V640H1430",
];

const endpoints = [
  [0, 120], [500, 385], [0, 450], [475, 695],
  [80, 0], [610, 285], [475, 0], [960, 280],
  [1000, 0], [650, 300], [1370, 0], [990, 320],
  [1440, 250], [1080, 445], [1440, 545], [1070, 700],
  [0, 760], [350, 585], [0, 900], [500, 755],
  [140, 900], [565, 640], [600, 900], [1000, 640],
  [1010, 900], [1430, 640],
];

export default function StarsBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#fbfdff] pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(199,229,255,0.4),transparent_32%),radial-gradient(circle_at_18%_78%,rgba(222,211,255,0.24),transparent_27%),radial-gradient(circle_at_85%_18%,rgba(207,246,237,0.3),transparent_24%)]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <pattern id="node-dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1" fill={accent} opacity="0.08" />
          </pattern>
        </defs>
        <rect width="1440" height="900" fill="url(#node-dot-grid)" />
        {paths.map((path, index) => {
          const pathId = `node-trace-${index}`;
          return (
          <g key={path}>
            <path
              id={pathId}
              d={path}
              stroke={accent}
              strokeWidth="2.2"
              opacity="0.34"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path}
              pathLength="100"
              stroke={accent}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="node-circuit-highlight"
              style={{ animationDuration: `${7 + (index % 4)}s`, animationDelay: `${index * -0.45}s` }}
            />
          </g>
          );
        })}
        {endpoints.map(([cx, cy], index) => (
          <g key={`endpoint-${cx}-${cy}-${index}`}>
            <circle cx={cx} cy={cy} r="8.5" fill="white" className="node-circle-halo" />
            <circle cx={cx} cy={cy} r="6.5" fill={accent} className="node-circle" />
          </g>
        ))}
      </svg>
      <style jsx>{`
        .node-circuit-highlight {
          stroke-dasharray: 16 84;
          opacity: 0.06;
          animation: circuit-flow 6s linear infinite, circuit-fade 2.8s ease-in-out infinite;
        }
        .node-circle {
          opacity: 0.82;
          animation: marker-fade 3.8s ease-in-out infinite;
        }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes circuit-fade {
          0%, 100% { opacity: 0.03; }
          42%, 58% { opacity: 0.48; }
        }
        @keyframes marker-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}
