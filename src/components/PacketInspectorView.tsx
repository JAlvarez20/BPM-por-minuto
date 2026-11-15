import { Download, Trash2 } from 'lucide-react';
import type { BodyCompositionReading, HeartRateSample } from '../types/bluetooth';

interface PacketInspectorViewProps {
  samples: HeartRateSample[];
  bodyComp: BodyCompositionReading | null;
  onExportCsv: () => void;
  onClearSession: () => void;
}

export function PacketInspectorView({
  samples,
  bodyComp,
  onExportCsv,
  onClearSession,
}: PacketInspectorViewProps) {
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;
  const recentRows = [...samples].reverse().slice(0, 80);

  const flags = latest ? latest.flagsByte : 0;
  const bit0 = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;
  const bit3 = (flags & 0x08) !== 0;
  const bit4 = (flags & 0x10) !== 0;

  return (
    <div className="space-y-6">
      {/* Live Hex & Flags Decoder */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-50">
              Inspector de tramas BLE (0x2A37 · 0x2A9C) y registro de sesión
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Decodificación byte a byte de las notificaciones GATT entrantes de ritmo cardíaco, estrés y grasa corporal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExportCsv}
              disabled={samples.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exportar CSV ({samples.length})</span>
            </button>
            <button
              type="button"
              onClick={onClearSession}
              disabled={samples.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpiar registro</span>
            </button>
          </div>
        </div>

        {!latest ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-800 bg-[#070A10] px-4 py-8 text-center text-xs text-slate-400">
            No se ha recibido ninguna trama BLE aún. Conecta tu SM-R860 o inicia el flujo simulado para inspeccionar bytes en vivo.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 border-t border-slate-800/80 pt-5 lg:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-slate-400">Última trama 0x2A37 (Hexadecimal)</span>
              <div
                data-testid="latest-hex-frame"
                className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm"
              >
                {latest.rawBytes.map((b, idx) => (
                  <span
                    key={`${idx}-${b}`}
                    className={`rounded-md border px-2.5 py-1.5 tabular-nums ${
                      idx === 0
                        ? 'border-amber-500/40 bg-amber-950/30 text-amber-300'
                        : idx === 1
                        ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                        : 'border-slate-700 bg-[#070A10] text-cyan-300'
                    }`}
                  >
                    {b.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Byte 0 = Flags (0x{latest.flagsByte.toString(16).toUpperCase().padStart(2, '0')}) ·
                Byte 1 = BPM ({latest.bpm}) · Resto = Energía / Intervalos RR
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-400">Bit 0 · Formato BPM</dt>
                <dd className="mt-0.5 font-mono text-slate-100">
                  {bit0 ? '1 (UINT16)' : '0 (UINT8)'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Bits 1–2 · Contacto piel</dt>
                <dd className="mt-0.5 font-mono text-slate-100">
                  {contactBits} ({latest.sensorContact === 'contact' ? 'Detectado' : latest.sensorContact === 'no-contact' ? 'Sin contacto' : 'No soportado'})
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Bit 3 · Energía kJ</dt>
                <dd className="mt-0.5 font-mono text-slate-100">
                  {bit3 ? `Presente (${latest.energyExpendedKj ?? 0} kJ)` : 'No presente'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Bit 4 · Intervalos RR</dt>
                <dd className="mt-0.5 font-mono text-slate-100">
                  {bit4 ? `${latest.rrIntervalsMs.join(', ')} ms` : 'No presente'}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {bodyComp && (
          <div className="mt-5 border-t border-slate-800/80 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-300">
                Última trama BIA / Grasa corporal ({bodyComp.source})
              </span>
              <span className="font-mono text-slate-400">
                Grasa {bodyComp.bodyFatPercent ?? '--'}% · Músculo {bodyComp.musclePercent ?? '--'}% · Impedancia {bodyComp.impedanceOhm ?? '--'} Ω
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-cyan-300">{bodyComp.rawHex}</p>
          </div>
        )}
      </section>

      {/* Session Sample Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] overflow-hidden">
        <div className="border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Historial reciente (últimas {recentRows.length} lecturas)
          </h2>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            Total sesión: {samples.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-[#070A10] text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium text-right">BPM</th>
                <th className="px-4 py-3 font-medium">Zona</th>
                <th className="px-4 py-3 font-medium text-right">Estrés</th>
                <th className="px-4 py-3 font-medium text-right">RR (ms)</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-6 py-3 font-medium">Trama Hex</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {recentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Sin lecturas registradas todavía.
                  </td>
                </tr>
              ) : (
                recentRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/20">
                    <td className="px-6 py-2.5 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {new Date(row.timestampMs).toLocaleTimeString('es-ES')}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold tabular-nums text-right text-rose-400 whitespace-nowrap">
                      {row.bpm}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">
                      {row.zoneLabel}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-right text-amber-300 whitespace-nowrap">
                      {row.stressScore !== null ? `${row.stressScore}/100` : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-right text-cyan-300 whitespace-nowrap">
                      {row.rrIntervalsMs.length > 0 ? row.rrIntervalsMs.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                      {row.sensorContact === 'contact'
                        ? 'Detectado'
                        : row.sensorContact === 'no-contact'
                        ? 'Sin contacto'
                        : 'N/D'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {row.source === 'ble' ? 'BLE SM-R860' : 'Simulación'}
                    </td>
                    <td className="px-6 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {row.rawHex}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
