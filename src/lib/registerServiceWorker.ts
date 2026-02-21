export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      const activateUpdate = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      };

      if (registration.waiting) {
        activateUpdate();
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            activateUpdate();
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const refreshRegistration = () => {
        registration.update().catch((error) => {
          console.error("Service worker update check failed", error);
        });
      };

      setInterval(refreshRegistration, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          refreshRegistration();
        }
      });
    } catch (error) {
      console.error("Service worker registration failed", error);
    }
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}
