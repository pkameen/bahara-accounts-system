import { usePwa } from "../context/PwaContext";
import { FiWifiOff, FiRefreshCw, FiDownload } from "react-icons/fi";


export function OnlineOfflineBadge() {
  const { isOnline } = usePwa();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
          : "bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm animate-pulse"
      }`}
      title={isOnline ? "Connected to live servers" : "Offline - live data may be unavailable"}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-amber-500"
        }`}
      />
      <span>{isOnline ? "Online" : "Offline"}</span>
    </div>
  );
}

export function InstallAppButton({ className = "" }) {
  const { isInstallable, installApp } = usePwa();

  if (!isInstallable) return null;

  return (
    <button
      onClick={installApp}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B89428] text-black font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer ${className}`}
      title="Install Bahara International App"
    >
      <FiDownload className="text-base" />
      <span>Install App</span>
    </button>
  );
}

export default function PwaBanner() {
  const { isOnline, needRefresh, updateServiceWorker, closeUpdateNotice } = usePwa();

  return (
    <div className="w-full">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 mx-auto text-center sm:text-left">
            <FiWifiOff className="text-amber-600 text-base shrink-0 animate-bounce" />
            <span>
              You are currently offline. Live data and saved operations may be unavailable.
            </span>
          </div>
        </div>
      )}

      {/* SW Update Available Banner */}
      {needRefresh && (
        <div className="bg-[#111111] border-b border-[#D4AF37]/30 text-white px-4 py-3 flex items-center justify-between text-xs sm:text-sm backdrop-blur-md shadow-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <FiRefreshCw className="text-[#D4AF37] text-lg animate-spin" />
            <span className="font-semibold">
              A new version of Bahara Accounts System is ready.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3.5 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:bg-white transition-colors cursor-pointer"
            >
              Update Now
            </button>
            <button
              onClick={closeUpdateNotice}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white text-xs transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
