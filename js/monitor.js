// === Configuración ===
const API_URL = "https://68bb0e9184055bce63f10925.mockapi.io/api/v1/dispositivos_IoT";
const TIMEZONE = "America/Mexico_City";

// === Helpers ===
const $ = (sel) => document.querySelector(sel);

function setApiUrl() {
  $("#api-url").textContent = API_URL;
}
function setYear() {
  $("#year").textContent = new Date().getFullYear();
}
function fmtCdmxHuman(str) {
  // Si ya guardas date como 'sv-SE' (YYYY-MM-DD HH:mm:ss), lo mostramos directo.
  return str ?? "—";
}

// === Render ===
function renderLastStatus(item) {
  $("#last-status").textContent = item?.status ?? "—";
  $("#last-status-time").textContent = item?.date ? fmtCdmxHuman(item.date) : "";
}
function renderTable(items) {
  const tbody = $("#table-body");
  const count = $("#rows-count");

  if (!items?.length) {
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
    </tr>
  `).join("");

  tbody.innerHTML = rows;
  count.textContent = String(items.length);
}

// === Data ===
async function fetchLastTen() {
  // Intento con orden/limit de MockAPI
  const url = `${API_URL}?sortBy=date&order=desc&limit=10`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sorted = Array.isArray(data)
      ? data.sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [];
    renderLastStatus(sorted[0]);
    renderTable(sorted.slice(0, 10));
  } catch (e) {
    console.error("Fallo fetchLastTen con params, reintentando simple:", e);
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      const data = await res.json();
      const sorted = Array.isArray(data)
        ? data.filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))
        : [];
      renderLastStatus(sorted[0]);
      renderTable(sorted.slice(0, 10));
    } catch (e2) {
      console.error("Fallo fetch simple:", e2);
      renderLastStatus(null);
      renderTable([]);
    }
  }
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  setApiUrl();
  setYear();

  // Botón de refresco manual
  $("#refresh-btn")?.addEventListener("click", fetchLastTen);

  // Primera carga inmediata y polling cada 2s
  fetchLastTen();
  setInterval(fetchLastTen, 2000);
});
