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
  { label: 'Sensor Cardíaco', value: 'Samsung BioActive (PPG Óptico en muñeca)' },
  { label: 'Métricas BLE Activas', value: 'BPM en tiempo real + Intervalos RR (HRV)' },
  { label: 'Frecuencia de Notificación', value: '1 Hz – 4 Hz según movimiento (0x2A37)' },
] as const;

export const SM_R860_GATT_TABLE: GattEntrySpec[] = [
  {
    id: 'hrs-service',
    role: 'Servicio',
    name: 'Heart Rate Service (HRS)',
    shortUuid: '0x180D',
    fullUuid: '0000180d-0000-1000-8000-00805f9b34fb',
    properties: 'Primary Service',
    description: 'Servicio GATT estándar para ritmo cardíaco e intervalos RR en tiempo real.',
    required: true,
  },
  {
    id: 'hr-measurement',
    role: 'Característica',
    name: 'Heart Rate Measurement',
    shortUuid: '0x2A37',
    fullUuid: '00002a37-0000-1000-8000-00805f9b34fb',
    properties: 'NOTIFY',
    description: 'Entrega BPM, estado de contacto con la piel, gasto energético kJ e intervalos RR (1/1024 s).',
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
    byteRange: 'Byte 0',
    field: 'Flags (Bitmask HR)',
    type: 'UINT8',
    detail: 'Bit 0: Formato BPM (0=UINT8, 1=UINT16) · Bits 1–2: Contacto piel · Bit 3: Energía kJ · Bit 4: Intervalos RR.',
  },
  {
    byteRange: 'Byte 1 (o 1–2)',
    field: 'Frecuencia Cardíaca (BPM)',
    type: 'UINT8 / UINT16 LE',
    detail: 'Valor instantáneo del pulso en latidos por minuto entregado por el sensor óptico.',
  },
  {
    byteRange: 'Bytes siguientes (opc.)',
    field: 'Energía e Intervalos RR',
    type: 'UINT16 LE',
    detail: 'Energía acumulada en kJ (si Bit 3 = 1) seguida de intervalos RR en unidades de 1/1024 s para cálculo HRV (RMSSD / SDNN).',
  },
] as const;

export const WEB_BLUETOOTH_SNIPPET = `// Conexión directa BLE al SM-R860: Ritmo Cardíaco (0x180D / 0x2A37)
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: [0x180D] }],
  optionalServices: [0x180F, 0x180A]
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
});`;

export const WEAR_OS_PERIPHERAL_SNIPPET = `// Kotlin (Wear OS SM-R860) — Exponer Heart Rate Service (0x180D)
val HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
val HR_CHAR = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")

// 1. Leer Sensor.TYPE_HEART_RATE o Samsung Health Sensor SDK (HEART_RATE + IBI)
// 2. Empaquetar Flags (0x06 o 0x16 con RR) + BPM UINT8/UINT16
// 3. Notificar por BluetoothGattServer en HR_CHAR y anunciar HR_SERVICE (0x180D).`;
