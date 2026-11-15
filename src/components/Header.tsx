import { Bluetooth, BluetoothOff } from 'lucide-react';
import type { ActiveTab, ConnectionMode } from '../types/bluetooth';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  connectionMode: ConnectionMode;
  onPrimaryBluetoothAction: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'monitor', label: 'Monitor en vivo' },
  { id: 'connection', label: 'Datos de conexión' },
  { id: 'packets', label: 'Paquetes y registro' },
];

export function Header({
  activeTab,
  onSelectTab,
  connectionMode,
  onPrimaryBluetoothAction,
}: HeaderProps) {
  const isBleConnected = connectionMode === 'ble-live';
  const isConnecting = connectionMode === 'connecting';

  return (
    <header className="border-b border-slate-800/90 bg-[#0A0E17]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3.5 md:gap-8 md:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('monitor')}
          className="font-display text-base md:text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 hover:text-rose-300 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500 cursor-pointer"
        >
          CardioBLE SM-R860
        </button>

        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500 ${
                  isActive
                    ? 'text-slate-50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-rose-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryBluetoothAction}
            disabled={isConnecting}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-60 disabled:cursor-wait ${
              isBleConnected
                ? 'border border-slate-700 bg-slate-800/90 text-slate-100 hover:bg-slate-700'
                : 'bg-rose-600 text-white hover:bg-rose-500'
            }`}
          >
            {isBleConnected ? (
              <>
                <BluetoothOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Desconectar reloj</span>
              </>
            ) : (
              <>
                <Bluetooth className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isConnecting ? 'Emparejando...' : 'Conectar Bluetooth'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation row */}
      <nav
        aria-label="Navegación móvil"
        className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-800/80 px-6 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1 ${
                isActive ? 'text-rose-400 border-b border-rose-500' : 'text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
