import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { GattTargetConfig } from '../types/bluetooth';
import {
  STANDARD_GATT_UUIDS,
  formatShortUuidLabel,
  normalizeGattUuid,
} from '../utils/bleHeartRate';

interface UuidConfigModalProps {
  isOpen: boolean;
  config: GattTargetConfig;
  onClose: () => void;
  onSave: (nextConfig: GattTargetConfig) => void;
}

export function UuidConfigModal({
  isOpen,
  config,
  onClose,
  onSave,
}: UuidConfigModalProps) {
  const [serviceInput, setServiceInput] = useState(config.serviceUuid);
  const [charInput, setCharInput] = useState(config.characteristicUuid);
  const [prefixInput, setPrefixInput] = useState(config.deviceNamePrefix);
  const [maxHrInput, setMaxHrInput] = useState(String(config.maxHr));
  const [heightInput, setHeightInput] = useState(String(config.userHeightCm));
  const [weightInput, setWeightInput] = useState(String(config.userWeightKg));
  const [bodyFatInput, setBodyFatInput] = useState(
    config.manualBodyFatPercent !== null ? String(config.manualBodyFatPercent) : ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServiceInput(config.serviceUuid);
      setCharInput(config.characteristicUuid);
      setPrefixInput(config.deviceNamePrefix);
      setMaxHrInput(String(config.maxHr));
      setHeightInput(String(config.userHeightCm));
      setWeightInput(String(config.userWeightKg));
      setBodyFatInput(
        config.manualBodyFatPercent !== null ? String(config.manualBodyFatPercent) : ''
      );
      setErrorMsg(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedService = normalizeGattUuid(serviceInput);
    if (!normalizedService) {
      setErrorMsg('El UUID de servicio HR no es válido (usa 0x180D o 128 bits).');
      return;
    }

    const normalizedChar = normalizeGattUuid(charInput);
    if (!normalizedChar) {
      setErrorMsg('El UUID de característica HR no es válido (usa 0x2A37 o 128 bits).');
      return;
    }

    const parsedMaxHr = Number(maxHrInput);
    if (!Number.isFinite(parsedMaxHr) || parsedMaxHr < 100 || parsedMaxHr > 230) {
      setErrorMsg('La frecuencia cardíaca máxima debe estar entre 100 y 230 BPM.');
      return;
    }

    const parsedHeight = Number(heightInput);
    if (!Number.isFinite(parsedHeight) || parsedHeight < 100 || parsedHeight > 240) {
      setErrorMsg('La altura debe estar entre 100 y 240 cm.');
      return;
    }

    const parsedWeight = Number(weightInput);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 25 || parsedWeight > 250) {
      setErrorMsg('El peso debe estar entre 25 y 250 kg.');
      return;
    }

    let parsedBodyFat: number | null = null;
    if (bodyFatInput.trim() !== '') {
      const bf = Number(bodyFatInput);
      if (!Number.isFinite(bf) || bf < 2 || bf > 70) {
        setErrorMsg('El índice de grasa corporal debe estar entre 2% y 70%.');
        return;
      }
      parsedBodyFat = Math.round(bf * 10) / 10;
    }

    setErrorMsg(null);
    onSave({
      serviceUuid: normalizedService,
      characteristicUuid: normalizedChar,
      deviceNamePrefix: prefixInput.trim(),
      maxHr: Math.round(parsedMaxHr),
      userHeightCm: Math.round(parsedHeight * 10) / 10,
      userWeightKg: Math.round(parsedWeight * 10) / 10,
      manualBodyFatPercent: parsedBodyFat,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setServiceInput(STANDARD_GATT_UUIDS.HEART_RATE_SERVICE);
    setCharInput(STANDARD_GATT_UUIDS.HEART_RATE_MEASUREMENT_CHAR);
    setPrefixInput('');
    setMaxHrInput('190');
    setHeightInput('172');
    setWeightInput('70');
    setBodyFatInput('');
    setErrorMsg(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="uuid-modal-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-800 bg-[#0D121C] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="uuid-modal-title" className="font-display text-lg font-semibold text-slate-50">
              Parámetros GATT y Perfil del Sujeto
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Configura el objetivo BLE de ritmo cardíaco (0x180D / 0x2A37) y los datos base para exportación CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="gatt-service-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Servicio HR ({formatShortUuidLabel(STANDARD_GATT_UUIDS.HEART_RATE_SERVICE)})
              </label>
              <input
                id="gatt-service-uuid"
                type="text"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="gatt-char-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Característica HR ({formatShortUuidLabel(STANDARD_GATT_UUIDS.HEART_RATE_MEASUREMENT_CHAR)})
              </label>
              <input
                id="gatt-char-uuid"
                type="text"
                value={charInput}
                onChange={(e) => setCharInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="device-prefix-input"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Filtro nombre BLE (opcional)
              </label>
              <input
                id="device-prefix-input"
                type="text"
                value={prefixInput}
                onChange={(e) => setPrefixInput(e.target.value)}
                placeholder="Ej. Galaxy Watch4"
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="max-hr-input"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                FC Máx (BPM)
              </label>
              <input
                id="max-hr-input"
                type="number"
                min={100}
                max={230}
                value={maxHrInput}
                onChange={(e) => setMaxHrInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="weight-kg-input"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Peso (kg)
              </label>
              <input
                id="weight-kg-input"
                type="number"
                min={25}
                max={250}
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="height-cm-input"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Altura (cm)
              </label>
              <input
                id="height-cm-input"
                type="number"
                min={100}
                max={240}
                step="0.5"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="bodyfat-pct-input"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Grasa corporal (% opc.)
              </label>
              <input
                id="bodyfat-pct-input"
                type="number"
                min={2}
                max={70}
                step="0.1"
                placeholder="Ej. 19.5"
                value={bodyFatInput}
                onChange={(e) => setBodyFatInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs tabular-nums text-slate-100 placeholder:text-slate-600 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restaurar estándar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 cursor-pointer"
              >
                Guardar parámetros
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
