// === Configuración ===
const API_URL = "https://68bb0e9184055bce63f10925.mockapi.io/api/v1/dispositivos_IoT";
const TIMEZONE = "America/Mexico_City";
const LS_DEVICE_NAME_KEY = "iot_device_name";
const PROGRAM_FALLBACK_NAME = "Panel Web IoT"; // Fallback si no hay nombre
// === Utilidades DOM ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === Fecha/Hora CDMX ===
function nowCdmxString() {
  return new Date().toLocaleString("sv-SE", { timeZone: TIMEZONE });
}
function fmtCdmxHuman(isoLike) {
  return isoLike ?? "—";
}

// === UI Helpers ===
function setSaving(on) {
  $("#saving-indicator")?.classList.toggle("visually-hidden", !on);
}
function setApiUrl() {
  const el = $("#api-url");
  if (el) el.textContent = API_URL;
}
function setYear() {
  const el = $("#year");
  if (el) el.textContent = new Date().getFullYear();
}

// === Detección (best-effort, navegadores limitan hostname real por privacidad) ===
function detectDeviceName() {
  // Intentamos construir un nombre legible desde User-Agent / UA-CH
  const nav = navigator;
  let brand = "";

  // UA-CH (algunos navegadores modernos)
  const uaData = nav.userAgentData || null;
  if (uaData) {
    try {
      const brands = uaData.brands?.map((b) => b.brand).join(" ") || "";
      brand = `${brands} ${uaData.platform || ""}`.trim();
    } catch { /* noop */ }
  }

  // Fallback: userAgent básico
  if (!brand) {
    brand = `${nav.platform || ""} ${nav.userAgent || ""}`.trim();
  }

  // Recorte amigable
  brand = brand.replace(/\s+/g, " ").slice(0, 60);

  if (!brand) brand = PROGRAM_FALLBACK_NAME;
  return brand;
}

function loadSavedDeviceName() {
  return localStorage.getItem(LS_DEVICE_NAME_KEY) || "";
}
function saveDeviceName(name) {
  try { localStorage.setItem(LS_DEVICE_NAME_KEY, name); } catch {}
}

// === Render ===
function renderLastStatus(item) {
  $("#last-status").textContent = item?.status ?? "—";
  $("#last-status-time").textContent = item?.date ? fmtCdmxHuman(item.date) : "";
}
function renderTable(items) {
  const tbody = $("#table-body");
  const count = $("#rows-count");
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">Sin datos</td></tr>`;
    count.textContent = "0";
    return;
  }

  const rows = items.map((r) => `
    <tr>
      <td>${r.id ?? "—"}</td>
      <td>${r.name ?? "—"}</td>
      <td><span class="badge text-bg-primary">${r.status ?? "—"}</span></td>
      <td>${r.ip ?? "—"}</td>
      <td>${fmtCdmxHuman(r.date)}</td>
    </tr>`).join("");

  tbody.innerHTML = rows;
  count.textContent = String(items.length);
}

// === Data ===
async function fetchLastFive() {
  const urlParams = `${API_URL}?sortBy=date&order=desc&limit=5`;
  try {
    const res = await fetch(urlParams);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sorted = Array.isArray(data)
      ? data.sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [];
    renderLastStatus(sorted[0]);
    renderTable(sorted.slice(0, 5));
  } catch (err) {
    console.error("Error al obtener últimos registros:", err);
    // Reintento sin params
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? data.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))
        : [];
      renderLastStatus(sorted[0]);
      renderTable(sorted.slice(0, 5));
    } catch (err2) {
      console.error("Error secundario:", err2);
      renderTable([]);
      renderLastStatus(null);
    }
  }
}

async function detectPublicIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { ip } = await res.json();
    $("#ip-input").value = ip || "";
  } catch (e) {
    console.warn("No fue posible detectar IP pública automáticamente.", e);
    alert("No pude detectar la IP pública. Puedes ingresarla manualmente.");
  }
}

async function postStatus(status) {
  setSaving(true);

  // Nombre desde input o detectado
  let deviceName = $("#name-input")?.value?.trim();
  if (!deviceName) {
    deviceName = detectDeviceName(); // fallback
    $("#name-input").value = deviceName; // refleja en UI
  }
  saveDeviceName(deviceName);

  // IP opcional
  const ipValue = $("#ip-input")?.value?.trim() || null;

  const payload = {
    name: deviceName,
    status,
    ip: ipValue || null,
    date: nowCdmxString(),
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fetchLastFive();
  } catch (err) {
    console.error("Error al guardar:", err);
    alert("No se pudo guardar el registro. Revisa la consola para más detalles.");
  } finally {
    setSaving(false);
  }
}

// === Eventos ===
function wireEvents() {
  // Botones de status
  $$(".btn-status").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const status = e.currentTarget.getAttribute("data-status");
      if (status) postStatus(status);
    });
  });

  // Refresh manual
  $("#refresh-btn")?.addEventListener("click", fetchLastFive);

  // Detectar nombre/IP
  $("#detect-name-btn")?.addEventListener("click", () => {
    $("#name-input").value = detectDeviceName();
  });
  $("#detect-ip-btn")?.addEventListener("click", detectPublicIP);

  // Auto-refresh suave cada 15s
  setInterval(fetchLastFive, 15000);
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  setApiUrl();
  setYear();
  wireEvents();

  // Prefill nombre del dispositivo: usa localStorage, si no, detecta
  const saved = loadSavedDeviceName();
  $("#name-input").value = saved || detectDeviceName();

  fetchLastFive();
});
