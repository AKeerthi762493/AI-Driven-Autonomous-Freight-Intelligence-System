import { useEffect, useRef } from "react";
import { networkStations, networkRoutes } from "@/data/mockData";

interface NetworkMapProps {
  dark?: boolean;
  className?: string;
  showLabels?: boolean;
  highlightRoutes?: number[];
  animated?: boolean;
}

export function NetworkMap({ dark = true, className = "", showLabels = true, animated = true }: NetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    const draw = () => {
      timeRef.current += 0.005;
      ctx.clearRect(0, 0, w, h);

      // Draw routes
      networkRoutes.forEach((route, i) => {
        const from = networkStations[route.from];
        const to = networkStations[route.to];
        const x1 = (from.x / 100) * w;
        const y1 = (from.y / 100) * h;
        const x2 = (to.x / 100) * w;
        const y2 = (to.y / 100) * h;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = dark ? "rgba(56, 189, 248, 0.15)" : "rgba(37, 99, 235, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Animated train dot
        if (animated) {
          const t = (timeRef.current + i * 0.15) % 1;
          const dx = x1 + (x2 - x1) * t;
          const dy = y1 + (y2 - y1) * t;
          ctx.beginPath();
          ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "rgba(56, 189, 248, 0.8)" : "rgba(37, 99, 235, 0.8)";
          ctx.fill();
          // Glow
          ctx.beginPath();
          ctx.arc(dx, dy, 6, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "rgba(56, 189, 248, 0.15)" : "rgba(37, 99, 235, 0.15)";
          ctx.fill();
        }
      });

      // Draw stations
      networkStations.forEach((station) => {
        const x = (station.x / 100) * w;
        const y = (station.y / 100) * h;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(56, 189, 248, 0.6)" : "rgba(37, 99, 235, 0.6)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#38bdf8" : "#2563eb";
        ctx.fill();

        if (showLabels) {
          ctx.font = "10px Inter, system-ui";
          ctx.fillStyle = dark ? "rgba(148, 163, 184, 0.8)" : "rgba(100, 116, 139, 0.8)";
          ctx.textAlign = "center";
          ctx.fillText(station.name, x, y - 10);
        }
      });

      if (animated) {
        animRef.current = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [dark, showLabels, animated]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
    />
  );
}
