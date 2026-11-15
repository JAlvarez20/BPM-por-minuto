import type {
  CardiacZoneInfo,
  CsvBiometricProfile,
  HrvMetrics,
  HeartRateSample,
  ParsedHeartRatePacket,
  SensorContactState,
  SessionStats,
  SimulationPreset,
  WebBluetoothCharacteristicProperties,
} from '../types/bluetooth';

export const STANDARD_GATT_UUIDS = {
  HEART_RATE_SERVICE: '0000180d-0000-1000-8000-00805f9b34fb',
  HEART_RATE_MEASUREMENT_CHAR: '00002a37-0000-1000-8000-00805f9b34fb',
  BODY_SENSOR_LOCATION_CHAR: '00002a38-0000-1000-8000-00805f9b34fb',
  HEART_RATE_CONTROL_POINT_CHAR: '00002a39-0000-1000-8000-00805f9b34fb',
  CCCD_DESCRIPTOR: '00002902-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL_CHAR: '00002a19-0000-1000-8000-00805f9b34fb',
  DEVICE_INFO_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER_CHAR: '00002a24-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME_CHAR: '00002a29-0000-1000-8000-00805f9b34fb',
} as const;

const FULL_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHORT_HEX_REGEX = /^(?:0x)?([0-9a-f]{4}|[0-9a-f]{8})$/;

export function normalizeGattUuid(input: string): string | null {
  const cleaned = input.trim().toLowerCase();
  if (!cleaned) return null;

  if (FULL_UUID_REGEX.test(cleaned)) {
    return cleaned;
  }

  const shortMatch = cleaned.match(SHORT_HEX_REGEX);
  if (shortMatch) {
    const hexPadded = shortMatch[1].padStart(8, '0');
    return `${hexPadded}-0000-1000-8000-00805f9b34fb`;
  }

  return null;
}

export function formatShortUuidLabel(uuid: string): string {
  const normalized = normalizeGattUuid(uuid);
  if (!normalized) return uuid;
  if (normalized.endsWith('-0000-1000-8000-00805f9b34fb') && normalized.startsWith('0000')) {
    return `0x${normalized.slice(4, 8).toUpperCase()}`;
  }
  return normalized;
}

export function extractCharacteristicProperties(
  props?: WebBluetoothCharacteristicProperties
): string[] {
  if (!props) return [];
  const active: string[] = [];
  if (props.notify) active.push('notify');
  if (props.indicate) active.push('indicate');
  if (props.read) active.push('read');
  if (props.write) active.push('write');
  if (props.writeWithoutResponse) active.push('writeWithoutResponse');
  if (props.broadcast) active.push('broadcast');
  return active;
}

export function decodeBodySensorLocation(code: number): string {
  switch (code) {
    case 0:
      return 'Otro';
    case 1:
      return 'Pecho';
    case 2:
      return 'Muñeca (Wrist)';
    case 3:
      return 'Dedo';
    case 4:
      return 'Mano';
    case 5:
      return 'Lóbulo de oreja';
    case 6:
      return 'Pie';
    default:
      return `Desconocido (0x${code.toString(16).toUpperCase()})`;
  }
}

export function parseHeartRateMeasurement(
  dataView: DataView,
  timestampMs = Date.now()
): ParsedHeartRatePacket {
  if (dataView.byteLength < 2) {
    throw new Error('Trama BLE 0x2A37 inválida: se requieren al menos 2 bytes.');
  }

  const rawBytes: number[] = [];
  for (let i = 0; i < dataView.byteLength; i++) {
    rawBytes.push(dataView.getUint8(i));
  }
  const rawHex = rawBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  const flags = dataView.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;

  let sensorContact: SensorContactState = 'not-supported';
  if (contactBits === 2) {
    sensorContact = 'no-contact';
  } else if (contactBits === 3) {
    sensorContact = 'contact';
  }

  const hasEnergyExpended = (flags & 0x08) !== 0;
  const hasRrIntervals = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm = 0;
  if (isUint16) {
    if (offset + 2 > dataView.byteLength) {
      throw new Error('Trama BLE 0x2A37 truncada al leer BPM UINT16.');
    }
    bpm = dataView.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = dataView.getUint8(offset);
    offset += 1;
  }

  let energyExpendedKj: number | null = null;
  if (hasEnergyExpended && offset + 2 <= dataView.byteLength) {
    energyExpendedKj = dataView.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (hasRrIntervals) {
    while (offset + 2 <= dataView.byteLength) {
      const rawRr = dataView.getUint16(offset, true);
      const ms = Math.round(((rawRr * 1000) / 1024) * 10) / 10;
      rrIntervalsMs.push(ms);
      offset += 2;
    }
  }

  return {
    timestampMs,
    bpm,
    format: isUint16 ? 'uint16' : 'uint8',
    sensorContact,
    energyExpendedKj,
    rrIntervalsMs,
    flagsByte: flags,
    rawHex,
    rawBytes,
  };
}

export function encodeHeartRateMeasurement(
  bpm: number,
  rrIntervalsMs: number[] = [],
  sensorContact = true,
  energyExpendedKj: number | null = null
): DataView {
  const clampedBpm = Math.max(0, Math.min(65535, Math.round(bpm)));
  const useUint16 = clampedBpm > 255;

  let flags = 0;
  if (useUint16) flags |= 0x01;
  // Sensor contact supported + contact status
  flags |= sensorContact ? 0x06 : 0x04;
  if (energyExpendedKj !== null) flags |= 0x08;
  if (rrIntervalsMs.length > 0) flags |= 0x10;

  const byteLength =
    1 +
    (useUint16 ? 2 : 1) +
    (energyExpendedKj !== null ? 2 : 0) +
    rrIntervalsMs.length * 2;

  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  let offset = 0;
  view.setUint8(offset, flags);
  offset += 1;

  if (useUint16) {
    view.setUint16(offset, clampedBpm, true);
    offset += 2;
  } else {
    view.setUint8(offset, clampedBpm);
    offset += 1;
  }

  if (energyExpendedKj !== null) {
    view.setUint16(offset, Math.max(0, Math.min(65535, Math.round(energyExpendedKj))), true);
    offset += 2;
  }

  for (const rrMs of rrIntervalsMs) {
    const rawRr = Math.max(1, Math.min(65535, Math.round((rrMs * 1024) / 1000)));
    view.setUint16(offset, rawRr, true);
    offset += 2;
  }

  return view;
}

export function computeHrvMetrics(rrIntervalsMs: number[]): HrvMetrics {
  const valid = rrIntervalsMs.filter((v) => Number.isFinite(v) && v >= 250 && v <= 2500);
  if (valid.length === 0) {
    return {
      rmssdMs: null,
      sdnnMs: null,
      pnn50Percent: null,
      meanRrMs: null,
      sampleCount: 0,
    };
  }

  const meanRrMs = valid.reduce((acc, v) => acc + v, 0) / valid.length;

  if (valid.length < 2) {
    return {
      rmssdMs: null,
      sdnnMs: null,
      pnn50Percent: null,
      meanRrMs: Math.round(meanRrMs * 10) / 10,
      sampleCount: valid.length,
    };
  }

  const variance =
    valid.reduce((acc, v) => acc + (v - meanRrMs) ** 2, 0) / (valid.length - 1);
  const sdnnMs = Math.sqrt(variance);

  let sumSqDiff = 0;
  let nn50Count = 0;
  const diffCount = valid.length - 1;

  for (let i = 1; i < valid.length; i++) {
    const diff = valid[i] - valid[i - 1];
    sumSqDiff += diff * diff;
    if (Math.abs(diff) > 50) {
      nn50Count += 1;
    }
  }

  const rmssdMs = Math.sqrt(sumSqDiff / diffCount);
  const pnn50Percent = (nn50Count / diffCount) * 100;

  return {
    rmssdMs: Math.round(rmssdMs * 10) / 10,
    sdnnMs: Math.round(sdnnMs * 10) / 10,
    pnn50Percent: Math.round(pnn50Percent * 10) / 10,
    meanRrMs: Math.round(meanRrMs * 10) / 10,
    sampleCount: valid.length,
  };
}

export function computeCardiacZone(bpm: number, maxHr = 190): CardiacZoneInfo {
  const safeMax = Math.max(100, maxHr);
  const pct = Math.round((bpm / safeMax) * 100);

  if (pct < 60) {
    return {
      index: 1,
      name: 'Zona 1 · Recuperación',
      shortName: 'Z1 Recup.',
      percentOfMax: pct,
      rangeLabel: `< ${Math.round(safeMax * 0.6)} BPM`,
      colorClass: 'text-cyan-400',
      strokeHex: '#22D3EE',
    };
  }
  if (pct < 70) {
    return {
      index: 2,
      name: 'Zona 2 · Base Aeróbica',
      shortName: 'Z2 Base',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.6)}–${Math.round(safeMax * 0.7)} BPM`,
      colorClass: 'text-emerald-400',
      strokeHex: '#34D399',
    };
  }
  if (pct < 80) {
    return {
      index: 3,
      name: 'Zona 3 · Tempo Aeróbico',
      shortName: 'Z3 Tempo',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.7)}–${Math.round(safeMax * 0.8)} BPM`,
      colorClass: 'text-amber-400',
      strokeHex: '#FBBF24',
    };
  }
  if (pct < 90) {
    return {
      index: 4,
      name: 'Zona 4 · Umbral Anaeróbico',
      shortName: 'Z4 Umbral',
      percentOfMax: pct,
      rangeLabel: `${Math.round(safeMax * 0.8)}–${Math.round(safeMax * 0.9)} BPM`,
      colorClass: 'text-orange-400',
      strokeHex: '#FB923C',
    };
  }
  return {
    index: 5,
    name: 'Zona 5 · Esfuerzo Máximo',
    shortName: 'Z5 Máx.',
    percentOfMax: pct,
    rangeLabel: `>= ${Math.round(safeMax * 0.9)} BPM`,
    colorClass: 'text-rose-400',
    strokeHex: '#FB7185',
  };
}

export function computeSessionStats(samples: HeartRateSample[]): SessionStats {
  if (samples.length === 0) {
    return {
      minBpm: null,
      maxBpm: null,
      avgBpm: null,
      totalSamples: 0,
      durationSec: 0,
    };
  }

  let minBpm = Infinity;
  let maxBpm = -Infinity;
  let sum = 0;

  for (const s of samples) {
    if (s.bpm < minBpm) minBpm = s.bpm;
    if (s.bpm > maxBpm) maxBpm = s.bpm;
    sum += s.bpm;
  }

  const firstTs = samples[0].timestampMs;
  const lastTs = samples[samples.length - 1].timestampMs;

  return {
    minBpm,
    maxBpm,
    avgBpm: Math.round((sum / samples.length) * 10) / 10,
    totalSamples: samples.length,
    durationSec: Math.max(0, Math.round((lastTs - firstTs) / 1000)),
  };
}

export function formatDurationClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatSamplesToCsv(
  samples: HeartRateSample[],
  biometricProfile?: CsvBiometricProfile
): string {
  const header =
    'timestamp_iso,bpm,zona,contacto_sensor,rr_intervals_ms,energia_kj,origen,trama_hex,peso_kg,altura_cm,grasa_corporal_pct';
  const weightStr =
    biometricProfile?.weightKg !== null && biometricProfile?.weightKg !== undefined
      ? String(biometricProfile.weightKg)
      : '';
  const heightStr =
    biometricProfile?.heightCm !== null && biometricProfile?.heightCm !== undefined
      ? String(biometricProfile.heightCm)
      : '';
  const fatStr =
    biometricProfile?.bodyFatPercent !== null && biometricProfile?.bodyFatPercent !== undefined
      ? String(biometricProfile.bodyFatPercent)
      : '';

  const rows = samples.map((s) => {
    const iso = new Date(s.timestampMs).toISOString();
    const rr = s.rrIntervalsMs.join('|');
    const energy = s.energyExpendedKj !== null ? String(s.energyExpendedKj) : '';
    return `${iso},${s.bpm},"${s.zoneLabel}",${s.sensorContact},"${rr}",${energy},${s.source},"${s.rawHex}",${weightStr},${heightStr},${fatStr}`;
  });
  return [header, ...rows].join('\n');
}

export const SIMULATION_PRESET_TARGETS: Record<
  SimulationPreset,
  { label: string; targetBpm: number; hrvJitterMs: number }
> = {
  rest: { label: 'Reposo', targetBpm: 64, hrvJitterMs: 42 },
  walk: { label: 'Caminata', targetBpm: 96, hrvJitterMs: 22 },
  cardio: { label: 'Cardio', targetBpm: 138, hrvJitterMs: 10 },
  hiit: { label: 'Intervalos', targetBpm: 168, hrvJitterMs: 6 },
};

export function generateNextSimulatedPacket(
  prevBpm: number,
  preset: SimulationPreset,
  stepIndex: number,
  cumulativeEnergyKj: number
): { packet: ParsedHeartRatePacket; nextEnergyKj: number } {
  const config = SIMULATION_PRESET_TARGETS[preset];
  const wave = Math.sin(stepIndex * 0.25) * 2.5 + Math.cos(stepIndex * 0.11) * 1.5;
  const target = config.targetBpm + wave;
  const smoothed = prevBpm + (target - prevBpm) * 0.28;
  const bpm = Math.max(45, Math.min(205, Math.round(smoothed)));

  const baseRrMs = 60000 / bpm;
  const polarity = stepIndex % 2 === 0 ? 1 : -1;
  const jitter = polarity * (config.hrvJitterMs * 0.72) + Math.sin(stepIndex * 1.1) * (config.hrvJitterMs * 0.28);
  const rr1 = Math.round((baseRrMs + jitter) * 10) / 10;

  const nextEnergyKj = cumulativeEnergyKj + (bpm > 100 ? 0.14 : 0.05);
  const dataView = encodeHeartRateMeasurement(bpm, [rr1], true, Math.round(nextEnergyKj));
  const packet = parseHeartRateMeasurement(dataView, Date.now());

  return { packet, nextEnergyKj };
}
