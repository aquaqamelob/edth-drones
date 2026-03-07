'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface QRCodeData {
  lat: number;
  lng: number;
  qrId: string;
  name?: string;
}

export default function QRGeneratorPage() {
  const [locations, setLocations] = useState<QRCodeData[]>([]);
  const [baseUrl, setBaseUrl] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newName, setNewName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  
  useEffect(() => {
    // Set base URL from window location
    if (typeof window !== 'undefined') {
      setBaseUrl(`${window.location.origin}/report`);
    }
  }, []);

  const generateQRId = () => {
    return `qr_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  };

  const addLocation = useCallback(() => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Nieprawidłowe współrzędne');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Współrzędne poza zakresem');
      return;
    }

    setLocations(prev => [...prev, {
      lat,
      lng,
      qrId: generateQRId(),
      name: newName || `Punkt ${prev.length + 1}`,
    }]);

    setNewLat('');
    setNewLng('');
    setNewName('');
  }, [newLat, newLng, newName]);

  const addBulkLocations = useCallback(() => {
    // Parse CSV or line-separated coordinates
    // Format: lat,lng,name (name optional)
    const lines = bulkInput.trim().split('\n');
    const newLocations: QRCodeData[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 2) continue;

      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const name = parts[2] || `Punkt ${locations.length + newLocations.length + 1}`;

      if (!isNaN(lat) && !isNaN(lng)) {
        newLocations.push({
          lat,
          lng,
          qrId: generateQRId(),
          name,
        });
      }
    }

    setLocations(prev => [...prev, ...newLocations]);
    setBulkInput('');
  }, [bulkInput, locations.length]);

  const removeLocation = (qrId: string) => {
    setLocations(prev => prev.filter(l => l.qrId !== qrId));
  };

  const getReportUrl = (loc: QRCodeData) => {
    return `${baseUrl}?lat=${loc.lat}&lng=${loc.lng}&qr=${loc.qrId}`;
  };

  const getQRImageUrl = (data: string) => {
    // Using QR Server API - replace with local generation in production
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
  };

  const downloadAllQRCodes = async () => {
    // Create a simple HTML page with all QR codes for printing
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EDTH Sieć Obronna - Kody QR</title>
  <style>
    body { font-family: Arial, sans-serif; }
    .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; }
    .qr-item { border: 2px solid #dc2626; padding: 15px; text-align: center; page-break-inside: avoid; }
    .qr-item img { width: 200px; height: 200px; }
    .qr-title { font-weight: bold; font-size: 14px; margin: 10px 0 5px; }
    .qr-coords { font-size: 11px; color: #666; font-family: monospace; }
    .qr-label { background: #dc2626; color: white; padding: 5px 10px; font-weight: bold; font-size: 12px; margin-top: 10px; }
    @media print { .qr-grid { grid-template-columns: repeat(3, 1fr); } }
  </style>
</head>
<body>
  <h1 style="text-align: center; color: #dc2626;">EDTH Sieć Obrony Przed Dronami - Kody QR</h1>
  <div class="qr-grid">
    ${locations.map(loc => `
      <div class="qr-item">
        <img src="${getQRImageUrl(getReportUrl(loc))}" alt="Kod QR">
        <div class="qr-title">${loc.name}</div>
        <div class="qr-coords">${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}</div>
        <div class="qr-label">ZGŁOŚ DRONA</div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edth-qr-codes.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const csv = [
      'name,latitude,longitude,qr_id,report_url',
      ...locations.map(loc => 
        `"${loc.name}",${loc.lat},${loc.lng},${loc.qrId},"${getReportUrl(loc)}"`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edth-qr-locations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <header className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-red-500 mb-2">Generator Kodów QR</h1>
        <p className="text-gray-400">
          Generuj kody QR z zakodowaną lokalizacją do umieszczenia wzdłuż infrastruktury kolejowej
        </p>
      </header>

      <main className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          {/* Single Location */}
          <div className="bg-zinc-900 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Dodaj Pojedynczy Punkt</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Szerokość (lat)</label>
                  <input
                    type="text"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    placeholder="52.2297"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Długość (lng)</label>
                  <input
                    type="text"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    placeholder="21.0122"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nazwa punktu (opcjonalna)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="KM 12.5 - Słup 47"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none"
                />
              </div>

              <button
                onClick={addLocation}
                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
              >
                Dodaj Punkt
              </button>
            </div>
          </div>

          {/* Bulk Import */}
          <div className="bg-zinc-900 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Import Zbiorczy (CSV)</h2>
            <p className="text-sm text-gray-400 mb-3">
              Format: szerokość,długość,nazwa (każdy punkt w nowej linii)
            </p>
            
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="52.2297,21.0122,Punkt A&#10;52.2305,21.0150,Punkt B&#10;52.2280,21.0095,Punkt C"
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none font-mono text-sm"
            />

            <button
              onClick={addBulkLocations}
              className="w-full mt-3 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition-colors"
            >
              Importuj Punkty
            </button>
          </div>

          {/* Base URL Config */}
          <div className="bg-zinc-900 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-4">Konfiguracja URL</h2>
            <label className="block text-sm text-gray-400 mb-1">Bazowy URL aplikacji</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:border-red-500 focus:outline-none font-mono text-sm"
            />
          </div>
        </div>

        {/* QR Code Preview */}
        <div className="space-y-6">
          {/* Actions */}
          {locations.length > 0 && (
            <div className="flex gap-4">
              <button
                onClick={downloadAllQRCodes}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
              >
                📥 Pobierz Wszystkie QR (HTML)
              </button>
              <button
                onClick={exportCSV}
                className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-bold transition-colors"
              >
                📄 Eksport CSV
              </button>
            </div>
          )}

          {/* QR Codes List */}
          <div className="space-y-4">
            {locations.length === 0 ? (
              <div className="bg-zinc-900 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📍</div>
                <p className="text-gray-400">Dodaj punkty, aby wygenerować kody QR</p>
              </div>
            ) : (
              locations.map((loc) => (
                <QRCodePreview
                  key={loc.qrId}
                  location={loc}
                  url={getReportUrl(loc)}
                  onRemove={() => removeLocation(loc.qrId)}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function QRCodePreview({
  location,
  url,
  onRemove,
}: {
  location: QRCodeData;
  url: string;
  onRemove: () => void;
}) {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 flex gap-4">
      <div className="flex-shrink-0">
        <img
          src={qrImageUrl}
          alt="QR Code"
          className="w-32 h-32 rounded-lg bg-white"
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg truncate">{location.name}</h3>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-400 flex-shrink-0"
          >
            ✕
          </button>
        </div>
        
        <p className="text-sm text-gray-400 font-mono mt-1">
          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
        </p>
        
        <p className="text-xs text-gray-600 font-mono mt-1 break-all">
          ID: {location.qrId}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(url)}
            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            📋 Kopiuj URL
          </button>
          <a
            href={qrImageUrl}
            download={`qr-${location.qrId}.png`}
            className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            📥 Pobierz PNG
          </a>
        </div>
      </div>
    </div>
  );
}
