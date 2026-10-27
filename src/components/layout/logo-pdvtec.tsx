"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { PATH_AUTOMACAO, PATH_COMERCIAL, PATH_PDV, PATH_TEC } from "./logo-pdvtec-paths";

interface LogoPDVTECProps {
  className?: string;
  collapsed?: boolean;
}

interface GlobeProps {
  id: string;
  cx: number;
  cy: number;
  r: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Globo esférico com gradiente volumétrico, malha, feixe de luz ciano e brilho superior. */
function Globe({ id, cx, cy, r }: GlobeProps) {
  const beamY = r2(cy + r * 0.08);
  const strokeWidth = r2(r * 0.012);

  return (
    <>
      <defs>
        <radialGradient id={`${id}-base`} cx={cx} cy={r2(cy - r * 0.12)} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22A6E2" />
          <stop offset="0.55" stopColor="#0A8ACB" />
          <stop offset="0.85" stopColor="#0275B7" />
          <stop offset="1" stopColor="#035A8F" />
        </radialGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1={cy - r} x2="0" y2={r2(cy - r * 0.1)} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="0.45" stopColor="#BFEAFB" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7DD3FC" stopOpacity="0" />
        </linearGradient>
        <radialGradient
          id={`${id}-beam`}
          cx={cx}
          cy={beamY}
          r={r2(r * 0.95)}
          gradientTransform={`matrix(1 0 0 0.3 0 ${r2(beamY * 0.7)})`}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#E0F7FF" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#67E8F9" stopOpacity="0.45" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-base)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <g fill="none" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth={strokeWidth}>
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
          {[0.28, 0.58, 0.86].map((k) => (
            <ellipse key={k} cx={cx} cy={cy} rx={r2(r * k)} ry={r} />
          ))}
          {[-0.66, -0.34, 0, 0.34, 0.66].map((k) => {
            const y = r2(cy + r * k);
            const half = r * Math.sqrt(1 - k * k);
            const bend = k === 0 ? 0 : r * 0.1 * Math.sign(k);
            return <path key={k} d={`M${r2(cx - half)} ${y}Q${cx} ${r2(y + bend)} ${r2(cx + half)} ${y}`} />;
          })}
        </g>
        <ellipse cx={cx} cy={beamY} rx={r2(r * 0.95)} ry={r2(r * 0.3)} fill={`url(#${id}-beam)`} />
        <ellipse cx={cx} cy={r2(cy - r * 0.55)} rx={r2(r * 0.78)} ry={r2(r * 0.45)} fill={`url(#${id}-gloss)`} />
      </g>
      <circle cx={cx} cy={cy} r={r2(r * 0.994)} fill="none" stroke="#035A8F" strokeWidth={strokeWidth} />
    </>
  );
}

/** Texto com sombra deslocada, contorno escuro e preenchimento sólido (sem áreas vazadas). */
function Lettering({ d, fill, stroke, strokeWidth, offset }: {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  offset: number;
}) {
  return (
    <>
      <path d={d} fill="#062338" fillOpacity="0.55" transform={`translate(${offset} ${offset * 1.3})`} />
      <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" paintOrder="stroke" />
    </>
  );
}

export function LogoPDVTEC({ className, collapsed = false }: LogoPDVTECProps) {
  const id = useId().replace(/:/g, "");

  if (collapsed) {
    return (
      <svg viewBox="0 0 64 64" role="img" aria-label="PDVTEC" className={cn("h-8 w-8 shrink-0", className)}>
        <Globe id={id} cx={32} cy={32} r={30} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 220 134"
      role="img"
      aria-label="PDVTEC Automação Comercial"
      className={cn("h-auto w-[150px] shrink-0", className)}
    >
      <Globe id={id} cx={59.5} cy={67} r={58} />
      <Lettering d={PATH_PDV} fill="#FFFFFF" stroke="#0B3A5C" strokeWidth={0.7} offset={1} />
      <Lettering d={PATH_TEC} fill="#0284C7" stroke="#062338" strokeWidth={0.7} offset={1} />
      <Lettering d={PATH_AUTOMACAO} fill="#FFFFFF" stroke="#0B3A5C" strokeWidth={0.35} offset={0.5} />
      <Lettering d={PATH_COMERCIAL} fill="#0284C7" stroke="#062338" strokeWidth={0.35} offset={0.5} />
    </svg>
  );
}
