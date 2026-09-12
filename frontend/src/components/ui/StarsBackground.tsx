"use client";

import { useEffect, useRef } from "react";

interface Point { x: number; y: number; }
interface CircuitPath { points: Point[]; pulseOffset: number; pulseSpeed: number; }

const CORAL = "#ff725f";
const GREEN = "#0d2d08";

function createPaths(width: number, height: number): CircuitPath[] {
  const midX = width * 0.5;
  const midY = height * 0.5;
  const edgePaths = [
    [{ x: -20, y: height * 0.16 }, { x: width * 0.16, y: height * 0.16 }, { x: width * 0.22, y: height * 0.22 }, { x: midX - 70, y: height * 0.22 }],
    [{ x: width * 0.08, y: -20 }, { x: width * 0.08, y: height * 0.18 }, { x: width * 0.16, y: height * 0.25 }, { x: width * 0.16, y: midY - 80 }],
    [{ x: width * 0.3, y: -20 }, { x: width * 0.3, y: height * 0.12 }, { x: width * 0.37, y: height * 0.2 }, { x: width * 0.37, y: midY - 45 }],
    [{ x: width * 0.68, y: -20 }, { x: width * 0.68, y: height * 0.12 }, { x: width * 0.62, y: height * 0.2 }, { x: midX + 45, y: height * 0.2 }],
    [{ x: width * 0.9, y: -20 }, { x: width * 0.9, y: height * 0.19 }, { x: width * 0.82, y: height * 0.26 }, { x: midX + 130, y: height * 0.26 }],
    [{ x: width + 20, y: height * 0.15 }, { x: width * 0.82, y: height * 0.15 }, { x: width * 0.75, y: height * 0.23 }, { x: midX + 85, y: height * 0.23 }],
    [{ x: -20, y: height * 0.66 }, { x: width * 0.13, y: height * 0.66 }, { x: width * 0.2, y: height * 0.58 }, { x: midX - 110, y: height * 0.58 }],
    [{ x: -20, y: height * 0.84 }, { x: width * 0.12, y: height * 0.84 }, { x: width * 0.2, y: height * 0.76 }, { x: midX - 55, y: height * 0.76 }],
    [{ x: width * 0.08, y: height + 20 }, { x: width * 0.08, y: height * 0.82 }, { x: width * 0.17, y: height * 0.72 }, { x: width * 0.17, y: midY + 70 }],
    [{ x: width * 0.36, y: height + 20 }, { x: width * 0.36, y: height * 0.78 }, { x: width * 0.43, y: height * 0.7 }, { x: width * 0.43, y: midY + 110 }],
    [{ x: width * 0.72, y: height + 20 }, { x: width * 0.72, y: height * 0.8 }, { x: width * 0.64, y: height * 0.72 }, { x: midX + 50, y: midY + 70 }],
    [{ x: width + 20, y: height * 0.78 }, { x: width * 0.84, y: height * 0.78 }, { x: width * 0.77, y: height * 0.7 }, { x: midX + 105, y: height * 0.7 }],
  ];
  return edgePaths.map((points, index) => ({ points, pulseOffset: index * 0.8, pulseSpeed: 0.0015 + (index % 4) * 0.00035 }));
}

function drawRoundedPath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!next) { ctx.lineTo(point.x, point.y); continue; }
    const radius = Math.min(28, Math.abs(next.x - previous.x) / 3, Math.abs(next.y - previous.y) / 3);
    const before = { x: point.x + Math.sign(previous.x - point.x) * radius, y: point.y + Math.sign(previous.y - point.y) * radius };
    const after = { x: point.x + Math.sign(next.x - point.x) * radius, y: point.y + Math.sign(next.y - point.y) * radius };
    ctx.lineTo(before.x, before.y);
    ctx.quadraticCurveTo(point.x, point.y, after.x, after.y);
  }
}

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let paths: CircuitPath[] = [];
    let animationFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paths = createPaths(width, height);
    };

    const animate = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = GREEN;
      ctx.fillRect(0, 0, width, height);

      paths.forEach((path) => {
        drawRoundedPath(ctx, path.points);
        ctx.strokeStyle = "rgba(255, 114, 95, 0.8)";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        const phase = time * path.pulseSpeed + path.pulseOffset;
        const pulseIndex = Math.floor(phase % (path.points.length - 1));
        const start = path.points[pulseIndex];
        const end = path.points[pulseIndex + 1];
        const progress = phase % 1;
        ctx.fillStyle = CORAL;
        ctx.beginPath();
        ctx.arc(start.x + (end.x - start.x) * progress, start.y + (end.y - start.y) * progress, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      paths.flatMap((path) => path.points.slice(1, -1)).forEach((marker, index) => {
        ctx.fillStyle = CORAL;
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 2.5 + Math.sin(time * 0.002 + index) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />;
}
