import { useEffect, useRef, useState } from 'react';
import type { HeartRateSample } from '../types/bluetooth';

interface WaveformCanvasProps {
  currentBpm: number | null;
  isStreaming: boolean;
  strokeHex: string;
  samples: HeartRateSample[];
  maxHr: number;
}

function ecgShape(phase: number): number {
  // Normalized phase in [0, 1) modeling P-QRS-T cardiac cycle
  if (phase < 0.08) {
    return 0.12 * Math.sin((phase / 0.08) * Math.PI);
  }
  if (phase >= 0.14 && phase < 0.18) {
    return -0.18 * Math.sin(((phase - 0.14) / 0.04) * Math.PI);
  }
  if (phase >= 0.18 && phase < 0.24) {
    return 0.92 * Math.sin(((phase - 0.18) / 0.06) * Math.PI);
  }
  if (phase >= 0.24 && phase < 0.29) {
    return -0.28 * Math.sin(((phase - 0.24) / 0.05) * Math.PI);
  }
  if (phase >= 0.36 && phase < 0.54) {
    return 0.24 * Math.sin(((phase - 0.36) / 0.18) * Math.PI);
  }
  return 0;
}

export function WaveformCanvas({
  currentBpm,
  isStreaming,
  strokeHex,
  samples,
  maxHr,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    bpm: currentBpm ?? 0,
    hasSignal: currentBpm !== null && currentBpm > 0,
    isStreaming,
    strokeHex,
    phase: 0,
    sweepX: 0,
    points: [] as number[],
    lastFrameTime: 0,
  });

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    stateRef.current.bpm = currentBpm ?? 0;
    stateRef.current.hasSignal = currentBpm !== null && currentBpm > 0;
    stateRef.current.isStreaming = isStreaming;
    stateRef.current.strokeHex = strokeHex;
  }, [currentBpm, isStreaming, strokeHex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(200, Math.floor(rect.height));
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        stateRef.current.points = new Array(width).fill(height / 2);
        stateRef.current.sweepX = 0;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const drawGrid = (w: number, h: number) => {
      ctx.fillStyle = '#070A10';
      ctx.fillRect(0, 0, w, h);

      // Minor 20px clinical grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = 0; y <= h; y += 24) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();

      // Baseline centerline
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(h * 0.56) + 0.5);
      ctx.lineTo(w, Math.floor(h * 0.56) + 0.5);
      ctx.stroke();
    };

    const renderFrame = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(200, Math.floor(rect.height));
      const baseline = h * 0.56;
      const amplitude = h * 0.36;

      if (stateRef.current.points.length !== w) {
        stateRef.current.points = new Array(w).fill(baseline);
      }

      const dt = stateRef.current.lastFrameTime
        ? Math.min(0.05, (now - stateRef.current.lastFrameTime) / 1000)
        : 0.016;
      stateRef.current.lastFrameTime = now;

      const s = stateRef.current;

      if (s.isStreaming && !prefersReducedMotion) {
        const pxPerSec = 140;
        const stepPx = Math.max(1, Math.round(pxPerSec * dt));
        const beatsPerSec = s.hasSignal ? s.bpm / 60 : 0;

        for (let i = 0; i < stepPx; i++) {
          let y = baseline;
          if (s.hasSignal) {
            s.phase = (s.phase + (beatsPerSec * dt) / stepPx) % 1;
            y = baseline - ecgShape(s.phase) * amplitude;
          } else {
            s.phase = 0;
          }
          s.sweepX = (s.sweepX + 1) % w;
          s.points[s.sweepX] = y;
        }
      }

      drawGrid(w, h);

      if (!s.isStreaming) {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, baseline);
        ctx.lineTo(w, baseline);
        ctx.stroke();
      } else if (prefersReducedMotion) {
        // Static deterministic ECG trace when reduced motion is preferred
        ctx.strokeStyle = s.strokeHex;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < w; x++) {
          const p = ((x / 120) % 1);
          const y = baseline - ecgShape(p) * amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        const gapWidth = 18;
        ctx.strokeStyle = s.strokeHex;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Segment after sweep gap
        const startAfter = (s.sweepX + gapWidth) % w;
        if (startAfter > s.sweepX) {
          ctx.beginPath();
          for (let x = startAfter; x < w; x++) {
            const y = s.points[x];
            if (x === startAfter) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.beginPath();
          for (let x = 0; x <= s.sweepX; x++) {
            const y = s.points[x];
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else {
          ctx.beginPath();
          for (let x = startAfter; x <= s.sweepX; x++) {
            const y = s.points[x];
            if (x === startAfter) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Sweep head cursor dot
        const headY = s.points[s.sweepX] ?? baseline;
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(s.sweepX, headY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Build SVG history path for the last 60 samples
  const recent = samples.slice(-60);
  const svgWidth = 800;
  const svgHeight = 148;
  const padX = 36;
  const padY = 16;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  const yMin = 40;
  const yMax = Math.max(180, maxHr + 10);

  const pointsCoords = recent.map((s, idx) => {
    const x =
      recent.length <= 1
        ? padX + plotW
        : padX + (idx / (recent.length - 1)) * plotW;
    const clampedBpm = Math.max(yMin, Math.min(yMax, s.bpm));
    const y = padY + plotH - ((clampedBpm - yMin) / (yMax - yMin)) * plotH;
    return { x, y, sample: s };
  });

  const linePath =
    pointsCoords.length > 0
      ? pointsCoords
          .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
          .join(' ')
      : '';

  const hoveredPoint =
    hoveredIdx !== null && pointsCoords[hoveredIdx] ? pointsCoords[hoveredIdx] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Live Cardiac Oscilloscope */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Osciloscopio de pulso cardíaco
            </h2>
            <p className="text-xs text-slate-400">
              Trazo sincronizado al ritmo instantáneo recibido por GATT 0x2A37
            </p>
          </div>
          <div className="text-right font-mono text-xs tabular-nums text-slate-400">
            {isStreaming && currentBpm !== null ? (
              <span className="text-slate-200">
                Ciclo RR ≈ {Math.round(60000 / Math.max(30, currentBpm))} ms
              </span>
            ) : (
              <span>Sin señal activa</span>
            )}
          </div>
        </div>

        <div className="relative h-[210px] w-full">
          <canvas
            ref={canvasRef}
            data-testid="cardiac-waveform-canvas"
            aria-label="Trazado cardíaco en tiempo real"
            className="block h-full w-full"
          />
          {!isStreaming && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-lg border border-slate-800 bg-[#0B0F19]/90 px-4 py-2 text-xs text-slate-300">
                Conecta tu Samsung SM-R860 o inicia el flujo simulado para visualizar el pulso en tiempo real.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* BPM Time-Series Trend Chart */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Serie temporal de frecuencia cardíaca (últimas 60 muestras)
            </h2>
            <p className="text-xs text-slate-400">
              Pasa el cursor sobre la curva para inspeccionar BPM e intervalo RR exacto
            </p>
          </div>

          {hoveredPoint ? (
            <div className="font-mono text-xs tabular-nums text-slate-200">
              <span>{new Date(hoveredPoint.sample.timestampMs).toLocaleTimeString('es-ES')}</span>
              <span className="mx-2 text-slate-600" aria-hidden="true">·</span>
              <span className="font-semibold text-rose-400">{hoveredPoint.sample.bpm} BPM</span>
              {hoveredPoint.sample.rrIntervalsMs.length > 0 && (
                <>
                  <span className="mx-2 text-slate-600" aria-hidden="true">·</span>
                  <span className="text-cyan-400">
                    RR {hoveredPoint.sample.rrIntervalsMs[0]} ms
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="font-mono text-xs tabular-nums text-slate-400">
              Escala: {yMin}–{yMax} BPM
            </div>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="flex h-[148px] items-center justify-center rounded-lg border border-dashed border-slate-800 bg-[#070A10]/60 text-xs text-slate-500">
            Aún no hay muestras registradas en esta sesión.
          </div>
        ) : (
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="h-[148px] w-full cursor-crosshair select-none"
              role="img"
              aria-label="Gráfica de serie temporal BPM"
              onMouseLeave={() => setHoveredIdx(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
                let closestIdx = 0;
                let minDist = Infinity;
                pointsCoords.forEach((pt, idx) => {
                  const d = Math.abs(pt.x - relX);
                  if (d < minDist) {
                    minDist = d;
                    closestIdx = idx;
                  }
                });
                setHoveredIdx(closestIdx);
              }}
            >
              {[60, 100, 140, 180].map((tick) => {
                if (tick > yMax) return null;
                const ty = padY + plotH - ((tick - yMin) / (yMax - yMin)) * plotH;
                return (
                  <g key={tick}>
                    <line
                      x1={padX}
                      y1={ty}
                      x2={svgWidth - padX}
                      y2={ty}
                      stroke="#1E293B"
                      strokeDasharray="3 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padX - 6}
                      y={ty + 3}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              <path
                d={linePath}
                fill="none"
                stroke={strokeHex}
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {hoveredPoint && (
                <g>
                  <line
                    x1={hoveredPoint.x}
                    y1={padY}
                    x2={hoveredPoint.x}
                    y2={padY + plotH}
                    stroke="#64748B"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="4.5"
                    fill="#F8FAFC"
                    stroke={strokeHex}
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>
        )}
      </section>
    </div>
  );
}
