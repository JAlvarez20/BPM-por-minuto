import { useState } from 'react';
import { Check, Copy, Settings2 } from 'lucide-react';
import type { GattTargetConfig } from '../types/bluetooth';
import {
  PAYLOAD_BYTE_MAP,
  SM_R860_GATT_TABLE,
  SM_R860_HARDWARE_SPECS,
  WEAR_OS_PERIPHERAL_SNIPPET,
  WEB_BLUETOOTH_SNIPPET,
} from '../utils/smR860Specs';

interface ConnectionGuideViewProps {
  gattConfig: GattTargetConfig;
  onOpenUuidModal: () => void;
}

export function ConnectionGuideView({
  gattConfig,
  onOpenUuidModal,
}: ConnectionGuideViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard fallback ignored gracefully
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro & Hardware Summary */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-50">
              Datos de conexión directa Bluetooth para Samsung SM-R860
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              El Samsung Galaxy Watch4 (<span className="font-mono text-slate-100">SM-R860</span>)
              se conecta directamente a esta interfaz mediante el estándar{' '}
              <span className="font-medium text-slate-100">Bluetooth Low Energy (BLE) GATT</span>{' '}
              usando el perfil oficial de ritmo cardíaco (<span className="font-mono">0x180D</span>).
              A continuación tienes todos los UUIDs, estructura binaria de bytes y requisitos
              del reloj para enlazarlo en tiempo real.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenUuidModal}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Personalizar UUIDs</span>
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          {SM_R860_HARDWARE_SPECS.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-slate-400">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-100">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* GATT Services & Characteristics Table */}
      <section className="rounded-xl border border-slate-800 bg-[#0B0F19] overflow-hidden">
        <div className="border-b border-slate-800/80 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-slate-100">
            UUIDs de Servicios y Características GATT (Perfil Heart Rate)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Objetivo activo actual: <span className="font-mono text-slate-200">{gattConfig.serviceUuid}</span> ·{' '}
            <span className="font-mono text-slate-200">{gattConfig.characteristicUuid}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-[#070A10] text-slate-400">
              <tr>
                <th className="px-6 py-3 font-medium">Elemento</th>
                <th className="px-4 py-3 font-medium">UUID Corto</th>
                <th className="px-4 py-3 font-medium">UUID Completo (128 bits)</th>
                <th className="px-4 py-3 font-medium">Propiedades</th>
                <th className="px-4 py-3 font-medium">Función</th>
                <th className="px-6 py-3 text-right font-medium">Copiar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {SM_R860_GATT_TABLE.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/25 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-slate-100">{row.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {row.role} · {row.required ? 'Obligatorio' : 'Opcional'}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-rose-400 whitespace-nowrap">
                    {row.shortUuid}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-200 whitespace-nowrap">
                    {row.fullUuid}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-cyan-300 whitespace-nowrap">
                    {row.properties}
                  </td>
                  <td className="px-4 py-3.5 text-slate-300 max-w-xs">
                    {row.description}
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleCopy(row.id, row.fullUuid)}
                      aria-label={`Copiar UUID de ${row.name}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      {copiedId === row.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-300">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Two-Column Split: SM-R860 Watch Requirements + Binary Payload Map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-6">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Requisitos importantes en el reloj SM-R860
          </h2>
          <ol className="mt-4 space-y-3.5 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-slate-100">1. Activar modo transmisor BLE (Heart for Bluetooth / HR Broadcast):</span>{' '}
              Por defecto, Wear OS no expone el servicio GATT <span className="font-mono text-rose-300">0x180D</span> en
              reposo. Usa <em>Heart for Bluetooth</em>, <em>Heart Rate Broadcast</em> o <em>HR2VP</em> en el reloj.
              Asegúrate de que la app esté transmitiendo activamente y mostrando tu BPM en la pantalla del SM-R860 antes de conectar.
            </li>
            <li>
              <span className="font-semibold text-slate-100">2. Navegador y contexto seguro (HTTPS):</span>{' '}
              Web Bluetooth requiere <span className="font-medium text-slate-100">Google Chrome, Microsoft Edge u Opera</span>{' '}
              en Windows, macOS, Linux o Android bajo HTTPS (o localhost). Safari / iOS no soportan Web Bluetooth de forma nativa.
            </li>
            <li>
              <span className="font-semibold text-slate-100">3. Permiso de sensores, pantalla activa y Samsung Health:</span>{' '}
              En el SM-R860 ve a <em>Ajustes → Aplicaciones → Permisos → Heart for Bluetooth</em> y activa{' '}
              <em>Sensores corporales</em> y batería <em>Sin restricciones</em> (si la pantalla se apaga, Wear OS pausa el sensor).
              Si el reloj marca 0 BPM, abre Samsung Health una vez para liberar el sensor óptico PPG.
            </li>
            <li>
              <span className="font-semibold text-slate-100">4. Conectar sin emparejar en Windows/macOS:</span>{' '}
              Si el reloj conecta pero no llegan paquetes 0x2A37, elimina el Galaxy Watch4 de{' '}
              <em>Configuración de Bluetooth de tu PC</em> (solo debe estar emparejado con tu teléfono) y usa el selector Bluetooth directo de esta página o el botón &quot;Re-suscribir 0x2A37&quot;.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#0B0F19] p-6">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Estructura binaria de la trama 0x2A37
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Cada notificación BLE entrega un buffer Little-Endian con la siguiente disposición de bytes:
          </p>

          <div className="mt-4 divide-y divide-slate-800/80 border-t border-slate-800/80">
            {PAYLOAD_BYTE_MAP.map((row) => (
              <div key={row.byteRange} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-rose-400">
                    {row.byteRange} · {row.field}
                  </span>
                  <span className="font-mono text-[11px] text-cyan-300">{row.type}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{row.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Code Snippets for Direct Web & Wear OS Integration */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-[#0B0F19] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Código Cliente Web Bluetooth (JavaScript)
            </h3>
            <button
              type="button"
              onClick={() => handleCopy('js-snippet', WEB_BLUETOOTH_SNIPPET)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {copiedId === 'js-snippet' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-300">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar JS</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-slate-200">
            <code>{WEB_BLUETOOTH_SNIPPET}</code>
          </pre>
        </section>

        <section className="rounded-xl border border-slate-800 bg-[#0B0F19] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Configuración GATT en Wear OS (SM-R860 Kotlin)
            </h3>
            <button
              type="button"
              onClick={() => handleCopy('kt-snippet', WEAR_OS_PERIPHERAL_SNIPPET)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {copiedId === 'kt-snippet' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-300">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar Kotlin</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-slate-200">
            <code>{WEAR_OS_PERIPHERAL_SNIPPET}</code>
          </pre>
        </section>
      </div>
    </div>
  );
}
