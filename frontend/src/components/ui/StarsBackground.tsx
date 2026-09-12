"use client";

const accent = "#315a7d";

const paths = [
  "M0 105H120Q155 105 155 140V245H315",
  "M0 300H180Q220 300 220 340V420H390",
  "M95 0V72Q95 108 130 108H350V190H470",
  "M395 0V65Q395 100 430 100H625V180H760",
  "M1030 0V72Q1030 108 995 108H870V205H760",
  "M1345 0V92Q1345 130 1308 130H1190V235H1060",
  "M1440 220H1320Q1280 220 1280 258V380H1125",
  "M1440 450H1300Q1260 450 1260 488V555H1110",
  "M0 610H130Q170 610 170 570V500H320",
  "M0 800H210Q250 800 250 760V690H410",
  "M80 900V835Q80 800 115 800H300V730H450",
  "M530 900V840Q530 805 565 805H735V735H870",
  "M930 900V835Q930 800 965 800H1135V720H1280",
  "M1440 735H1360Q1320 735 1320 695V625H1200",
  "M1440 885H1250Q1210 885 1210 845V795H1080",
];

const diamonds = [
  [155, 105], [220, 300], [395, 100], [1030, 108], [1280, 220],
  [1260, 450], [170, 610], [250, 800], [530, 805], [930, 800],
  [1320, 735], [1210, 885],
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
        preserveAspectRatio="none"
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
        {diamonds.map(([cx, cy]) => (
          <rect
            key={`diamond-${cx}-${cy}`}
            x={cx - 8}
            y={cy - 8}
            width="16"
            height="16"
            rx="1"
            fill="white"
            stroke={accent}
            strokeWidth="2"
            transform={`rotate(45 ${cx} ${cy})`}
            className="node-marker"
          />
        ))}
        {terminals.map(([cx, cy]) => (
          <rect
            key={`terminal-${cx}-${cy}`}
            x={cx - 5}
            y={cy - 5}
            width="10"
            height="10"
            rx="1"
            fill={accent}
            className="node-terminal"
          />
        ))}
      </svg>
      <style jsx>{`
        .node-circuit-highlight {
          stroke-dasharray: 12 88;
          opacity: 0.1;
          animation: circuit-flow 6s linear infinite, circuit-fade 2.8s ease-in-out infinite;
        }
        .node-marker {
          opacity: 0.78;
          animation: marker-fade 3.8s ease-in-out infinite;
        }
        .node-terminal {
          opacity: 0.72;
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
