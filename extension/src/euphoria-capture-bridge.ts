(() => {
  const CAPTURE_REQUEST = "GROVE_EUPHORIA_CAPTURE";
  const CAPTURE_RESULT = "GROVE_EUPHORIA_CAPTURE_RESULT";
  const bridgeScript = document.currentScript as HTMLScriptElement | null;
  const extensionBase = bridgeScript?.src.replace(/dist\/euphoria-capture-bridge\.js(?:\?.*)?$/, "") ?? "";

  let html2canvasPromise: Promise<void> | null = null;

  function loadHtml2canvas() {
    if ((window as any).html2canvas) return Promise.resolve();
    if (html2canvasPromise) return html2canvasPromise;

    html2canvasPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      if (!extensionBase) {
        reject(new Error("Missing extension base URL"));
        return;
      }

      script.src = `${extensionBase}dist/html2canvas.min.js`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(script);
    });

    return html2canvasPromise;
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.type !== CAPTURE_REQUEST) return;

    const requestId = event.data.requestId as string;

    try {
      const captureEl = document.getElementById(event.data.captureId as string);
      if (!captureEl) throw new Error("No capture element found");

      await loadHtml2canvas();

      const canvas = await (window as any).html2canvas(captureEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const dataUrl = canvas.toDataURL("image/png");
      window.postMessage({
        type: CAPTURE_RESULT,
        requestId,
        ok: true,
        image: dataUrl.split(",")[1],
      }, "*");
    } catch (err) {
      window.postMessage({
        type: CAPTURE_RESULT,
        requestId,
        ok: false,
        error: err instanceof Error ? err.message : "Capture failed",
      }, "*");
    }
  });
})();
