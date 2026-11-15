import { Activity, BluetoothSearching, Download, Play, RefreshCw, Settings2, Square, Trash2 } from 'lucide-react';
import type {
  CardiacZoneInfo,
  ConnectedDeviceMetadata,
  ConnectionMode,
  GattTargetConfig,
  HrvMetrics,
  SessionStats,
  SimulationPreset,
} from '../types/bluetooth';
import {
  SIMULATION_PRESET_TARGETS,
  formatDurationClock,
  formatShortUuidLabel,
} from '../utils/bleHeartRate';

interface DeviceControlPanelProps {
  connectionMode: ConnectionMode;
  currentBpm: number | null;
  latestContact: string;
  latestEnergyKj: number | null;
  zoneInfo: CardiacZoneInfo | null;
  hrvMetrics: HrvMetrics;
  sessionStats: SessionStats;
  deviceMeta: ConnectedDeviceMetadata | null;
  blePacketCount: number;
  gattConfig: GattTargetConfig;
  simulationPreset: SimulationPreset;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onScanAllBleDevices: () => void;
  onResubscribeBle: () => void;
  onManualReadBle: () => void;
  onChangeSimulationPreset: (preset: SimulationPreset) => void;
  onOpenUuidModal: () => void;
  onExportCsv: () => void;
  onClearSession: () => void;
  onOpenConnectionGuide: () => void;
}

export function DeviceControlPanel({
  connectionMode,
  currentBpm,
  latestContact,
  latestEnergyKj,
  zoneInfo,
  hrvMetrics,
  sessionStats,
  deviceMeta,
  blePacketCount,
  gattConfig,
  simulationPreset,
  onStartSimulation,
  onStopSimulation,
  onScanAllBleDevices,
  onResubscribeBle,
  onManualReadBle,
  onChangeSimulationPreset,
  onOpenUuidModal,
  onExportCsv,
  onClearSession,
  onOpenConnectionGuide,
}: DeviceControlPanelProps) {
  const isSimulated = connectionMode === 'simulated';
  const isBleLive = connectionMode === 'ble-live';

  const statusText = isBleLive
    ? '● Conectado vía Bluetooth'
    : isSimulated
    ? '● Flujo simulado SM-R860'
    : connectionMode === 'connecting'
    ? '◐ Esperando emparejamiento'
    : connectionMode === 'error'
    ? '✖ Error Bluetooth'
    : '○ Sin conexión activa';

  const statusColorClass = isBleLive
    ? 'text-emerald-400'
    : isSimulated
    ? 'text-cyan-400'
    : connectionMode === 'error'
    ? 'text-rose-400'
    : 'text-slate-400';

  return (
    <aside className="flex w-full flex-col rounded-xl border border-slate-800 bg-[#0B0F19] lg:w-[360px] shrink-0">
      {/* Live BPM Hero Readout */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${statusColorClass}`}>
            {statusText}
          </span>
          {deviceMeta?.batteryLevel !== null && deviceMeta?.batteryLevel !== undefined && (
            <span className="font-mono text-xs tabular-nums text-slate-400">
              Batería {deviceMeta.batteryLevel}%
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-2.5">
          <span
            data-testid="live-bpm-value"
            className="font-mono text-6xl font-bold tracking-tight tabular-nums text-slate-50"
          >
            {currentBpm !== null ? currentBpm : '--'}
          </span>
          <span className="font-mono text-sm font-medium uppercase tracking-wider text-slate-400">
            BPM
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {zoneInfo ? (
            <span className={`font-medium ${zoneInfo.colorClass}`}>
              {zoneInfo.name} ({zoneInfo.percentOfMax}%)
            </span>
          ) : (
            <span className="text-slate-500">Zona cardíaca en espera</span>
          )}
          <span className="text-slate-700" aria-hidden="true">·</span>
          <span className="text-slate-400">{latestContact}</span>
        </div>
      </div>

      {/* Simulation & Calibration Controls */}
      <div className="border-t border-slate-800/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fuente de telemetría
          </h2>
          <button
            type="button"
            onClick={onOpenUuidModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Configurar UUID</span>
          </button>
        </div>

        {!isBleLive && (
          <div className="space-y-3">
            {isSimulated ? (
              <button
                type="button"
                onClick={onStopSimulation}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Detener flujo simulado</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartSimulation}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#121826] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:border-cyan-500/60 hover:text-cyan-200 transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Probar flujo simulado SM-R860</span>
              </button>
            )}

            <button
              type="button"
              onClick={onScanAllBleDevices}
              disabled={connectionMode === 'connecting'}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-[#070A10] px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <BluetoothSearching className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span>Escanear todos los BLE (sin filtro)</span>
            </button>

            <div>
              <span className="mb-1.5 block text-xs text-slate-400">
                Perfil de intensidad (simulación 0x2A37)
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#070A10] p-1 border border-slate-800/80">
                {(Object.keys(SIMULATION_PRESET_TARGETS) as SimulationPreset[]).map(
                  (presetKey) => {
                    const active = simulationPreset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => onChangeSimulationPreset(presetKey)}
                        className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-slate-800 text-slate-50'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {SIMULATION_PRESET_TARGETS[presetKey].label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}

        {isBleLive && deviceMeta && (
          <div className="space-y-3 text-xs text-slate-300">
            <div className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Dispositivo</span>
                <span className="truncate font-medium text-slate-100">{deviceMeta.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Tramas 0x2A37</span>
                <span className="font-mono tabular-nums text-slate-100">
                  {blePacketCount} recibidas
                </span>
              </div>
              {deviceMeta.hrCharProperties.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Modo GATT</span>
                  <span className="font-mono text-[11px] text-cyan-300">
                    {deviceMeta.hrCharProperties.join(', ')}
                  </span>
                </div>
              )}
              {deviceMeta.discoveredServices.length > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Servicios</span>
                  <span className="truncate font-mono text-[11px] text-slate-300">
                    {deviceMeta.discoveredServices.join(', ')}
                  </span>
                </div>
              )}
              {deviceMeta.bodySensorLocation && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Ubicación sensor</span>
                  <span>{deviceMeta.bodySensorLocation}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onResubscribeBle}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#070A10] px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span>Re-suscribir</span>
              </button>
              <button
                type="button"
                onClick={onManualReadBle}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#070A10] px-2.5 py-2 text-[11px] font-medium text-slate-200 hover:border-rose-500/50 hover:text-rose-200 cursor-pointer whitespace-nowrap"
              >
                <Activity className="h-3 w-3" aria-hidden="true" />
                <span>Leer 0x2A37</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session & HRV Telemetry Grid */}
      <div className="border-t border-slate-800/80 p-5">
        <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-slate-400">
          Estadísticas y variabilidad (HRV)
        </h2>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <dt className="text-xs text-slate-400">Mínimo / Máximo</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-100">
              {sessionStats.minBpm !== null ? `${sessionStats.minBpm} / ${sessionStats.maxBpm}` : '-- / --'}
              <span className="ml-1 text-[11px] font-normal text-slate-500">BPM</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-400">Promedio sesión</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-100">
              {sessionStats.avgBpm !== null ? sessionStats.avgBpm : '--'}
              <span className="ml-1 text-[11px] font-normal text-slate-500">BPM</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-400">HRV RMSSD</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-cyan-300">
              {hrvMetrics.rmssdMs !== null ? hrvMetrics.rmssdMs : '--'}
              <span className="ml-1 text-[11px] font-normal text-slate-500">ms</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-400">HRV SDNN</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums text-slate-100">
              {hrvMetrics.sdnnMs !== null ? hrvMetrics.sdnnMs : '--'}
              <span className="ml-1 text-[11px] font-normal text-slate-500">ms</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-400">Duración · Muestras</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-slate-200">
              {formatDurationClock(sessionStats.durationSec)}
              <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
              <span data-testid="sample-count">{sessionStats.totalSamples}</span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-slate-400">Energía acumulada</dt>
            <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums text-slate-200">
              {latestEnergyKj !== null ? `${latestEnergyKj} kJ` : '--'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={sessionStats.totalSamples === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={onClearSession}
            disabled={sessionStats.totalSamples === 0}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Active GATT Target Summary */}
      <div className="border-t border-slate-800/80 px-5 py-4 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-300">Objetivo GATT BLE</span>
          <button
            type="button"
            onClick={onOpenConnectionGuide}
            className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 cursor-pointer whitespace-nowrap"
          >
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ver datos SM-R860</span>
          </button>
        </div>
        <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
          <div className="flex justify-between gap-2">
            <span>Service</span>
            <span className="truncate text-slate-200">
              {formatShortUuidLabel(gattConfig.serviceUuid)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Measurement</span>
            <span className="truncate text-slate-200">
              {formatShortUuidLabel(gattConfig.characteristicUuid)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
