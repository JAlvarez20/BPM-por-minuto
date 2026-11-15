export type ConnectionMode = 'idle' | 'connecting' | 'ble-live' | 'simulated' | 'error';

export type ActiveTab = 'monitor' | 'connection' | 'packets';

export type SimulationPreset = 'rest' | 'walk' | 'cardio' | 'hiit';

export type SensorContactState = 'not-supported' | 'no-contact' | 'contact';

export interface ParsedHeartRatePacket {
  timestampMs: number;
  bpm: number;
  format: 'uint8' | 'uint16';
  sensorContact: SensorContactState;
  energyExpendedKj: number | null;
  rrIntervalsMs: number[];
  flagsByte: number;
  rawHex: string;
  rawBytes: number[];
}

export interface HeartRateSample extends ParsedHeartRatePacket {
  id: string;
  source: 'ble' | 'simulated';
  zoneIndex: number;
  zoneLabel: string;
  stressScore: number | null;
}

export interface HrvMetrics {
  rmssdMs: number | null;
  sdnnMs: number | null;
  pnn50Percent: number | null;
  meanRrMs: number | null;
  sampleCount: number;
}

export interface CardiacZoneInfo {
  index: number;
  name: string;
  shortName: string;
  percentOfMax: number;
  rangeLabel: string;
  colorClass: string;
  strokeHex: string;
}

export interface SessionStats {
  minBpm: number | null;
  maxBpm: number | null;
  avgBpm: number | null;
  totalSamples: number;
  durationSec: number;
}

export interface BodyCompositionReading {
  timestampMs: number;
  bmi: number | null;
  bmiCategory: string;
  bmiColorClass: string;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  musclePercent: number | null;
  muscleMassKg: number | null;
  bodyWaterKg: number | null;
  basalMetabolismKj: number | null;
  impedanceOhm: number | null;
  source: 'ble-0x2a9c' | 'ble-0x2a9d' | 'simulated-bia' | 'manual-profile';
  rawHex: string;
}

export interface CsvBiometricProfile {
  bodyFatPercent: number | null;
}

export type StressCategory = 'Bajo' | 'Moderado' | 'Elevado' | 'Alto';

export interface StressReading {
  timestampMs: number;
  score: number;
  category: StressCategory;
  colorClass: string;
  barHex: string;
  source: 'ble-direct' | 'hrv-rr';
  rawHex?: string;
}

export interface GattTargetConfig {
  serviceUuid: string;
  characteristicUuid: string;
  bodyCompServiceUuid: string;
  bodyCompCharUuid: string;
  stressServiceUuid: string;
  stressCharUuid: string;
  deviceNamePrefix: string;
  maxHr: number;
  manualBodyFatPercent: number | null;
}

export interface ConnectedDeviceMetadata {
  name: string;
  id: string;
  batteryLevel: number | null;
  bodySensorLocation: string | null;
  manufacturerName: string | null;
  modelNumber: string | null;
  serviceUuid: string;
  characteristicUuid: string;
  hasBodyCompositionService: boolean;
  hasStressCharacteristic: boolean;
  discoveredServices: string[];
  hrCharProperties: string[];
  connectedAtMs: number;
}

export interface WebBluetoothCharacteristicProperties {
  broadcast?: boolean;
  read?: boolean;
  writeWithoutResponse?: boolean;
  write?: boolean;
  notify?: boolean;
  indicate?: boolean;
}

export interface WebBluetoothCharacteristic {
  uuid: string;
  value?: DataView;
  properties?: WebBluetoothCharacteristicProperties;
  startNotifications: () => Promise<WebBluetoothCharacteristic>;
  stopNotifications: () => Promise<WebBluetoothCharacteristic>;
  readValue: () => Promise<DataView>;
  addEventListener: (
    type: 'characteristicvaluechanged',
    listener: (event: Event & { target: WebBluetoothCharacteristic }) => void
  ) => void;
  removeEventListener: (
    type: 'characteristicvaluechanged',
    listener: (event: Event & { target: WebBluetoothCharacteristic }) => void
  ) => void;
}

export interface WebBluetoothService {
  uuid: string;
  getCharacteristic: (characteristic: string | number) => Promise<WebBluetoothCharacteristic>;
  getCharacteristics?: (characteristic?: string | number) => Promise<WebBluetoothCharacteristic[]>;
}

export interface WebBluetoothGattServer {
  connected: boolean;
  connect: () => Promise<WebBluetoothGattServer>;
  disconnect: () => void;
  getPrimaryService: (service: string | number) => Promise<WebBluetoothService>;
  getPrimaryServices?: (service?: string | number) => Promise<WebBluetoothService[]>;
}

export interface WebBluetoothDevice {
  id: string;
  name?: string;
  gatt?: WebBluetoothGattServer;
  addEventListener: (type: 'gattserverdisconnected', listener: () => void) => void;
  removeEventListener: (type: 'gattserverdisconnected', listener: () => void) => void;
}

export interface WebBluetoothNavigator {
  bluetooth?: {
    getAvailability?: () => Promise<boolean>;
    getDevices?: () => Promise<WebBluetoothDevice[]>;
    requestDevice: (options: {
      filters?: Array<{ services?: Array<string | number>; name?: string; namePrefix?: string }>;
      optionalServices?: Array<string | number>;
      acceptAllDevices?: boolean;
    }) => Promise<WebBluetoothDevice>;
  };
}
