export interface GattEntrySpec {
  id: string;
  role: 'Servicio' | 'Característica' | 'Descriptor';
  name: string;
  shortUuid: string;
  fullUuid: string;
  properties: string;
  description: string;
  required: boolean;
}

export const SM_R860_HARDWARE_SPECS = [
  { label: 'Modelo', value: 'SM-R860 (Galaxy Watch4 40mm Bluetooth)' },
  { label: 'Sistema Operativo', value: 'Wear OS Powered by Samsung (One UI Watch)' },
  { label: 'Radio Bluetooth', value: 'Bluetooth 5.0 · BLE (Low Energy) GATT' },
  { label: 'Sensor Biométrico', value: 'Samsung BioActive (PPG Óptico + ECG + BIA)' },
  { label: 'Métricas Soportadas', value: 'BPM + Intervalos RR (Estrés HRV) + % Grasa (BIA)' },
  { label: 'Frecuencia de Notificación', value: '1 Hz – 4 Hz (0x2A37) · Lectura BIA (0x2A9C)' },
] as const;

export const SM_R860_GATT_TABLE: GattEntrySpec[] = [
  {
    id: 'hrs-service',
    role: 'Servicio',
    name: 'Heart Rate Service (HRS)',
    shortUuid: '0x180D',
    fullUuid: '0000180d-0000-1000-8000-00805f9b34fb',
    properties: 'Primary Service',
    description: 'Servicio GATT estándar para ritmo cardíaco e intervalos RR (base para cálculo de estrés HRV).',
    required: true,
  },
  {
    id: 'hr-measurement',
    role: 'Característica',
    name: 'Heart Rate Measurement',
    shortUuid: '0x2A37',
    fullUuid: '00002a37-0000-1000-8000-00805f9b34fb',
    properties: 'NOTIFY',
    description: 'Entrega BPM, contacto con la piel, kJ e intervalos RR (1/1024 s) para HRV y Nivel de Estrés.',
    required: true,
  },
  {
    id: 'cccd',
    role: 'Descriptor',
    name: 'Client Characteristic Configuration (CCCD)',
    shortUuid: '0x2902',
    fullUuid: '00002902-0000-1000-8000-00805f9b34fb',
    properties: 'READ / WRITE (0x0100)',
    description: 'Habilita notificaciones push desde el reloj. Web Bluetooth lo activa automáticamente.',
    required: true,
  },
  {
    id: 'bcs-service',
    role: 'Servicio',
    name: 'Body Composition Service (BCS / BIA)',
    shortUuid: '0x181B',
    fullUuid: '0000181b-0000-1000-8000-00805f9b34fb',
    properties: 'Optional Service',
    description: 'Servicio BLE opcional para recibir datos de impedancia bioeléctrica (% grasa corporal y músculo).',
    required: false,
  },
  {
    id: 'bcs-measurement',
    role: 'Característica',
    name: 'Body Composition Measurement',
    shortUuid: '0x2A9C',
    fullUuid: '00002a9c-0000-1000-8000-00805f9b34fb',
    properties: 'INDICATE / READ',
    description: 'Trama binaria con porcentaje de grasa corporal, masa muscular e impedancia Ω.',
    required: false,
  },
  {
    id: 'body-sensor',
    role: 'Característica',
    name: 'Body Sensor Location',
    shortUuid: '0x2A38',
    fullUuid: '00002a38-0000-1000-8000-00805f9b34fb',
    properties: 'READ',
    description: 'Ubicación física del sensor óptico. Para el SM-R860 en muñeca corresponde 0x02 (Wrist).',
    required: false,
  },
  {
    id: 'battery-service',
    role: 'Servicio',
    name: 'Battery Service (BAS)',
    shortUuid: '0x180F',
    fullUuid: '0000180f-0000-1000-8000-00805f9b34fb',
    properties: 'Optional Service',
    description: 'Servicio opcional para leer el porcentaje de batería del reloj (0x2A19) durante la sesión.',
    required: false,
  },
];

export const PAYLOAD_BYTE_MAP = [
  {
    byteRange: '0x2A37 · Byte 0',
    field: 'Flags (Bitmask HR)',
    type: 'UINT8',
    detail: 'Bit 0: Formato BPM (0=UINT8, 1=UINT16) · Bits 1–2: Contacto piel · Bit 3: Energía kJ · Bit 4: RR-Interval (base de HRV y Estrés).',
  },
  {
    byteRange: '0x2A37 · Byte 1 (+RR)',
    field: 'BPM e Intervalos RR',
    type: 'UINT8/16 + UINT16 LE',
    detail: 'BPM instantáneo seguido de intervalos RR (ms = raw * 1000 / 1024). Con RMSSD y SDNN la interfaz calcula el estrés 0–100 en vivo.',
  },
  {
    byteRange: '0x2A9C · Bytes 0–3',
    field: 'Flags BIA + % Grasa',
    type: 'UINT16 LE + UINT16 LE',
    detail: 'Máscara de 16 bits que indica qué campos bioeléctricos están presentes (músculo, agua, impedancia Ω) y % grasa corporal (×0.1).',
  },
] as const;

export const WEB_BLUETOOTH_SNIPPET = `// Conexión directa BLE al SM-R860: Ritmo Cardíaco (0x180D) + Grasa / BIA (0x181B)
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: [0x180D] }],
  optionalServices: [0x181B, 0x180F, 0x180A]
});

const server = await device.gatt.connect();
const hrService = await server.getPrimaryService(0x180D);
const hrChar = await hrService.getCharacteristic(0x2A37);

await hrChar.startNotifications();
hrChar.addEventListener('characteristicvaluechanged', (event) => {
  const view = event.target.value;
  const flags = view.getUint8(0);
  const bpm = (flags & 0x01) ? view.getUint16(1, true) : view.getUint8(1);
  console.log('SM-R860 BPM:', bpm);
});

// Lectura opcional de Grasa Corporal / BIA si el reloj expone 0x181B -> 0x2A9C
const bcs = await server.getPrimaryService(0x181B);
const bcsChar = await bcs.getCharacteristic(0x2A9C);
await bcsChar.startNotifications();`;

export const WEAR_OS_PERIPHERAL_SNIPPET = `// Kotlin (Wear OS SM-R860) — Exponer HR (0x180D) + BIA/% Grasa (0x181B) + Estrés
val HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
val HR_CHAR = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
val BCS_SERVICE = UUID.fromString("0000181b-0000-1000-8000-00805f9b34fb")
val BCS_CHAR = UUID.fromString("00002a9c-0000-1000-8000-00805f9b34fb")

// 1. Samsung Health Sensor SDK (SM-R860 BioActive):
//    - HealthTrackerType.HEART_RATE -> emite BPM + IBI (intervalos RR) en 0x2A37
//    - HealthTrackerType.BIA -> entrega % grasa corporal, músculo, impedancia -> 0x2A9C
// 2. Añadir servicios HR_SERVICE y BCS_SERVICE a BluetoothGattServer y anunciar 0x180D.`;
