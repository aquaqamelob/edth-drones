import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-900 to-red-950 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-300 uppercase tracking-wider text-sm font-bold">System Active</span>
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
            <h2 className="text-xl font-bold mb-3">Railway Infrastructure Protection</h2>
            <p className="text-gray-300">
              Crowdsourcing system for detecting and reporting drone threats 
              along railway corridors. Data transmitted directly to SOK, 
              Police and ABW.
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
            <h3 className="text-xl font-bold mb-2">Report a Drone</h3>
            <p className="text-red-200 text-sm">
              Immediate report with full sensor data collection
            </p>
          </Link>

          <Link
            href="/qr"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">📱</div>
            <h3 className="text-xl font-bold mb-2">QR Generator</h3>
            <p className="text-gray-400 text-sm">
              Generate QR codes with geolocation for stickers along railways
            </p>
          </Link>

          <Link
            href="/dispatcher"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">🖥️</div>
            <h3 className="text-xl font-bold mb-2">Dispatcher Panel</h3>
            <p className="text-gray-400 text-sm">
              Dashboard for services - report clustering and alert forwarding
            </p>
          </Link>

          <Link
            href="/test"
            className="block bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-6 transition-colors"
          >
            <div className="text-3xl mb-3">🧪</div>
            <h3 className="text-xl font-bold mb-2">Sensor Test</h3>
            <p className="text-gray-400 text-sm">
              Check availability and operation of device sensors
            </p>
          </Link>
        </section>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">How the System Works</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">1</div>
              <div>
                <h3 className="font-bold">Scan QR Code</h3>
                <p className="text-sm text-gray-400">
                  QR codes on poles contain exact GPS location (Ground Truth), 
                  eliminating phone position uncertainty.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">2</div>
              <div>
                <h3 className="font-bold">Record 5-Second Clip</h3>
                <p className="text-sm text-gray-400">
                  System collects: video, audio (for FFT analysis), compass direction, 
                  gyroscope and accelerometer data, GPS location.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">3</div>
              <div>
                <h3 className="font-bold">Liveness Validation</h3>
                <p className="text-sm text-gray-400">
                  Phone motion analysis detects fake reports (tripod, 
                  automated reports). Real human hand is never perfectly stable.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">4</div>
              <div>
                <h3 className="font-bold">Clustering and Triangulation</h3>
                <p className="text-sm text-gray-400">
                  Multiple reports from the same area combine into one event. 
                  Directions from different positions allow triangulation of drone position.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center flex-shrink-0 font-bold">5</div>
              <div>
                <h3 className="font-bold">Automatic Escalation</h3>
                <p className="text-sm text-gray-400">
                  <span className="text-green-400">GREEN</span> = log / 
                  <span className="text-yellow-400"> YELLOW</span> = City Guard / 
                  <span className="text-red-400"> RED</span> = SOK + ABW
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Specs */}
        <section className="bg-zinc-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Collected Data</h2>
          
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-bold text-red-400 mb-2">Media</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Video 5s (back camera, 1080p)</li>
                <li>• Audio 48kHz (no noise reduction)</li>
                <li>• Frames every 500ms (JPEG)</li>
                <li>• First frame thumbnail</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Sensors</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Gyroscope (rotationRate α/β/γ)</li>
                <li>• Accelerometer (with and without gravity)</li>
                <li>• Magnetometer (compass)</li>
                <li>• GPS (continuous tracking)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Device Metadata</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• User Agent, platform</li>
                <li>• Screen resolution</li>
                <li>• Connection type and quality</li>
                <li>• Battery level</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-red-400 mb-2">Validation</h3>
              <ul className="space-y-1 text-gray-400">
                <li>• Liveness check (phone motion)</li>
                <li>• Drone audio signature (FFT)</li>
                <li>• Unique device ID</li>
                <li>• Report session ID</li>
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
