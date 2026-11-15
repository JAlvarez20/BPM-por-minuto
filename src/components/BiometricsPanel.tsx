import { Activity } from 'lucide-react';
import type { HrvMetrics, StressReading } from '../types/bluetooth';

interface BiometricsPanelProps {
  stressReading: StressReading | null;
  hrvMetrics: HrvMetrics;
}

export function BiometricsPanel({ stressReading, hrvMetrics }: BiometricsPanelProps) {
  const stressSourceLabel = !stressReading
    ? 'Esperando lectura RR / Estrés'
    : stressReading.source === 'ble-direct'
    ? 'Sensor directo BLE GATT'
    : 'Calculado vía HRV RR (0x2A37)';

  const stressPct = stressReading ? Math.max(0, Math.min(100, stressReading.score)) : 0;

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Stress Level (HRV / Direct GATT) Card */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Nivel de Estrés en tiempo real
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{stressSourceLabel}</p>
            </div>
            <Activity className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span
              data-testid="live-stress-value"
              className="font-mono text-4xl font-bold tracking-tight tabular-nums text-slate-50"
            >
              {stressReading ? stressReading.score : '--'}
            </span>
            <span className="font-mono text-xs text-slate-400">/ 100</span>
            {stressReading && (
              <span className={`ml-auto text-xs font-semibold ${stressReading.colorClass}`}>
                Nivel {stressReading.category}
              </span>
            )}
          </div>

          {/* Calibrated 0-100 Stress Bar */}
          <div className="mt-3.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#070A10] border border-slate-800">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${stressPct}%`,
                  backgroundColor: stressReading?.barHex ?? '#475569',
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
              <span>0 Bajo</span>
              <span>25</span>
              <span>50 Moderado</span>
              <span>75 Elevado</span>
              <span>100 Alto</span>
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800/80 pt-3.5 text-xs">
          <div>
            <dt className="text-slate-400">RMSSD</dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums text-cyan-300">
              {hrvMetrics.rmssdMs !== null ? `${hrvMetrics.rmssdMs} ms` : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">SDNN</dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-100">
              {hrvMetrics.sdnnMs !== null ? `${hrvMetrics.sdnnMs} ms` : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">RR medio</dt>
            <dd className="mt-0.5 font-mono font-semibold tabular-nums text-slate-100">
              {hrvMetrics.meanRrMs !== null ? `${hrvMetrics.meanRrMs} ms` : '--'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
