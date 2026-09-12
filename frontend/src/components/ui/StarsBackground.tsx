"use client";

const coral = "#ff725f";

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

const junctions = [
  [155, 105], [220, 300], [95, 108], [395, 100], [1030, 108], [1345, 130],
  [1280, 220], [1260, 450], [170, 610], [250, 800], [530, 805], [930, 800],
  [1320, 735], [1210, 885], [315, 245], [1110, 555],
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
        {paths.map((path, index) => (
          <g key={path}>
            <path d={path} stroke={coral} strokeWidth="1.6" opacity="0.2" vectorEffect="non-scaling-stroke" />
            <path
              d={path}
              pathLength="1"
              stroke={coral}
              strokeWidth="2.2"
              opacity="0.9"
              vectorEffect="non-scaling-stroke"
              className="node-circuit-path"
              style={{ animationDelay: `${index * -0.7}s` }}
            />
          </g>
        ))}
        {junctions.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="6"
            fill={coral}
            className="node-circuit-dot"
            style={{ animationDelay: `${index * -0.35}s` }}
          />
        ))}
      </svg>
      <style jsx>{`
        .node-circuit-path {
          stroke-dasharray: 0.02 0.98;
          animation: circuit-flow 6s linear infinite;
        }
        .node-circuit-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: circuit-pulse 3s ease-in-out infinite;
        }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes circuit-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.82); }
          50% { opacity: 0.95; transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
