import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import { BiometricsPanel } from './components/BiometricsPanel';
import { ConnectionGuideView } from './components/ConnectionGuideView';
import { DeviceControlPanel } from './components/DeviceControlPanel';
import { Header } from './components/Header';
import { PacketInspectorView } from './components/PacketInspectorView';
import { UuidConfigModal } from './components/UuidConfigModal';
import { WaveformCanvas } from './components/WaveformCanvas';
import type {
  ActiveTab,
  ConnectedDeviceMetadata,
  ConnectionMode,
  GattTargetConfig,
  HeartRateSample,
  ParsedHeartRatePacket,
  SimulationPreset,
  StressReading,
  WebBluetoothCharacteristic,
  WebBluetoothDevice,
  WebBluetoothGattServer,
  WebBluetoothNavigator,
  WebBluetoothService,
} from './types/bluetooth';
import {
  STANDARD_GATT_UUIDS,
  computeCardiacZone,
  computeHrvMetrics,
  computeSessionStats,
  decodeBodySensorLocation,
  extractCharacteristicProperties,
  formatSamplesToCsv,
  formatShortUuidLabel,
  generateNextSimulatedPacket,
  normalizeGattUuid,
  parseHeartRateMeasurement,
} from './utils/bleHeartRate';
import {
  STANDARD_BIOMETRIC_UUIDS,
  computeStressFromHrv,
  parseStressCharacteristic,
} from './utils/biometrics';

const DEFAULT_GATT_CONFIG: GattTargetConfig = {
  serviceUuid: STANDARD_GATT_UUIDS.HEART_RATE_SERVICE,
  characteristicUuid: STANDARD_GATT_UUIDS.HEART_RATE_MEASUREMENT_CHAR,
  bodyCompServiceUuid: STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_SERVICE,
  bodyCompCharUuid: STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_MEASUREMENT_CHAR,
  stressServiceUuid: STANDARD_BIOMETRIC_UUIDS.CUSTOM_STRESS_SERVICE,
  stressCharUuid: STANDARD_BIOMETRIC_UUIDS.CUSTOM_STRESS_CHAR,
  deviceNamePrefix: '',
  maxHr: 190,
  manualBodyFatPercent: null,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gattConfig, setGattConfig] = useState<GattTargetConfig>(DEFAULT_GATT_CONFIG);
  const [isUuidModalOpen, setIsUuidModalOpen] = useState(false);

  const [samples, setSamples] = useState<HeartRateSample[]>([]);
  const [directStress, setDirectStress] = useState<StressReading | null>(null);
  const [deviceMeta, setDeviceMeta] = useState<ConnectedDeviceMetadata | null>(null);
  const [blePacketCount, setBlePacketCount] = useState(0);
  const [bleNoDataElapsedSec, setBleNoDataElapsedSec] = useState(0);
  const [bleDiagnosticNote, setBleDiagnosticNote] = useState<string | null>(null);
  const [simulationPreset, setSimulationPreset] = useState<SimulationPreset>('rest');

  // Refs for active Web Bluetooth & simulation state
  const bleDeviceRef = useRef<WebBluetoothDevice | null>(null);
  const bleServerRef = useRef<WebBluetoothGattServer | null>(null);
  const bleHrCharRef = useRef<WebBluetoothCharacteristic | null>(null);
  const bleHrListenerRef = useRef<
    ((event: Event & { target: WebBluetoothCharacteristic }) => void) | null
  >(null);
  const blePollTimerRef = useRef<number | null>(null);
  const bleCharsRef = useRef<WebBluetoothCharacteristic[]>([]);
  const directStressRef = useRef<StressReading | null>(null);
  const simStateRef = useRef({
    bpm: 66,
    step: 0,
    energyKj: 0,
    preset: 'rest' as SimulationPreset,
  });

  useEffect(() => {
    simStateRef.current.preset = simulationPreset;
  }, [simulationPreset]);

  useEffect(() => {
    directStressRef.current = directStress;
  }, [directStress]);

  const appendPacket = useCallback(
    (packet: ParsedHeartRatePacket, source: 'ble' | 'simulated', maxHr: number) => {
      const zone = computeCardiacZone(packet.bpm, maxHr);
      setSamples((prev) => {
        const recentRr: number[] = [];
        for (const item of prev.slice(-30)) {
          for (const rr of item.rrIntervalsMs) recentRr.push(rr);
        }
        for (const rr of packet.rrIntervalsMs) recentRr.push(rr);

        const hrv = computeHrvMetrics(recentRr);
        const activeDirectStress = directStressRef.current;
        const computedStress =
          activeDirectStress && Date.now() - activeDirectStress.timestampMs < 15000
            ? activeDirectStress.score
            : computeStressFromHrv({
                bpm: packet.bpm,
                rmssdMs: hrv.rmssdMs,
                sdnnMs: hrv.sdnnMs,
                timestampMs: packet.timestampMs,
              })?.score ?? null;

        const nextSample: HeartRateSample = {
          ...packet,
          id: `${packet.timestampMs}-${Math.random().toString(36).slice(2, 7)}`,
          source,
          zoneIndex: zone.index,
          zoneLabel: zone.shortName,
          stressScore: computedStress,
        };

        const trimmed = prev.length >= 600 ? prev.slice(prev.length - 599) : prev;
        return [...trimmed, nextSample];
      });
    },
    []
  );

  // Clean up BLE listeners & connection
  const disconnectBle = useCallback(async () => {
    if (blePollTimerRef.current !== null) {
      window.clearInterval(blePollTimerRef.current);
      blePollTimerRef.current = null;
    }

    if (bleHrCharRef.current && bleHrListenerRef.current) {
      try {
        bleHrCharRef.current.removeEventListener(
          'characteristicvaluechanged',
          bleHrListenerRef.current
        );
      } catch {
        // Ignore listener removal errors
      }
    }
    bleHrCharRef.current = null;
    bleHrListenerRef.current = null;

    for (const ch of bleCharsRef.current) {
      try {
        await ch.stopNotifications();
      } catch {
        // Device might already be disconnected
      }
    }
    bleCharsRef.current = [];
    bleServerRef.current = null;

    const dev = bleDeviceRef.current;
    if (dev) {
      if (dev.gatt?.connected) {
        dev.gatt.disconnect();
      }
      bleDeviceRef.current = null;
    }

    setDeviceMeta(null);
    setDirectStress(null);
    setBlePacketCount(0);
    setBleNoDataElapsedSec(0);
    setBleDiagnosticNote(null);
    setConnectionMode((prev) => (prev === 'ble-live' || prev === 'connecting' ? 'idle' : prev));
  }, []);

  const handleStartSimulation = useCallback(() => {
    void disconnectBle();
    setErrorMessage(null);
    setDirectStress(null);
    setConnectionMode('simulated');
  }, [disconnectBle]);

  const handleStopSimulation = useCallback(() => {
    setConnectionMode('idle');
  }, []);

  // Optional ?autostart=1 support for automated testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        setConnectionMode('simulated');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulation loop driving real 0x2A37 binary encode -> decode pipeline
  useEffect(() => {
    if (connectionMode !== 'simulated') return;

    const emitOnce = () => {
      const st = simStateRef.current;
      st.step += 1;
      const { packet, nextEnergyKj } = generateNextSimulatedPacket(
        st.bpm,
        st.preset,
        st.step,
        st.energyKj
      );
      st.bpm = packet.bpm;
      st.energyKj = nextEnergyKj;
      appendPacket(packet, 'simulated', gattConfig.maxHr);
    };

    emitOnce();
    const timer = window.setInterval(emitOnce, 900);
    return () => window.clearInterval(timer);
  }, [connectionMode, gattConfig.maxHr, appendPacket]);

  // Watchdog: track elapsed seconds while BLE is connected with 0 packets received
  useEffect(() => {
    if (connectionMode !== 'ble-live' || blePacketCount > 0) {
      setBleNoDataElapsedSec(0);
      return;
    }

    setBleNoDataElapsedSec(0);
    const timer = window.setInterval(() => {
      setBleNoDataElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connectionMode, blePacketCount]);

  // Connect directly via Web Bluetooth API
  const handleConnectBluetooth = useCallback(
    async (scanAllDevices = false) => {
      setErrorMessage(null);
      setBleDiagnosticNote(null);
      setBlePacketCount(0);
      setBleNoDataElapsedSec(0);

      const nav = navigator as unknown as WebBluetoothNavigator;
      if (!nav.bluetooth) {
        setConnectionMode('error');
        setErrorMessage(
          'Web Bluetooth no está disponible en este navegador o contexto. Usa Google Chrome, Edge u Opera en una pestaña independiente (no dentro de un iframe) bajo HTTPS o localhost.'
        );
        return;
      }

      try {
        if (blePollTimerRef.current !== null) {
          window.clearInterval(blePollTimerRef.current);
          blePollTimerRef.current = null;
        }
        setConnectionMode('connecting');

        const optionalServices = Array.from(
          new Set([
            gattConfig.serviceUuid,
            gattConfig.bodyCompServiceUuid,
            gattConfig.stressServiceUuid,
            STANDARD_GATT_UUIDS.HEART_RATE_SERVICE,
            STANDARD_BIOMETRIC_UUIDS.BODY_COMPOSITION_SERVICE,
            STANDARD_BIOMETRIC_UUIDS.WEIGHT_SCALE_SERVICE,
            STANDARD_GATT_UUIDS.BATTERY_SERVICE,
            STANDARD_GATT_UUIDS.DEVICE_INFO_SERVICE,
          ])
        );

        let device: WebBluetoothDevice;
        if (scanAllDevices) {
          device = await nav.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices,
          });
        } else {
          const filter: { services?: string[]; namePrefix?: string } = {
            services: [gattConfig.serviceUuid],
          };
          if (gattConfig.deviceNamePrefix) {
            filter.namePrefix = gattConfig.deviceNamePrefix;
          }
          device = await nav.bluetooth.requestDevice({
            filters: [filter],
            optionalServices,
          });
        }

        bleDeviceRef.current = device;
        bleCharsRef.current = [];
        bleHrCharRef.current = null;
        bleHrListenerRef.current = null;

        const onDisconnected = () => {
          if (blePollTimerRef.current !== null) {
            window.clearInterval(blePollTimerRef.current);
            blePollTimerRef.current = null;
          }
          bleCharsRef.current = [];
          bleServerRef.current = null;
          bleHrCharRef.current = null;
          bleHrListenerRef.current = null;
          setConnectionMode('idle');
          setErrorMessage('El SM-R860 se desconectó del enlace GATT Bluetooth.');
        };
        device.addEventListener('gattserverdisconnected', onDisconnected);

        if (!device.gatt) {
          throw new Error('El dispositivo seleccionado no expone un servidor GATT.');
        }

        const server = await device.gatt.connect();
        bleServerRef.current = server;

        // Discover permitted services once so we don't spam nonexistent services on Wear OS GATT
        let discoveredServices: WebBluetoothService[] = [];
        if (server.getPrimaryServices) {
          try {
            discoveredServices = await server.getPrimaryServices();
          } catch {
            discoveredServices = [];
          }
        }

        const targetServiceUuidNorm =
          normalizeGattUuid(gattConfig.serviceUuid) ?? gattConfig.serviceUuid.toLowerCase();
        const targetCharUuidNorm =
          normalizeGattUuid(gattConfig.characteristicUuid) ??
          gattConfig.characteristicUuid.toLowerCase();

        const discoveredShortLabels = Array.from(
          new Set(discoveredServices.map((s) => formatShortUuidLabel(s.uuid)))
        );
        const hasDiscoveredService = (uuid: string) => {
          const norm = normalizeGattUuid(uuid) ?? uuid.toLowerCase();
          return discoveredServices.some(
            (s) => (normalizeGattUuid(s.uuid) ?? s.uuid.toLowerCase()) === norm
          );
        };

        let hrService: WebBluetoothService | null = null;
        let characteristic: WebBluetoothCharacteristic | null = null;

        // Check all matching Heart Rate Service instances in case Wear OS exposes a cached duplicate
        const matchingHrServices = discoveredServices.filter(
          (s) => (normalizeGattUuid(s.uuid) ?? s.uuid.toLowerCase()) === targetServiceUuidNorm
        );

        for (const candidateService of matchingHrServices) {
          try {
            const candidateChar = await candidateService.getCharacteristic(
              gattConfig.characteristicUuid
            );
            hrService = candidateService;
            characteristic = candidateChar;
            break;
          } catch {
            // Try next instance
          }
        }

        if (!hrService || !characteristic) {
          try {
            hrService = await server.getPrimaryService(gattConfig.serviceUuid);
            characteristic = await hrService.getCharacteristic(gattConfig.characteristicUuid);
          } catch {
            const discoveredList =
              discoveredShortLabels.length > 0
                ? ` Servicios detectados: ${discoveredShortLabels.join(', ')}.`
                : '';
            server.disconnect();
            throw new Error(
              `El dispositivo "${device.name || 'SM-R860'}" se conectó, pero NO expone el servicio de Ritmo Cardíaco (${formatShortUuidLabel(gattConfig.serviceUuid)}) / característica ${formatShortUuidLabel(gattConfig.characteristicUuid)}.${discoveredList} Verifica que Heart for Bluetooth esté activo en el reloj.`
            );
          }
        }

        bleCharsRef.current.push(characteristic);
        bleHrCharRef.current = characteristic;
        const hrCharProps = extractCharacteristicProperties(characteristic.properties);

        const handleNotification = (
          event: Event & { target: WebBluetoothCharacteristic }
        ) => {
          const value =
            (event.target as WebBluetoothCharacteristic | null)?.value ?? characteristic?.value;
          if (!value) return;
          try {
            const parsed = parseHeartRateMeasurement(value, Date.now());
            setBlePacketCount((c) => c + 1);
            setBleDiagnosticNote(
              parsed.bpm === 0
                ? `Trama 0x2A37 recibida (${parsed.rawHex}) con 0 BPM: el reloj sigue buscando pulso o le falta permiso de sensor.`
                : null
            );
            appendPacket(parsed, 'ble', gattConfig.maxHr);
          } catch (err) {
            setErrorMessage(
              err instanceof Error ? err.message : 'Error decodificando trama BLE 0x2A37.'
            );
          }
        };

        bleHrListenerRef.current = handleNotification;
        characteristic.addEventListener('characteristicvaluechanged', handleNotification);

        const supportsNotifyOrIndicate =
          !characteristic.properties ||
          Boolean(characteristic.properties.notify || characteristic.properties.indicate);

        if (supportsNotifyOrIndicate) {
          await characteristic.startNotifications();
        }

        // Enter live state immediately before querying any optional services
        setDeviceMeta({
          name: device.name || 'Samsung Galaxy Watch4 (SM-R860)',
          id: device.id,
          batteryLevel: null,
          bodySensorLocation: null,
          manufacturerName: 'Samsung',
          modelNumber: 'SM-R860',
          serviceUuid: gattConfig.serviceUuid,
          characteristicUuid: gattConfig.characteristicUuid,
          hasBodyCompositionService: false,
          hasStressCharacteristic: false,
          discoveredServices: discoveredShortLabels,
          hrCharProperties: hrCharProps,
          connectedAtMs: Date.now(),
        });
        setConnectionMode('ble-live');

        // If the watch exposes read on 0x2A37, try an initial read (or poll if notify/indicate are absent)
        if (characteristic.properties?.read) {
          try {
            const initialVal = await characteristic.readValue();
            if (initialVal.byteLength >= 2) {
              const parsed = parseHeartRateMeasurement(initialVal, Date.now());
              setBlePacketCount((c) => c + 1);
              appendPacket(parsed, 'ble', gattConfig.maxHr);
            }
          } catch {
            // Wait for notifications
          }

          if (!characteristic.properties.notify && !characteristic.properties.indicate) {
            blePollTimerRef.current = window.setInterval(() => {
              const ch = bleHrCharRef.current;
              if (!ch || !bleServerRef.current?.connected) return;
              void ch
                .readValue()
                .then((val) => {
                  if (val.byteLength >= 2) {
                    const parsed = parseHeartRateMeasurement(val, Date.now());
                    setBlePacketCount((c) => c + 1);
                    appendPacket(parsed, 'ble', gattConfig.maxHr);
                  }
                })
                .catch(() => {
                  // Ignore transient read hiccup
                });
            }, 1000);
          }
        }

        // Let the 0x2902 CCCD descriptor write settle on Wear OS BluetoothGattServer before optional probes
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (!server.connected) return;

        // Query optional services ONLY if present in discoveredServices (or when discovery isn't available)
        const canSkipOptionalDiscovery = discoveredServices.length > 0;
        const hasBodyComp = false;

        let hasStressChar = false;
        if (!canSkipOptionalDiscovery || hasDiscoveredService(gattConfig.stressServiceUuid)) {
          try {
            const stressService = await server.getPrimaryService(gattConfig.stressServiceUuid);
            const stressChar = await stressService.getCharacteristic(gattConfig.stressCharUuid);
            bleCharsRef.current.push(stressChar);
            hasStressChar = true;

            stressChar.addEventListener('characteristicvaluechanged', (ev) => {
              if (ev.target.value) {
                try {
                  setDirectStress(parseStressCharacteristic(ev.target.value, Date.now()));
                } catch {
                  // Ignore malformed optional stress packet
                }
              }
            });
            try {
              await stressChar.startNotifications();
            } catch {
              // Optional
            }
            try {
              const sVal = await stressChar.readValue();
              if (sVal.byteLength >= 1) {
                setDirectStress(parseStressCharacteristic(sVal, Date.now()));
              }
            } catch {
              // Wait for notify
            }
          } catch {
            // Stress derived from live HRV RR-intervals (0x2A37)
          }
        }

        let sensorLocation: string | null = null;
        try {
          let hasLocationChar = true;
          if (hrService.getCharacteristics) {
            const hrChars = await hrService.getCharacteristics();
            const locUuidNorm = STANDARD_GATT_UUIDS.BODY_SENSOR_LOCATION_CHAR;
            hasLocationChar = hrChars.some(
              (c) => (normalizeGattUuid(c.uuid) ?? c.uuid.toLowerCase()) === locUuidNorm
            );
            const matchedTarget = hrChars.find(
              (c) => (normalizeGattUuid(c.uuid) ?? c.uuid.toLowerCase()) === targetCharUuidNorm
            );
            if (matchedTarget?.properties && hrCharProps.length === 0) {
              hrCharProps.push(...extractCharacteristicProperties(matchedTarget.properties));
            }
          }
          if (hasLocationChar) {
            const locChar = await hrService.getCharacteristic(
              STANDARD_GATT_UUIDS.BODY_SENSOR_LOCATION_CHAR
            );
            const locVal = await locChar.readValue();
            if (locVal.byteLength >= 1) {
              sensorLocation = decodeBodySensorLocation(locVal.getUint8(0));
            }
          }
        } catch {
          // Optional characteristic not exposed
        }

        let batteryLevel: number | null = null;
        if (!canSkipOptionalDiscovery || hasDiscoveredService(STANDARD_GATT_UUIDS.BATTERY_SERVICE)) {
          try {
            const batService = await server.getPrimaryService(
              STANDARD_GATT_UUIDS.BATTERY_SERVICE
            );
            const batChar = await batService.getCharacteristic(
              STANDARD_GATT_UUIDS.BATTERY_LEVEL_CHAR
            );
            const batVal = await batChar.readValue();
            if (batVal.byteLength >= 1) {
              batteryLevel = batVal.getUint8(0);
            }
          } catch {
            // Optional Battery Service not exposed
          }
        }

        setDeviceMeta((prev) =>
          prev
            ? {
                ...prev,
                batteryLevel,
                bodySensorLocation: sensorLocation,
                hasBodyCompositionService: hasBodyComp,
                hasStressCharacteristic: hasStressChar,
                hrCharProperties: [...hrCharProps],
              }
            : prev
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error inesperado al conectar vía Bluetooth.';
        const lower = message.toLowerCase();
        if (lower.includes('cancel')) {
          setConnectionMode('idle');
          setErrorMessage(
            'Selección Bluetooth cancelada. Si tu SM-R860 ya está emparejado por Bluetooth clásico pero no aparece, prueba "Escanear todos los BLE (sin filtro)" y asegúrate de tener activa una app transmisora BLE HR en el reloj.'
          );
        } else if (
          lower.includes('permissions policy') ||
          lower.includes('disallowed') ||
          lower.includes('securityerror')
        ) {
          setConnectionMode('error');
          setErrorMessage(
            'El visor embebido bloquea Web Bluetooth por política de permisos del iframe. Usa el botón "Abrir en nueva pestaña" de la barra superior de AI Studio en Chrome o Edge para conectar tu SM-R860.'
          );
        } else if (
          lower.includes('adapter') ||
          lower.includes('not available') ||
          lower.includes('globally disabled')
        ) {
          setConnectionMode('error');
          setErrorMessage(
            'Chrome reportó que el adaptador Bluetooth no está disponible o está desactivado en el sistema. Verifica que Bluetooth esté encendido en Windows/macOS/Android, que el navegador tenga permiso de Bluetooth del sistema operativo y que no estés dentro de un visor iframe restringido.'
          );
        } else {
          setConnectionMode('error');
          setErrorMessage(message);
        }
      }
    },
    [gattConfig, appendPacket]
  );

  const handleResubscribeBle = useCallback(async () => {
    const ch = bleHrCharRef.current;
    if (!ch || !bleServerRef.current?.connected) {
      setErrorMessage('No hay una conexión BLE GATT activa para re-suscribir.');
      return;
    }
    setErrorMessage(null);
    setBleDiagnosticNote('Re-suscribiendo descriptor CCCD (0x2902) de 0x2A37...');
    try {
      try {
        await ch.stopNotifications();
      } catch {
        // Ignore if not currently subscribed
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      await ch.startNotifications();
      setBleDiagnosticNote(
        'Suscripción 0x2A37 reactivada. Si el reloj sigue en 0 tramas, verifica en Heart for Bluetooth que el pulso aparezca en la pantalla del reloj.'
      );
      if (ch.properties?.read) {
        try {
          const val = await ch.readValue();
          if (val.byteLength >= 2) {
            const parsed = parseHeartRateMeasurement(val, Date.now());
            setBlePacketCount((c) => c + 1);
            setBleDiagnosticNote(null);
            appendPacket(parsed, 'ble', gattConfig.maxHr);
          }
        } catch {
          // Ignore if device denies read
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo re-suscribir la característica 0x2A37.'
      );
    }
  }, [appendPacket, gattConfig.maxHr]);

  const handleManualReadBle = useCallback(async () => {
    const ch = bleHrCharRef.current;
    if (!ch || !bleServerRef.current?.connected) {
      setErrorMessage('No hay una conexión BLE GATT activa para leer.');
      return;
    }
    setErrorMessage(null);
    try {
      const val = await ch.readValue();
      if (val.byteLength >= 2) {
        const parsed = parseHeartRateMeasurement(val, Date.now());
        setBlePacketCount((c) => c + 1);
        setBleDiagnosticNote(
          parsed.bpm === 0
            ? `Lectura manual recibida (${parsed.rawHex}): 0 BPM. El reloj aún no entrega pulso válido.`
            : null
        );
        appendPacket(parsed, 'ble', gattConfig.maxHr);
      } else {
        setBleDiagnosticNote(
          `Lectura manual devolvió ${val.byteLength} bytes (valor vacío en el servidor GATT del reloj).`
        );
      }
    } catch {
      setBleDiagnosticNote(
        'La característica 0x2A37 del reloj no admite lectura directa (readValue); solo envía por notificaciones (notify). Usa "Re-suscribir" o verifica los permisos de sensor en Heart for Bluetooth.'
      );
    }
  }, [appendPacket, gattConfig.maxHr]);

  const handlePrimaryBluetoothAction = useCallback(() => {
    if (connectionMode === 'ble-live') {
      void disconnectBle();
    } else {
      void handleConnectBluetooth(false);
    }
  }, [connectionMode, disconnectBle, handleConnectBluetooth]);

  const handleExportCsv = useCallback(() => {
    if (samples.length === 0) return;
    const csv = formatSamplesToCsv(samples);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sm-r860-biometria-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [samples]);

  const handleClearSession = useCallback(() => {
    setSamples([]);
    setDirectStress(null);
  }, []);

  // Derived metrics
  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
  const currentBpm = latestSample ? latestSample.bpm : null;
  const isStreaming = connectionMode === 'ble-live' || connectionMode === 'simulated';

  const zoneInfo = useMemo(
    () => (currentBpm !== null ? computeCardiacZone(currentBpm, gattConfig.maxHr) : null),
    [currentBpm, gattConfig.maxHr]
  );

  const allRrIntervals = useMemo(() => {
    const collected: number[] = [];
    const windowSamples = samples.slice(-45);
    for (const s of windowSamples) {
      for (const rr of s.rrIntervalsMs) {
        collected.push(rr);
      }
    }
    return collected;
  }, [samples]);

  const hrvMetrics = useMemo(() => computeHrvMetrics(allRrIntervals), [allRrIntervals]);
  const sessionStats = useMemo(() => computeSessionStats(samples), [samples]);

  const activeStressReading = useMemo(() => {
    if (directStress) return directStress;
    return computeStressFromHrv({
      bpm: currentBpm,
      rmssdMs: hrvMetrics.rmssdMs,
      sdnnMs: hrvMetrics.sdnnMs,
      timestampMs: latestSample?.timestampMs ?? Date.now(),
    });
  }, [directStress, currentBpm, hrvMetrics.rmssdMs, hrvMetrics.sdnnMs, latestSample?.timestampMs]);

  const latestContactLabel = !latestSample
    ? 'Contacto piel: en espera'
    : latestSample.sensorContact === 'contact'
    ? 'Contacto piel: detectado'
    : latestSample.sensorContact === 'no-contact'
    ? 'Sin contacto en muñeca'
    : 'Contacto piel: no reportado';

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionMode={connectionMode}
        onPrimaryBluetoothAction={handlePrimaryBluetoothAction}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-6">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-950/30 px-5 py-3.5 text-xs text-rose-200"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {typeof window !== 'undefined' && window.self !== window.top && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-900/40 px-2.5 py-1 font-semibold text-rose-100 hover:bg-rose-800/50"
                >
                  <span>Abrir en pestaña nueva</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('connection')}
                className="font-semibold text-rose-300 underline underline-offset-4 hover:text-rose-200 cursor-pointer"
              >
                Ver guía SM-R860
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {connectionMode === 'ble-live' &&
          (bleNoDataElapsedSec >= 5 ||
            (latestSample?.source === 'ble' && latestSample.bpm === 0) ||
            bleDiagnosticNote) && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/25 px-5 py-4 text-xs text-amber-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-2.5 max-w-3xl">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                    aria-hidden="true"
                  />
                  <div className="space-y-2">
                    <p className="font-semibold text-amber-200">
                      {blePacketCount === 0
                        ? `Conectado a "${deviceMeta?.name ?? 'SM-R860'}", pero el reloj aún no envía paquetes 0x2A37 (${bleNoDataElapsedSec}s en espera)`
                        : bleDiagnosticNote ?? 'Diagnóstico de enlace BLE'}
                    </p>
                    {bleDiagnosticNote && blePacketCount === 0 && (
                      <p className="text-amber-200/90">{bleDiagnosticNote}</p>
                    )}
                    <ul className="list-disc pl-4 space-y-1 text-amber-100/85 leading-relaxed">
                      <li>
                        <strong>En Heart for Bluetooth (reloj):</strong> asegúrate de que la app esté{' '}
                        <em>iniciada / transmitiendo</em> y mostrando un BPM real en la pantalla del SM-R860 (no 0 ni --).
                      </li>
                      <li>
                        <strong>Permisos en Galaxy Watch4:</strong> en el reloj abre{' '}
                        <em>Ajustes → Aplicaciones → Permisos → Heart for Bluetooth</em> y activa{' '}
                        <strong>Sensores corporales</strong> + batería en <strong>Sin restricciones</strong>.
                      </li>
                      <li>
                        <strong>Caché / emparejamiento en PC:</strong> si el SM-R860 aparece emparejado en{' '}
                        <em>Configuración de Bluetooth de Windows/macOS</em>, quítalo/olvídalo allí y conecta directo desde Chrome.
                      </li>
                      <li>
                        <strong>Sensor ocupado por Samsung Health:</strong> abre Samsung Health en el reloj, toca medir ritmo cardíaco una vez o cambia a medición continua para liberar el sensor óptico PPG.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleResubscribeBle()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-900/40 px-3 py-1.5 font-semibold text-amber-100 hover:bg-amber-800/50 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Re-suscribir 0x2A37</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleManualReadBle()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-[#0B0F19] px-3 py-1.5 font-semibold text-amber-100 hover:bg-slate-800 cursor-pointer"
                  >
                    <span>Probar readValue()</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <DeviceControlPanel
                connectionMode={connectionMode}
                currentBpm={currentBpm}
                latestContact={latestContactLabel}
                latestEnergyKj={latestSample?.energyExpendedKj ?? null}
                zoneInfo={zoneInfo}
                hrvMetrics={hrvMetrics}
                sessionStats={sessionStats}
                deviceMeta={deviceMeta}
                blePacketCount={blePacketCount}
                gattConfig={gattConfig}
                simulationPreset={simulationPreset}
                onStartSimulation={handleStartSimulation}
                onStopSimulation={handleStopSimulation}
                onScanAllBleDevices={() => void handleConnectBluetooth(true)}
                onResubscribeBle={() => void handleResubscribeBle()}
                onManualReadBle={() => void handleManualReadBle()}
                onChangeSimulationPreset={setSimulationPreset}
                onOpenUuidModal={() => setIsUuidModalOpen(true)}
                onExportCsv={handleExportCsv}
                onClearSession={handleClearSession}
                onOpenConnectionGuide={() => setActiveTab('connection')}
              />

              <div className="min-w-0 flex-1 space-y-5">
                <WaveformCanvas
                  currentBpm={currentBpm}
                  isStreaming={isStreaming}
                  strokeHex={zoneInfo?.strokeHex ?? '#FB7185'}
                  samples={samples}
                  maxHr={gattConfig.maxHr}
                />

                <BiometricsPanel
                  stressReading={activeStressReading}
                  hrvMetrics={hrvMetrics}
                />
              </div>
            </div>

            {/* Direct SM-R860 Connection Parameters Summary Strip */}
            <section className="rounded-xl border border-slate-800 bg-[#0B0F19] px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-100">
                    Parámetros de conexión directa BLE — Samsung Galaxy Watch4 (SM-R860)
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Lectura simultánea de Ritmo Cardíaco (0x180D), Estrés vía HRV (RR 0x2A37 / GATT) y Grasa Corporal BIA (0x181B / 0x2A9C).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connection')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer whitespace-nowrap"
                >
                  <span>Abrir ficha técnica y código</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-slate-400">Ritmo Cardíaco (Notify)</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-rose-400">
                    {formatShortUuidLabel(gattConfig.serviceUuid)} · {formatShortUuidLabel(gattConfig.characteristicUuid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Grasa Corporal (BIA Opc.)</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-cyan-300">
                    {formatShortUuidLabel(gattConfig.bodyCompServiceUuid)} · {formatShortUuidLabel(gattConfig.bodyCompCharUuid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Nivel de Estrés</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-200">
                    HRV RR · {formatShortUuidLabel(gattConfig.stressCharUuid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Batería / Sensor (Opc.)</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-200">
                    0x180F / 0x2A19 · 0x2A38
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {activeTab === 'connection' && (
          <ConnectionGuideView
            gattConfig={gattConfig}
            onOpenUuidModal={() => setIsUuidModalOpen(true)}
          />
        )}

        {activeTab === 'packets' && (
          <PacketInspectorView
            samples={samples}
            bodyComp={null}
            onExportCsv={handleExportCsv}
            onClearSession={handleClearSession}
          />
        )}
      </main>

      <UuidConfigModal
        isOpen={isUuidModalOpen}
        config={gattConfig}
        onClose={() => setIsUuidModalOpen(false)}
        onSave={setGattConfig}
      />
    </div>
  );
}
