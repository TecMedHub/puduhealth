// Captura de PPG con la cámara trasera y la linterna, o con una señal de prueba sintética.
// Entrega muestras { t (s), r, g, b }: promedio RGB de la zona central de cada cuadro.

export async function abrirCamara(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin-camara');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 }, facingMode: { ideal: 'environment' } },
  });
  video.srcObject = stream;
  await video.play();
  const track = stream.getVideoTracks()[0];
  const caps = track.getCapabilities?.() ?? {};
  let linterna = false;
  if (caps.torch) {
    try {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      linterna = true;
    } catch { /* sin linterna */ }
  }
  return { stream, track, caps, linterna };
}

// Espera a que la exposición automática se ajuste a la linterna y la fija (si el equipo lo permite).
export async function fijarExposicion(cam) {
  await new Promise((r) => setTimeout(r, 1500));
  const s = cam.track.getSettings();
  const fijar = async (modo, extra = {}) => {
    if (!cam.caps[modo]?.includes?.('manual')) return;
    try { await cam.track.applyConstraints({ advanced: [{ [modo]: 'manual', ...extra }] }); } catch { /* opcional */ }
  };
  await fijar('exposureMode', s.exposureTime ? { exposureTime: s.exposureTime } : {});
  await fijar('whiteBalanceMode', s.colorTemperature ? { colorTemperature: s.colorTemperature } : {});
  await fijar('focusMode');
}

export function cerrarCamara(cam) {
  cam?.stream?.getTracks().forEach((t) => t.stop());
}

export function capturarCuadros(video, alMuestra) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 40;
  lienzo.height = 30;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const conRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  let activo = true;
  let ultimo = -1;

  const paso = (ahora) => {
    if (!activo) return;
    // Con requestVideoFrameCallback hay exactamente una llamada por cuadro nuevo.
    if (video.videoWidth && (conRVFC || video.currentTime !== ultimo)) {
      ultimo = video.currentTime;
      const w = video.videoWidth;
      const h = video.videoHeight;
      ctx.drawImage(video, w * 0.25, h * 0.25, w * 0.5, h * 0.5, 0, 0, lienzo.width, lienzo.height);
      const d = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
      }
      const n = d.length / 4;
      alMuestra({ t: ahora / 1000, r: r / n, g: g / n, b: b / n });
    }
    if (conRVFC) video.requestVideoFrameCallback(paso);
    else requestAnimationFrame(paso);
  };
  if (conRVFC) video.requestVideoFrameCallback(paso);
  else requestAnimationFrame(paso);
  return () => { activo = false; };
}

// Señal sintética a ~30 cuadros/s: pulso asimétrico con muesca dícrota, arritmia sinusal
// respiratoria, deriva lenta y ruido. Imita un dedo sobre la cámara (rojo alto, verde y azul bajos).
export function senalPrueba(alMuestra, { bpm = 72 } = {}) {
  const t0 = performance.now() / 1000;
  let fase = 0;
  let tAnterior = 0;
  const id = setInterval(() => {
    const t = performance.now() / 1000 - t0;
    const dt = t - tAnterior;
    tAnterior = t;
    const f = (bpm / 60) * (1 + 0.05 * Math.sin(2 * Math.PI * 0.25 * t));
    fase += 2 * Math.PI * f * dt;
    const pulso = Math.max(0, Math.sin(fase)) ** 1.5 + 0.3 * Math.max(0, Math.sin(2 * fase - 1));
    const r = 180 - 3 * pulso + 2 * Math.sin(2 * Math.PI * 0.05 * t) + (Math.random() - 0.5) * 0.6;
    alMuestra({ t, r, g: 30, b: 25 });
  }, 33);
  return () => clearInterval(id);
}
