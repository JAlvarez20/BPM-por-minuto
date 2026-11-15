import { useEffect, useState } from 'react';
import { Settings2, UserRound } from 'lucide-react';

interface BiometricsPanelProps {
  userHeightCm: number;
  userWeightKg: number;
  manualBodyFatPercent: number | null;
  onUpdateAnthropometrics: (next: {
    weightKg: number;
    heightCm: number;
    bodyFatPercent: number | null;
  }) => void;
  onOpenCalibration: () => void;
}

export function BiometricsPanel({
  userHeightCm,
  userWeightKg,
  manualBodyFatPercent,
  onUpdateAnthropometrics,
  onOpenCalibration,
}: BiometricsPanelProps) {
  const [weightDraft, setWeightDraft] = useState(String(userWeightKg));
  const [heightDraft, setHeightDraft] = useState(String(userHeightCm));
  const [bodyFatDraft, setBodyFatDraft] = useState(
    manualBodyFatPercent !== null ? String(manualBodyFatPercent) : ''
  );

  useEffect(() => {
    setWeightDraft(String(userWeightKg));
  }, [userWeightKg]);

  useEffect(() => {
    setHeightDraft(String(userHeightCm));
  }, [userHeightCm]);

  useEffect(() => {
    setBodyFatDraft(manualBodyFatPercent !== null ? String(manualBodyFatPercent) : '');
  }, [manualBodyFatPercent]);

  const handleWeightChange = (val: string) => {
    setWeightDraft(val);
    const num = Number(val);
    if (val.trim() !== '' && Number.isFinite(num) && num >= 25 && num <= 250) {
      onUpdateAnthropometrics({
        weightKg: Math.round(num * 10) / 10,
        heightCm: userHeightCm,
        bodyFatPercent: manualBodyFatPercent,
      });
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightDraft(val);
    const num = Number(val);
    if (val.trim() !== '' && Number.isFinite(num) && num >= 100 && num <= 240) {
      onUpdateAnthropometrics({
        weightKg: userWeightKg,
        heightCm: Math.round(num * 10) / 10,
        bodyFatPercent: manualBodyFatPercent,
      });
    }
  };

  const handleBodyFatChange = (val: string) => {
    setBodyFatDraft(val);
    if (val.trim() === '') {
      onUpdateAnthropometrics({
        weightKg: userWeightKg,
        heightCm: userHeightCm,
        bodyFatPercent: null,
      });
      return;
    }
    const num = Number(val);
    if (Number.isFinite(num) && num >= 2 && num <= 70) {
      onUpdateAnthropometrics({
        weightKg: userWeightKg,
        heightCm: userHeightCm,
        bodyFatPercent: Math.round(num * 10) / 10,
      });
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-100">
              Datos antropométricos previos al testeo (Exportación CSV)
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Introduce peso, altura y % de grasa corporal antes de iniciar para incluirlos junto al ritmo cardíaco en el CSV.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCalibration}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Configurar GATT</span>
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="pretest-weight-input"
            className="mb-1.5 block text-xs font-medium text-slate-300"
          >
            Peso (kg)
          </label>
          <input
            id="pretest-weight-input"
            type="number"
            min={25}
            max={250}
            step="0.1"
            value={weightDraft}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="pretest-height-input"
            className="mb-1.5 block text-xs font-medium text-slate-300"
          >
            Altura (cm)
          </label>
          <input
            id="pretest-height-input"
            type="number"
            min={100}
            max={240}
            step="0.5"
            value={heightDraft}
            onChange={(e) => handleHeightChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="pretest-bodyfat-input"
            className="mb-1.5 block text-xs font-medium text-slate-300"
          >
            Índice de grasa corporal (% opc.)
          </label>
          <input
            id="pretest-bodyfat-input"
            type="number"
            min={2}
            max={70}
            step="0.1"
            placeholder="Ej. 19.5"
            value={bodyFatDraft}
            onChange={(e) => handleBodyFatChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>
    </section>
  );
}
