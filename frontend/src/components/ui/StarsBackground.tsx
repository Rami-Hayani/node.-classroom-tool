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

const circles = [
  [135, 120], [500, 385], [115, 450], [475, 695],
  [80, 70], [610, 285], [1000, 80], [650, 300],
  [1255, 250], [1070, 700], [120, 760], [500, 755], [1000, 640],
];

const terminals = [
  [315, 245], [390, 420], [470, 190], [760, 180], [760, 205],
  [1060, 235], [1125, 380], [1110, 555], [320, 500], [410, 690],
  [450, 730], [870, 735], [1280, 625], [1080, 795],
];

export default function StarsBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-white pointer-events-none" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
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
        {circles.map(([cx, cy]) => (
          <circle
            key={`circle-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="8"
            fill={accent}
            className="node-circle"
          />
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
