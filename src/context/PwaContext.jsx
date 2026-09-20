/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const PwaContext = createContext();

export function PwaProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Register Service Worker with vite-plugin-pwa update prompt
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("PWA SW Registered:", r);
    },
    onRegisterError(error) {
      console.error("PWA SW Registration Error:", error);
    },
  });

  useEffect(() => {
    // Online / Offline tracking
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Standard W3C Standalone mode check
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      setIsStandalone(!!isStandaloneMode);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleMediaChange = (e) => setIsStandalone(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    }

    // Standard PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser default mini-infobar and save prompt
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Clear prompt if PWA installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log("Bahara International PWA installed successfully");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to PWA install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  const closeUpdateNotice = () => {
    setNeedRefresh(false);
  };

  return (
    <PwaContext.Provider
      value={{
        isOnline,
        isInstallable: !!deferredPrompt && !isStandalone,
        isStandalone,
        installApp,
        needRefresh,
        updateServiceWorker,
        closeUpdateNotice,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
}
