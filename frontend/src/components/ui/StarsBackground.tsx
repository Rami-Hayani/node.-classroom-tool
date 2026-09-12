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
              stroke={coral}
              strokeWidth="2"
              opacity="0.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path}
              pathLength="100"
              stroke={coral}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
              vectorEffect="non-scaling-stroke"
              className="node-circuit-path"
              style={{ animationDuration: `${5 + (index % 4)}s`, animationDelay: `${index * -0.45}s` }}
            />
            <circle r="5" fill={coral} className="node-circuit-runner">
              <animateMotion
                dur={`${7 + (index % 3)}s`}
                repeatCount="indefinite"
                rotate="auto"
                begin={`${index * -0.5}s`}
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          </g>
          );
        })}
      </svg>
      <style jsx>{`
        .node-circuit-path {
          stroke-dasharray: 14 86;
          animation: circuit-flow 6s linear infinite;
        }
        .node-circuit-runner {
          opacity: 0.95;
          filter: drop-shadow(0 0 5px rgba(255, 114, 95, 0.45));
        }
        @keyframes circuit-flow {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
