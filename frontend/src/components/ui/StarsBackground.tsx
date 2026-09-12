"use client";

const coral = "#ff725f";

const paths = [
  "M0 110H125Q155 110 155 140V250H320",
  "M0 330H180Q220 330 220 370V455H470",
  "M90 0V105Q90 140 125 140H390V220H540",
  "M360 0V75Q360 110 395 110H680V185H820",
  "M720 0V120Q720 155 755 155H1080V245H1260",
  "M1120 0V80Q1120 120 1080 120H920V330H760",
  "M1440 170H1300Q1260 170 1260 210V390H1090",
  "M1440 430H1250Q1210 430 1210 470V540H980",
  "M0 650H145Q185 650 185 610V525H410",
  "M0 820H260Q300 820 300 780V700H570V610H700",
  "M430 900V820Q430 780 470 780H760V700H900",
  "M860 900V825Q860 790 895 790H1110V665H1280",
  "M1440 760H1320Q1280 760 1280 720V620H1130",
  "M1440 900H1190Q1150 900 1150 860V820H990",
];

const junctions = [
  [155, 110], [220, 330], [90, 140], [360, 110], [720, 155], [1120, 120],
  [1260, 170], [1210, 430], [185, 650], [300, 820], [430, 780], [860, 790],
  [1280, 760], [1150, 820], [540, 220], [980, 540],
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
            <path d={path} stroke={coral} strokeWidth="2" opacity="0.28" vectorEffect="non-scaling-stroke" />
            <path
              d={path}
              pathLength="1"
              stroke={coral}
              strokeWidth="2.5"
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
            r="7"
            fill={coral}
            className="node-circuit-dot"
            style={{ animationDelay: `${index * -0.35}s` }}
          />
        ))}
      </svg>
      <style jsx>{`
        .node-circuit-path {
          stroke-dasharray: 0.025 0.975;
          animation: circuit-flow 5s linear infinite;
        }
        .node-circuit-dot {
          transform-box: fill-box;
          transform-origin: center;
          animation: circuit-pulse 2.6s ease-in-out infinite;
        }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes circuit-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
