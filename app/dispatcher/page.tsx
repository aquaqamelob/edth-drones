'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReportCluster {
  id: string;
  lat: number;
  lng: number;
  reportCount: number;
  devices: string[];
  firstReport: number;
  lastReport: number;
  audioConfirmed: boolean;
  threatLevel: 'GREEN' | 'YELLOW' | 'RED';
  nearestRailway: string | null;
  distanceToRailway: number | null;
}

interface DashboardStats {
  totalReports24h: number;
  activeIncidents: number;
  criticalAlerts: number;
  avgResponseTime: number;
}

export default function DispatcherPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [clusters, setClusters] = useState<ReportCluster[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalReports24h: 0,
    activeIncidents: 0,
    criticalAlerts: 0,
    avgResponseTime: 0,
  });
  const [selectedCluster, setSelectedCluster] = useState<ReportCluster | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Simulate real-time data for demo
  useEffect(() => {
    if (!isAuthenticated) return;

    // Generate mock data for demonstration
    const generateMockClusters = (): ReportCluster[] => {
      return [
        {
          id: 'cluster_1',
          lat: 52.2204,
          lng: 20.9661,
          reportCount: 3,
          devices: ['dev_a', 'dev_b', 'dev_c'],
          firstReport: Date.now() - 180000,
          lastReport: Date.now() - 60000,
          audioConfirmed: true,
          threatLevel: 'RED',
          nearestRailway: 'Warsaw Zachodnia',
          distanceToRailway: 35,
        },
        {
          id: 'cluster_2',
          lat: 52.2319,
          lng: 21.0067,
          reportCount: 1,
          devices: ['dev_d'],
          firstReport: Date.now() - 300000,
          lastReport: Date.now() - 300000,
          audioConfirmed: false,
          threatLevel: 'GREEN',
          nearestRailway: 'Warsaw Centralna',
          distanceToRailway: 450,
        },
      ];
    };

    setClusters(generateMockClusters());
    setStats({
      totalReports24h: 47,
      activeIncidents: 2,
      criticalAlerts: 1,
      avgResponseTime: 4.2,
    });
    setLastUpdate(new Date());

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      setClusters(generateMockClusters());
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = () => {
    // Simple demo auth - replace with real auth in production
    if (apiKey.length > 0) {
      setIsAuthenticated(true);
    }
  };

  const handleForwardToSOK = async (cluster: ReportCluster) => {
    // In production, this would send to SOK system
    alert(`Alert przekazany do SOK!\nID: ${cluster.id}\nLokalizacja: ${cluster.nearestRailway}`);
  };

  const handleDismiss = (clusterId: string) => {
    setClusters(prev => prev.filter(c => c.id !== clusterId));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <h1 className="text-xl font-bold text-white">EDTH Dispatcher Console</h1>
          </div>
          
          <p className="text-gray-400 text-sm text-center mb-6">
            Panel dla autoryzowanych dyspozytorów SOK/ABW
          </p>

          <div className="space-y-4">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Klucz API"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white transition-colors"
            >
              Zaloguj
            </button>
          </div>

          <p className="text-xs text-gray-600 text-center mt-4">
            Demo: wpisz dowolny klucz aby kontynuować
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold">EDTH Dispatcher Console</span>
            <span className="text-xs text-gray-500">|</span>
            <span className="text-xs text-gray-400">
              Ostatnia aktualizacja: {lastUpdate?.toLocaleTimeString('pl-PL')}
            </span>
          </div>
          
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-sm text-gray-400 hover:text-white"
          >
            Wyloguj
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-6 py-3">
        <div className="flex gap-8">
          <div>
            <span className="text-gray-500 text-xs">Zgłoszenia 24h</span>
            <div className="text-2xl font-bold">{stats.totalReports24h}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Aktywne Incydenty</span>
            <div className="text-2xl font-bold text-yellow-400">{stats.activeIncidents}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Alerty Krytyczne</span>
            <div className="text-2xl font-bold text-red-500">{stats.criticalAlerts}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Śr. Czas Reakcji</span>
            <div className="text-2xl font-bold">{stats.avgResponseTime}min</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-140px)]">
        {/* Incidents List */}
        <div className="w-96 border-r border-zinc-800 overflow-auto">
          <div className="p-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
              Aktywne Incydenty
            </h2>
            
            {clusters.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                Brak aktywnych incydentów
              </div>
            ) : (
              <div className="space-y-3">
                {clusters.map((cluster) => (
                  <IncidentCard
                    key={cluster.id}
                    cluster={cluster}
                    isSelected={selectedCluster?.id === cluster.id}
                    onSelect={() => setSelectedCluster(cluster)}
                    onForward={() => handleForwardToSOK(cluster)}
                    onDismiss={() => handleDismiss(cluster.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map / Detail View */}
        <div className="flex-1 bg-zinc-900 relative">
          {selectedCluster ? (
            <IncidentDetail cluster={selectedCluster} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <p>Wybierz incydent aby zobaczyć szczegóły</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function IncidentCard({
  cluster,
  isSelected,
  onSelect,
  onForward,
  onDismiss,
}: {
  cluster: ReportCluster;
  isSelected: boolean;
  onSelect: () => void;
  onForward: () => void;
  onDismiss: () => void;
}) {
  const getThreatColor = (level: string) => {
    switch (level) {
      case 'RED': return 'border-red-500 bg-red-950/30';
      case 'YELLOW': return 'border-yellow-500 bg-yellow-950/30';
      default: return 'border-green-500 bg-green-950/30';
    }
  };

  const getAge = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'teraz';
    if (minutes < 60) return `${minutes}min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${getThreatColor(cluster.threatLevel)} ${
        isSelected ? 'ring-2 ring-white' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            cluster.threatLevel === 'RED' ? 'bg-red-600' :
            cluster.threatLevel === 'YELLOW' ? 'bg-yellow-600' : 'bg-green-600'
          }`}>
            {cluster.threatLevel}
          </span>
          {cluster.audioConfirmed && (
            <span className="text-xs ml-2 text-purple-400">🔊 Audio</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{getAge(cluster.lastReport)}</span>
      </div>

      <h3 className="font-bold mb-1">{cluster.nearestRailway}</h3>
      <p className="text-sm text-gray-400 mb-2">
        {cluster.distanceToRailway}m od torów • {cluster.reportCount} zgłoszeń
      </p>

      <div className="flex gap-2 mt-3">
        {cluster.threatLevel === 'RED' && (
          <button
            onClick={(e) => { e.stopPropagation(); onForward(); }}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-colors"
          >
            Przekaż do SOK
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function IncidentDetail({ cluster }: { cluster: ReportCluster }) {
  return (
    <div className="p-6">
      <div className="bg-zinc-800 rounded-xl p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">{cluster.nearestRailway}</h2>
        <p className="text-gray-400">
          {cluster.lat.toFixed(6)}, {cluster.lng.toFixed(6)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm text-gray-400 mb-1">Zgłoszenia</h3>
          <p className="text-3xl font-bold">{cluster.reportCount}</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm text-gray-400 mb-1">Urządzenia</h3>
          <p className="text-3xl font-bold">{cluster.devices.length}</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm text-gray-400 mb-1">Odległość od Torów</h3>
          <p className="text-3xl font-bold">{cluster.distanceToRailway}m</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-4">
          <h3 className="text-sm text-gray-400 mb-1">Audio Potwierdzone</h3>
          <p className="text-3xl font-bold">{cluster.audioConfirmed ? '✓' : '—'}</p>
        </div>
      </div>

      <div className="bg-zinc-800 rounded-xl p-4 mb-6">
        <h3 className="text-sm text-gray-400 mb-3">Timeline</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Pierwsze zgłoszenie:</span>
            <span className="font-mono">{new Date(cluster.firstReport).toLocaleTimeString('pl-PL')}</span>
          </div>
          <div className="flex justify-between">
            <span>Ostatnie zgłoszenie:</span>
            <span className="font-mono">{new Date(cluster.lastReport).toLocaleTimeString('pl-PL')}</span>
          </div>
        </div>
      </div>

      {/* Placeholder for map */}
      <div className="bg-zinc-800 rounded-xl h-64 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <div className="text-4xl mb-2">🗺️</div>
          <p>Mapa z triangulacją pozycji drona</p>
          <p className="text-sm">(Integracja z Mapbox/Leaflet)</p>
        </div>
      </div>
    </div>
  );
}
