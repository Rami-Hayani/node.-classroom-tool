"use client";

const accent = "#286da8";

const paths = [
  "M0 110H120Q175 110 175 165V285H390",
  "M0 405H170Q225 405 225 460V555H470",
  "M90 0V70Q90 125 145 125H365Q420 125 420 180V245H560",
  "M420 0V65Q420 120 475 120H700Q755 120 755 175V245H880",
  "M1040 0V75Q1040 130 985 130H825Q770 130 770 185V260H650",
  "M1360 0V90Q1360 145 1305 145H1190Q1135 145 1135 200V285H1020",
  "M1440 235H1320Q1265 235 1265 290V410H1080",
  "M1440 490H1290Q1235 490 1235 545V625H1080",
  "M0 650H125Q180 650 180 595V505H340",
  "M0 825H200Q255 825 255 770V690H470",
  "M90 900V845Q90 790 145 790H315Q370 790 370 735V650H520",
  "M560 900V840Q560 785 615 785H800Q855 785 855 730V650H980",
  "M960 900V845Q960 790 1015 790H1190Q1245 790 1245 735V650H1370",
  "M1440 770H1350Q1295 770 1295 715V650H1170",
  "M1440 900H1260Q1205 900 1205 845V790H1060",
];

const circles = [
  [175, 110], [225, 405], [90, 125], [420, 120], [1040, 130], [1360, 145],
  [1265, 235], [1235, 490], [180, 650], [255, 825], [370, 790], [560, 785],
  [960, 790], [1295, 770], [1205, 900],
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
              strokeWidth="2"
              opacity="0.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path}
              pathLength="100"
              stroke={accent}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="node-circuit-highlight"
              style={{ animationDuration: `${6 + (index % 4)}s`, animationDelay: `${index * -0.45}s` }}
            />
          </g>
          );
        })}
        {circles.map(([cx, cy]) => (
          <circle
            key={`circle-${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="7"
            fill={accent}
            className="node-circle"
          />
        ))}
      </svg>
      <style jsx>{`
        .node-circuit-highlight {
          stroke-dasharray: 12 88;
          opacity: 0.1;
          animation: circuit-flow 6s linear infinite, circuit-fade 2.8s ease-in-out infinite;
        }
        .node-circle {
          opacity: 0.78;
          animation: marker-fade 3.8s ease-in-out infinite;
        }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes circuit-fade {
          0%, 100% { opacity: 0.12; }
          45%, 60% { opacity: 0.88; }
        }
        @keyframes marker-fade {
          0%, 100% { opacity: 0.38; }
          50% { opacity: 0.92; }
        }
      `}</style>
    </div>
  );
}
