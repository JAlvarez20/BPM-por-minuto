import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCardiacZone,
  computeHrvMetrics,
  computeSessionStats,
  decodeBodySensorLocation,
  encodeHeartRateMeasurement,
  extractCharacteristicProperties,
  formatDurationClock,
  formatSamplesToCsv,
  formatShortUuidLabel,
  normalizeGattUuid,
  parseHeartRateMeasurement,
} from './bleHeartRate';

test('normalizeGattUuid expands 16-bit and 32-bit hex UUIDs and validates full 128-bit UUIDs', () => {
  assert.equal(normalizeGattUuid('0x180D'), '0000180d-0000-1000-8000-00805f9b34fb');
  assert.equal(normalizeGattUuid('2a37'), '00002a37-0000-1000-8000-00805f9b34fb');
  assert.equal(
    normalizeGattUuid('0000180D-0000-1000-8000-00805F9B34FB'),
    '0000180d-0000-1000-8000-00805f9b34fb'
  );
  assert.equal(normalizeGattUuid('not-a-uuid'), null);
  assert.equal(formatShortUuidLabel('00002a37-0000-1000-8000-00805f9b34fb'), '0x2A37');
  assert.deepEqual(
    extractCharacteristicProperties({ notify: true, read: true, write: false }),
    ['notify', 'read']
  );
  assert.deepEqual(extractCharacteristicProperties(undefined), []);
});

test('parseHeartRateMeasurement decodes 8-bit BPM, sensor contact, energy, and RR-intervals', () => {
  // Flags: 0x1E = 0001 1110 -> UINT8 (0), Contact supported & detected (3 -> 0x06), Energy (0x08), RR (0x10)
  // BPM = 74 (0x4A), Energy = 420 kJ (0xA4, 0x01 LE), RR = 830 / 1024 s => ~810.5 ms (0x3E, 0x03 LE = 830)
  const buf = new ArrayBuffer(6);
  const view = new DataView(buf);
  view.setUint8(0, 0x1e);
  view.setUint8(1, 74);
  view.setUint16(2, 420, true);
  view.setUint16(4, 830, true);

  const parsed = parseHeartRateMeasurement(view, 1700000000000);
  assert.equal(parsed.bpm, 74);
  assert.equal(parsed.format, 'uint8');
  assert.equal(parsed.sensorContact, 'contact');
  assert.equal(parsed.energyExpendedKj, 420);
  assert.equal(parsed.rrIntervalsMs.length, 1);
  assert.equal(parsed.rrIntervalsMs[0], 810.5);
  assert.equal(parsed.rawHex, '1E 4A A4 01 3E 03');
});

test('parseHeartRateMeasurement decodes 16-bit BPM and no-contact flag', () => {
  // Flags: 0x05 = 0000 0101 -> UINT16 (1), Contact supported & NO contact (2 -> 0x04)
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, 0x05);
  view.setUint16(1, 265, true);

  const parsed = parseHeartRateMeasurement(view, 1700000000000);
  assert.equal(parsed.bpm, 265);
  assert.equal(parsed.format, 'uint16');
  assert.equal(parsed.sensorContact, 'no-contact');
  assert.equal(parsed.energyExpendedKj, null);
  assert.deepEqual(parsed.rrIntervalsMs, []);
});

test('encodeHeartRateMeasurement roundtrips accurately through parseHeartRateMeasurement', () => {
  const encoded = encodeHeartRateMeasurement(132, [455, 460], true, 125);
  const decoded = parseHeartRateMeasurement(encoded, 12345);
  assert.equal(decoded.bpm, 132);
  assert.equal(decoded.sensorContact, 'contact');
  assert.equal(decoded.energyExpendedKj, 125);
  assert.equal(decoded.rrIntervalsMs.length, 2);
  assert.ok(Math.abs(decoded.rrIntervalsMs[0] - 455) < 1.5);
  assert.ok(Math.abs(decoded.rrIntervalsMs[1] - 460) < 1.5);
});

test('computeHrvMetrics calculates RMSSD, SDNN, and pNN50 accurately', () => {
  const metrics = computeHrvMetrics([800, 860, 810, 870, 820]);
  assert.equal(metrics.sampleCount, 5);
  assert.equal(metrics.meanRrMs, 832);
  assert.ok(metrics.rmssdMs !== null && metrics.rmssdMs > 50);
  assert.ok(metrics.sdnnMs !== null && metrics.sdnnMs > 25);
  assert.equal(metrics.pnn50Percent, 50);
});

test('computeCardiacZone classifies HR zones properly', () => {
  assert.equal(computeCardiacZone(95, 190).index, 1);
  assert.equal(computeCardiacZone(120, 190).index, 2);
  assert.equal(computeCardiacZone(142, 190).index, 3);
  assert.equal(computeCardiacZone(160, 190).index, 4);
  assert.equal(computeCardiacZone(180, 190).index, 5);
});

test('computeSessionStats, formatDurationClock, decodeBodySensorLocation, and CSV export', () => {
  assert.equal(decodeBodySensorLocation(2), 'Muñeca (Wrist)');
  assert.equal(formatDurationClock(125), '02:05');
  assert.equal(formatDurationClock(3665), '01:01:05');

  const packetA = parseHeartRateMeasurement(encodeHeartRateMeasurement(68, [880], true), 1000);
  const packetB = parseHeartRateMeasurement(encodeHeartRateMeasurement(82, [730], true), 6000);
  const samples = [
    { ...packetA, id: '1', source: 'simulated' as const, zoneIndex: 1, zoneLabel: 'Z1 Recup.', stressScore: 22 },
    { ...packetB, id: '2', source: 'simulated' as const, zoneIndex: 2, zoneLabel: 'Z2 Base', stressScore: 45 },
  ];

  const stats = computeSessionStats(samples);
  assert.equal(stats.minBpm, 68);
  assert.equal(stats.maxBpm, 82);
  assert.equal(stats.avgBpm, 75);
  assert.equal(stats.totalSamples, 2);
  assert.equal(stats.durationSec, 5);

  const csv = formatSamplesToCsv(samples);
  assert.ok(
    csv.includes('timestamp_iso,bpm,zona,nivel_estres,contacto_sensor,origen,trama_hex')
  );
  assert.ok(!csv.includes('rr_intervals_ms'));
  assert.ok(!csv.includes('energia_kj'));
  assert.ok(!csv.includes('grasa_corporal_pct'));
  assert.ok(!csv.includes('peso_kg'));
  assert.ok(!csv.includes('altura_cm'));
  assert.ok(!csv.includes('imc_kg_m2'));
  assert.ok(csv.includes(',68,"Z1 Recup.",22,contact,simulated,'));
  assert.ok(csv.includes(',82,"Z2 Base",45,contact,simulated,'));
});
