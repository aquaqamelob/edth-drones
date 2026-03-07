'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2">No Connection</h1>
      <p className="text-gray-400 mb-6 max-w-xs">
        The application requires an internet connection to submit reports.
      </p>

      <p className="text-sm text-gray-600 mb-6">
        Reports made without a connection will be automatically sent once internet is restored.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
      >
        Refresh Page
      </button>
    </div>
  );
}
