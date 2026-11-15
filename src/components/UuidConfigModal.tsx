import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { GattTargetConfig } from '../types/bluetooth';
import {
  STANDARD_GATT_UUIDS,
  formatShortUuidLabel,
  normalizeGattUuid,
} from '../utils/bleHeartRate';
import { STANDARD_BIOMETRIC_UUIDS } from '../utils/biometrics';

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
  const [bodyServiceInput, setBodyServiceInput] = useState(config.bodyCompServiceUuid);
  const [bodyCharInput, setBodyCharInput] = useState(config.bodyCompCharUuid);
  const [stressServiceInput, setStressServiceInput] = useState(config.stressServiceUuid);
  const [stressCharInput, setStressCharInput] = useState(config.stressCharUuid);
  const [prefixInput, setPrefixInput] = useState(config.deviceNamePrefix);
  const [maxHrInput, setMaxHrInput] = useState(String(config.maxHr));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServiceInput(config.serviceUuid);
      setCharInput(config.characteristicUuid);
      setBodyServiceInput(config.bodyCompServiceUuid);
      setBodyCharInput(config.bodyCompCharUuid);
      setStressServiceInput(config.stressServiceUuid);
      setStressCharInput(config.stressCharUuid);
      setPrefixInput(config.deviceNamePrefix);
      setMaxHrInput(String(config.maxHr));
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

    const normalizedBodyService = normalizeGattUuid(bodyServiceInput);
    if (!normalizedBodyService) {
      setErrorMsg('El UUID de servicio BIA no es válido (usa 0x181B o 128 bits).');
      return;
    }

    const normalizedBodyChar = normalizeGattUuid(bodyCharInput);
    if (!normalizedBodyChar) {
      setErrorMsg('El UUID de característica BIA no es válido (usa 0x2A9C o 128 bits).');
      return;
    }

    const normalizedStressService = normalizeGattUuid(stressServiceInput);
    if (!normalizedStressService) {
      setErrorMsg('El UUID de servicio de Estrés no es válido.');
      return;
    }

    const normalizedStressChar = normalizeGattUuid(stressCharInput);
    if (!normalizedStressChar) {
      setErrorMsg('El UUID de característica de Estrés no es válido.');
      return;
    }

    const parsedMaxHr = Number(maxHrInput);
    if (!Number.isFinite(parsedMaxHr) || parsedMaxHr < 100 || parsedMaxHr > 230) {
      setErrorMsg('La frecuencia cardíaca máxima debe estar entre 100 y 230 BPM.');
      return;
    }

    setErrorMsg(null);
    onSave({
      serviceUuid: normalizedService,
      characteristicUuid: normalizedChar,
      bodyCompServiceUuid: normalizedBodyService,
      bodyCompCharUuid: normalizedBodyChar,
      stressServiceUuid: normalizedStressService,
      stressCharUuid: normalizedStressChar,
      deviceNamePrefix: prefixInput.trim(),
      maxHr: Math.round(parsedMaxHr),
      manualBodyFatPercent: config.manualBodyFatPercent,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setServiceInput(STANDARD_GATT_UUIDS.HEART_RATE_SERVICE);
    setCharInput(STANDARD_GATT_UUIDS.HEART_RATE_MEASUREMENT_CHAR);
    setBodyServiceInput(STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_SERVICE);
    setBodyCharInput(STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_MEASUREMENT_CHAR);
    setStressServiceInput(STANDARD_BIOMETRIC_UUIDS.CUSTOM_STRESS_SERVICE);
    setStressCharInput(STANDARD_BIOMETRIC_UUIDS.CUSTOM_STRESS_CHAR);
    setPrefixInput('');
    setMaxHrInput('190');
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
              Parámetros GATT y Calibración Cardíaca
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Configura UUIDs para Ritmo Cardíaco, Grasa Corporal (BIA) y Estrés, además de tu FC máxima.
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

            <div>
              <label
                htmlFor="gatt-bcs-service-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Servicio BIA / Grasa ({formatShortUuidLabel(STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_SERVICE)})
              </label>
              <input
                id="gatt-bcs-service-uuid"
                type="text"
                value={bodyServiceInput}
                onChange={(e) => setBodyServiceInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="gatt-bcs-char-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Característica BIA ({formatShortUuidLabel(STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_MEASUREMENT_CHAR)})
              </label>
              <input
                id="gatt-bcs-char-uuid"
                type="text"
                value={bodyCharInput}
                onChange={(e) => setBodyCharInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="gatt-stress-service-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Servicio Estrés (Opcional)
              </label>
              <input
                id="gatt-stress-service-uuid"
                type="text"
                value={stressServiceInput}
                onChange={(e) => setStressServiceInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="gatt-stress-char-uuid"
                className="mb-1.5 block text-xs font-medium text-slate-300"
              >
                Característica Estrés (Opcional)
              </label>
              <input
                id="gatt-stress-char-uuid"
                type="text"
                value={stressCharInput}
                onChange={(e) => setStressCharInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#070A10] px-3 py-2 font-mono text-xs text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
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
