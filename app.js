'use strict';

// PINPOINT v0.1.1: experimental relative-size range estimation, never laser accuracy.
const $ = id => document.getElementById(id);
const video = $('liveVideo');
const canvas = $('viewport');
const ctx = canvas.getContext('2d', { alpha: false });
const storageKey = 'pinpoint-calibration-v1';
const state = {
  stream: null, track: null, frozen: null, points: [],
  zoom: 1, panX: 0, panY: 0, mode: 'measure',
  calibration: readCalibration(), drag: null, cameraError: '',
  lastEstimate: null, drawing: false, meta: null,
  starting: false, cameraRequest: 0
};

function readCalibration() {
  try {
    const item = JSON.parse(localStorage.getItem(storageKey));
    if (item && Number.isFinite(item.distance) && item.distance > 0 &&
        Number.isFinite(item.relativeHeight) && item.relativeHeight > 0 &&
        Number.isFinite(item.aspect) && item.aspect > 0) return item;
  } catch (_) { /* Storage may be blocked; app remains usable */ }
  return null;
}
function storeCalibration(item) {
  state.calibration = item;
  try { localStorage.setItem(storageKey, JSON.stringify(item)); } catch (_) {}
}
function getSource() {
  if (state.frozen) return state.frozen;
  if (state.stream && video.readyState >= 2 && video.videoWidth && video.videoHeight) return video;
  return null;
}
function sourceSize(source) {
  return source ? { w: source.videoWidth || source.width, h: source.videoHeight || source.height } : null;
}
function viewportSize() {
  return { w: canvas.clientWidth || 320, h: canvas.clientHeight || 400 };
}
function fitCanvas() {
  const { w, h } = viewportSize();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const newW = Math.round(w * pixelRatio), newH = Math.round(h * pixelRatio);
  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width = newW;
    canvas.height = newH;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { w, h };
}
function metrics() {
  const src = getSource();
  const srcSize = sourceSize(src);
  if (!srcSize) return null;
  const { w, h } = viewportSize();
  // "Contain" is intentional. The whole flagstick remains selectable.
  const baseScale = Math.min(w / srcSize.w, h / srcSize.h);
  const scale = baseScale * (state.frozen ? state.zoom : 1);
  const rw = srcSize.w * scale, rh = srcSize.h * scale;
  const maxPanX = Math.max(0, (rw - w) / 2);
  const maxPanY = Math.max(0, (rh - h) / 2);
  if (state.frozen) {
    state.panX = Math.max(-maxPanX, Math.min(maxPanX, state.panX));
    state.panY = Math.max(-maxPanY, Math.min(maxPanY, state.panY));
  } else { state.panX = 0; state.panY = 0; }
  return { src, srcW: srcSize.w, srcH: srcSize.h, scale, left: (w - rw) / 2 + state.panX, top: (h - rh) / 2 + state.panY };
}
function render() {
  const { w, h } = fitCanvas();
  ctx.fillStyle = '#092019'; ctx.fillRect(0, 0, w, h);
  const m = metrics();
  if (!m) return;
  try { ctx.drawImage(m.src, m.left, m.top, m.srcW * m.scale, m.srcH * m.scale); } catch (_) { return; }
  if (state.frozen) {
    const pts = state.points;
    if (pts.length === 2) {
      ctx.beginPath(); ctx.moveTo(m.left + pts[0].x * m.scale, m.top + pts[0].y * m.scale);
      ctx.lineTo(m.left + pts[1].x * m.scale, m.top + pts[1].y * m.scale);
      ctx.strokeStyle = '#c7f884'; ctx.lineWidth = 3; ctx.stroke();
    }
    pts.forEach((p, i) => {
      const x = m.left + p.x * m.scale, y = m.top + p.y * m.scale;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#c7f884' : '#f8c27b'; ctx.fill();
      ctx.strokeStyle = '#071a17'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff'; ctx.fillText(i === 0 ? 'TOPP' : 'BUNN', x + 13, y - 9);
    });
  }
}
function animate() {
  if (!state.stream) { state.drawing = false; return; }
  if (!state.frozen) render();
  requestAnimationFrame(animate);
}
function ensureAnimation() {
  if (!state.drawing) { state.drawing = true; requestAnimationFrame(animate); }
}
function status(label, active = false) {
  const el = $('cameraStatus');
  el.classList.toggle('live', active);
  el.lastElementChild.textContent = label;
}
function cameraReady(ready) {
  $('viewPlaceholder').classList.toggle('hidden', ready);
  $('reticle').classList.toggle('hidden', !ready || !!state.frozen);
  $('finderLabel').textContent = ready ? (state.frozen ? 'FRYST BILDE' : 'DIREKTEVISNING') : 'KAMERA AV';
  $('zoomLabel').textContent = `${state.zoom.toFixed(1)}× visning`;
  $('zoomValue').textContent = `${state.zoom.toFixed(1)}×`;
  $('zoomIn').disabled = !state.frozen || state.zoom >= 8;
  $('zoomOut').disabled = !state.frozen || state.zoom <= 1;
  const btn = $('captureButton');
  btn.disabled = state.starting;
  if (state.starting) { btn.textContent = 'Starter kamera …'; return; }
  btn.innerHTML = !ready ? 'Start kamera <span aria-hidden="true">↗</span>' : state.frozen ? 'Nytt bilde <span aria-hidden="true">↻</span>' : 'Frys bilde <span aria-hidden="true">◎</span>';
  $('viewTip').textContent = !ready ? 'Gi tilgang til kamera når du starter' : !state.frozen ? 'Sikt på hele flaggstangen, og trykk «Frys bilde»' : state.points.length === 0 ? 'Trykk på flaggstangens topp. Dra i bildet for å flytte utsnittet.' : state.points.length === 1 ? 'Trykk på flaggstangens bunn, ved greenen.' : 'Begge punkter er valgt. Du kan beregne eller lagre kalibreringen.';
}
function stopCamera() {
  state.cameraRequest += 1;
  state.starting = false;
  if (state.stream) state.stream.getTracks().forEach(t => t.stop());
  state.stream = null; state.track = null; state.frozen = null;
  video.srcObject = null; state.points = []; state.meta = null; state.lastEstimate = null;
  status('Ikke startet'); cameraReady(false); render(); updateControls();
}
async function startCamera() {
  if (state.starting || state.stream) return;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    alert('Kamera krever en sikker HTTPS-side. Publiser PWA-en på GitHub Pages eller en annen HTTPS-tjeneste og åpne den i Safari.');
    return;
  }
  state.starting = true;
  const request = ++state.cameraRequest;
  cameraReady(false);
  try {
    status('Starter kamera …');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }
    });
    if (request !== state.cameraRequest) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    state.stream = stream;
    state.track = stream.getVideoTracks()[0];
    video.srcObject = stream;
    // iOS Safari may require an explicit play() after the user gesture.
    await video.play();
    if (!video.videoWidth) throw new Error('Kameraet leverte ikke et bilde. Prøv å starte på nytt.');
    if (request !== state.cameraRequest) return;
    state.frozen = null; state.points = []; state.zoom = 1; state.panX = 0; state.panY = 0;
    state.meta = cameraMetadata();
    state.starting = false;
    status('Kamera aktivt', true); cameraReady(true); updateControls(); render(); ensureAnimation();
    state.track.addEventListener('ended', () => { if (state.stream === stream) stopCamera(); });
  } catch (err) {
    if (request !== state.cameraRequest) return;
    stopCamera();
    const explanation = err.name === 'NotAllowedError' ? 'Kameraet ble ikke tillatt. Aktiver kameratilgang for nettsiden i Safari-innstillingene.' : `${err.name || 'Kamerafeil'}: ${err.message || 'Ukjent feil'}`;
    alert(`Kunne ikke starte kameraet. ${explanation}`);
  }
}
function cameraMetadata() {
  const setting = state.track?.getSettings ? state.track.getSettings() : {};
  return { deviceId: setting.deviceId || null, zoom: Number.isFinite(setting.zoom) ? setting.zoom : null };
}
function calibrationMismatch(calibration, size, camera) {
  const aspect = size.w / size.h;
  if (Math.abs(aspect - calibration.aspect) / calibration.aspect > 0.035) return 'Bildeformatet er endret.';
  const reference = calibration.camera;
  if (reference?.deviceId && camera?.deviceId && reference.deviceId !== camera.deviceId) return 'Et annet kamera er valgt.';
  if (Number.isFinite(reference?.zoom) && (!Number.isFinite(camera?.zoom) || Math.abs(reference.zoom - camera.zoom) > 0.001)) return 'Kamerazoomen er endret eller kan ikke kontrolleres.';
  return null;
}
function capture() {
  const src = getSource();
  if (!src) return;
  const size = sourceSize(src);
  const snap = document.createElement('canvas');
  snap.width = size.w; snap.height = size.h;
  snap.getContext('2d', { alpha: false }).drawImage(src, 0, 0, size.w, size.h);
  state.meta = cameraMetadata();
  state.frozen = snap; state.points = []; state.zoom = 1; state.panX = 0; state.panY = 0;
  state.lastEstimate = null;
  status('Bilde fryst', true); cameraReady(true); updateControls(); render();
}
function resume() {
  state.frozen = null; state.points = []; state.zoom = 1; state.panX = 0; state.panY = 0; state.lastEstimate = null;
  status('Kamera aktivt', true); cameraReady(true); updateControls(); render();
}
function setMode(mode) {
  state.mode = mode;
  state.points = []; state.lastEstimate = null;
  if (state.frozen) resume();
  const measure = mode === 'measure';
  $('measureTab').classList.toggle('active', measure);
  $('calibrateTab').classList.toggle('active', !measure);
  $('measureTab').setAttribute('aria-pressed', String(measure));
  $('calibrateTab').setAttribute('aria-pressed', String(!measure));
  $('calibrationInput').classList.toggle('hidden', measure);
  $('panelOverline').textContent = measure ? 'AVSTANDSBEREGNING' : 'KAMERAOPPSETT';
  $('panelTitle').textContent = measure ? 'Mål flagget' : 'Kalibrer kameraet';
  $('instructions').textContent = measure ? 'Frys et bilde, og trykk på toppen og bunnen av flaggstangen.' : 'Stå på kjent, oppmålt avstand fra flaggstangen. Frys et bilde og marker topp og bunn.';
  $('saveButton').innerHTML = measure ? 'Beregn avstand <span aria-hidden="true">→</span>' : 'Lagre kalibrering <span aria-hidden="true">→</span>';
  updateControls(); render();
}
function pixelsBetweenPoints() {
  if (state.points.length !== 2) return null;
  const a = state.points[0], b = state.points[1];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function updateControls() {
  const selected = state.points.length;
  $('progressBadge').textContent = `${selected} / 2`;
  $('topStep').classList.toggle('done', selected >= 1);
  $('bottomStep').classList.toggle('done', selected >= 2);
  $('topDone').textContent = selected >= 1 ? '✓' : '';
  $('bottomDone').textContent = selected >= 2 ? '✓' : '';
  $('undoButton').disabled = selected === 0;
  $('saveButton').disabled = selected !== 2;
  $('result').classList.toggle('hidden', !state.lastEstimate);
  const c = state.calibration;
  $('calibrationBanner').classList.toggle('ready', !!c);
  $('calibrationBannerTitle').textContent = c ? 'Kamera kalibrert' : 'Ikke kalibrert';
  $('calibrationBannerText').textContent = c ? `Referanse: ${formatNumber(c.distance, 1)} m · ${new Date(c.at).toLocaleDateString('nb-NO')} · behold samme optiske kamerainnstillinger.` : 'Velg «Kalibrer» og bruk en oppmålt avstand før første måling.';
  cameraReady(!!state.stream);
}
function formatNumber(n, digits=0) { return n.toLocaleString('nb-NO', { maximumFractionDigits: digits, minimumFractionDigits: 0 }); }
function pointAtClientXY(clientX, clientY) {
  const m = metrics(); if (!m) return null;
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left - m.left) / m.scale;
  const y = (clientY - r.top - m.top) / m.scale;
  if (x < 0 || y < 0 || x > m.srcW || y > m.srcH) return null;
  return { x, y };
}
function markAt(clientX, clientY) {
  if (!state.frozen) return;
  const p = pointAtClientXY(clientX, clientY);
  if (!p) return;
  if (state.points.length >= 2) state.points = [];
  state.points.push(p);
  state.lastEstimate = null;
  updateControls(); render();
}
function setZoom(nextZoom) {
  if (!state.frozen) return;
  state.zoom = Math.max(1, Math.min(8, Math.round(nextZoom * 2) / 2));
  updateControls(); render();
}
function measureOrSave() {
  if (!state.frozen || state.points.length !== 2) return;
  const size = sourceSize(state.frozen);
  const length = pixelsBetweenPoints();
  if (!length || length < 2) { alert('Punktene er for nær hverandre. For liten bildeflate gir ikke en brukbar måling.'); return; }
  const relativeHeight = length / size.h;
  if (state.mode === 'calibrate') {
    const d = Number($('knownDistance').value.replace(',', '.'));
    if (!(d >= 2 && d <= 500)) { alert('Skriv inn en faktisk oppmålt avstand på mellom 2 og 500 meter.'); return; }
    storeCalibration({ distance: d, relativeHeight, aspect: size.w / size.h, at: new Date().toISOString(), camera: state.meta || null });
    state.lastEstimate = { type: 'calibration' };
    $('resultCaption').textContent = 'REFERANSE LAGRET';
    $('resultNumber').textContent = formatNumber(d, 1);
    $('resultUnit').textContent = 'm';
    $('qualityLabel').textContent = 'Kalibrert';
    $('resultDetail').textContent = `Flaggstangen var ${formatNumber(length, 1)} piksler høy. Bruk flaggstenger med samme høyde og uendret optisk kameravinkel.`;
    updateControls();
    return;
  }
  if (!state.calibration) { alert('Kalibrer først med en kjent avstand.'); return; }
  const c = state.calibration;
  const mismatch = calibrationMismatch(c, size, state.meta);
  if (mismatch) {
    state.lastEstimate = null;
    updateControls();
    alert(`${mismatch} Kalibrer på nytt med dette kameraoppsettet før du måler.`);
    return;
  }
  const d = c.distance * (c.relativeHeight / relativeHeight);
  if (!Number.isFinite(d) || d > 10000) { alert('Ugyldig måling. Velg punktene på nytt.'); return; }
  const sensitivity = Math.round(d * (2 / length));
  const quality = length < 12 ? 'Svært usikker' : length < 30 ? 'Usikker' : 'Må testes';
  $('resultCaption').textContent = 'ESTIMERT AVSTAND · IKKE LASER';
  $('resultNumber').textContent = formatNumber(Math.round(d));
  $('resultUnit').textContent = 'm';
  $('qualityLabel').textContent = quality;
  $('resultDetail').textContent = `Stangen dekker ${formatNumber(length, 1)} piksler. Bare 2 pikslers feil på stanghøyden kan endre estimatet med ca. ${sensitivity} m. Avstandene er ikke verifisert. Automatisk linsebytte kan fortsatt være usynlig for appen.`;
  state.lastEstimate = { type: 'measurement', distance: d, pixels: length };
  updateControls();
}

$('captureButton').addEventListener('click', () => {
  if (!state.stream) startCamera(); else if (!state.frozen) capture(); else resume();
});
$('measureTab').addEventListener('click', () => setMode('measure'));
$('calibrateTab').addEventListener('click', () => setMode('calibrate'));
$('zoomIn').addEventListener('click', () => setZoom(state.zoom + .5));
$('zoomOut').addEventListener('click', () => setZoom(state.zoom - .5));
$('undoButton').addEventListener('click', () => { state.points.pop(); state.lastEstimate = null; updateControls(); render(); });
$('saveButton').addEventListener('click', measureOrSave);
$('resetCalibration').addEventListener('click', () => {
  if (!confirm('Slette kalibreringen som er lagret på denne telefonen?')) return;
  state.calibration = null; state.lastEstimate = null;
  try { localStorage.removeItem(storageKey); } catch (_) {}
  setMode('calibrate');
});

canvas.addEventListener('pointerdown', event => {
  if (!state.frozen) return;
  canvas.setPointerCapture(event.pointerId);
  state.drag = { x: event.clientX, y: event.clientY, origX: state.panX, origY: state.panY, moved: false };
});
canvas.addEventListener('pointermove', event => {
  if (!state.drag || !state.frozen) return;
  const dx = event.clientX - state.drag.x, dy = event.clientY - state.drag.y;
  if (Math.hypot(dx, dy) > 8) state.drag.moved = true;
  if (state.drag.moved && state.zoom > 1) {
    state.panX = state.drag.origX + dx; state.panY = state.drag.origY + dy; render();
  }
});
canvas.addEventListener('pointerup', event => {
  if (!state.drag) return;
  const wasMoved = state.drag.moved;
  state.drag = null;
  try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  if (!wasMoved) markAt(event.clientX, event.clientY);
});
canvas.addEventListener('pointercancel', () => { state.drag = null; });
window.addEventListener('resize', render);
window.addEventListener('pagehide', stopCamera);

// Calibration is the first task on a new device; otherwise open measurement directly.
setMode(state.calibration ? 'measure' : 'calibrate');
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
render();
