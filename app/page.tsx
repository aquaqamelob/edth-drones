import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-900 to-red-950 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-300 uppercase tracking-wider text-sm font-bold">System Aktywny</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">EDTH Defense Network</h1>
          <p className="text-red-200">
            Distributed Drone Threat Detection for Critical Infrastructure
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        {/* Mission Statement */}
        <section className="mb-12">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-red-900/30">
            <h2 className="text-xl font-bold mb-3">Ochrona Infrastruktury Kolejowej</h2>
            <p className="text-gray-300">
              System crowdsourcingowy do wykrywania i raportowania zagrożeń dronowych 
              wzdłuż korytarzy kolejowych. Dane przekazywane bezpośrednio do SOK, 
              Policji i ABW.
            </p>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid md:grid-cols-2 gap-4 mb-12">
          <Link
            href="/report"
            className="block bg-red-600 hover:bg-red-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-xl font-bold mb-2">Zgłoś Drona</h3>
            <p className="text-red-200 text-sm">
              Natychmiastowe zgłoszenie z pełnym zbieraniem danych sensorowych
            </p>
          </Link>

          <Link
            href="/qr"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">📱</div>
            <h3 className="text-xl font-bold mb-2">Generator QR</h3>
            <p className="text-gray-400 text-sm">
              Generuj kody QR z geolokalizacją do naklejek wzdłuż torów
            </p>
          </Link>

          <Link
            href="/dispatcher"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">🖥️</div>
            <h3 className="text-xl font-bold mb-2">Panel Dyspozytora</h3>
            <p className="text-gray-400 text-sm">
              Dashboard dla służb - klastering zgłoszeń i przekazywanie alertów
            </p>
          </Link>

          <Link
            href="/test"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">🧪</div>
            <h3 className="text-xl font-bold mb-2">Test Sensorów</h3>
            <p className="text-gray-400 text-sm">
              Sprawdź dostępność i działanie czujników urządzenia
            </p>
          </Link>
        </section>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Jak Działa System</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <div>
                <h3 className="font-bold">Skanuj Kod QR</h3>
                <p className="text-sm text-gray-400">
                  Kody QR na słupach zawierają dokładną lokalizację GPS (Ground Truth), 
                  eliminując niepewność pozycji telefonu.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <div>
                <h3 className="font-bold">Nagraj 5-sekundowy Klip</h3>
                <p className="text-sm text-gray-400">
                  System zbiera: wideo, audio (do analizy FFT), kierunek kompasu, 
                  dane żyroskopu i akcelerometru, lokalizację GPS.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">3</div>
              <div>
                <h3 className="font-bold">Walidacja Liveness</h3>
                <p className="text-sm text-gray-400">
                  Analiza ruchu telefonu wykrywa fałszywe zgłoszenia (statyw, 
                  automatyczne zgłoszenia). Prawdziwa ludzka ręka nie jest nigdy idealnie stabilna.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">4</div>
              <div>
                <h3 className="font-bold">Klastering i Triangulacja</h3>
                <p className="text-sm text-gray-400">
                  Wiele zgłoszeń z tego samego obszaru łączy się w jedno zdarzenie. 
                  Kierunki z różnych pozycji pozwalają na triangulację pozycji drona.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">5</div>
              <div>
                <h3 className="font-bold">Automatyczna Eskalacja</h3>
                <p className="text-sm text-gray-400">
                  <span className="text-green-400">GREEN</span> = log / 
                  <span className="text-yellow-400"> YELLOW</span> = Straż Miejska / 
                  <span className="text-red-400"> RED</span> = SOK + ABW
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Specs */}
        <section className="bg-zinc-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Zbierane Dane</h2>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-bold text-red-400 mb-2">Media</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Wideo 5s (back camera, 1080p)</li>
                <li>• Audio 48kHz (bez redukcji szumów)</li>
                <li>• Klatki co 500ms (JPEG)</li>
                <li>• Miniatura pierwszej klatki</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Sensory</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Żyroskop (rotationRate α/β/γ)</li>
                <li>• Akcelerometr (z i bez grawitacji)</li>
                <li>• Magnetometr (kompas)</li>
                <li>• GPS (ciągłe śledzenie)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Metadane Urządzenia</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• User Agent, platforma</li>
                <li>• Rozdzielczość ekranu</li>
                <li>• Typ i jakość połączenia</li>
                <li>• Poziom baterii</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Walidacja</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Liveness check (ruch telefonu)</li>
                <li>• Sygnatura audio drona (FFT)</li>
                <li>• Unikalny ID urządzenia</li>
                <li>• ID sesji zgłoszenia</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-zinc-800 text-center text-sm text-gray-600">
          <p>EDTH Drone Defense Network v1.0</p>
          <p className="mt-1">Critical Infrastructure Protection System</p>
        </footer>
      </main>
    </div>
  );
}
