/* ============================================================
   CONFIGURACIÓN — lo único que debes cambiar
   ============================================================
   1. Abre tu Google Sheet.
   2. Archivo > Compartir > Publicar en la web.
   3. Elige la hoja correcta y el formato "Valores separados por comas (.csv)".
   4. Copia el link que te da Google y pégalo abajo, reemplazando
      la URL de ejemplo.
   ============================================================ */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt9KORPY7MxVuP8WgtUsy290ueFK0twcckpJGvuV540cf25bwBq2k0yJsr_oeAs4N79D-yZDbvaAPY/pub?gid=0&single=true&output=csv";

/* Columnas esperadas en el Google Sheet (encabezados exactos, en la fila 1):
   activo | orden | nombre | tipo | color | voltaje | imagen_url |
   precio_minorista | cantidad_bolsa | precio_bolsa |
   cantidad_caja | precio_caja | descuento_texto | badge | link_compra
*/

/* ============================================================
   CONTADOR DE INTERACCIONES (opcional)
   ============================================================
   Si quieres el contador "X personas ya eligieron su cinta ideal",
   sigue los pasos de la sección "Contador de interacciones" del
   README y pega aquí la URL que te da Google Apps Script al
   implementar. Si lo dejas vacío, el modal funciona igual mostrando
   los filtros por voltaje, simplemente no aparece el contador.
   ============================================================ */
const COUNTER_APPS_SCRIPT_URL = "";

const grid = document.getElementById("product-grid");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const filterEmptyState = document.getElementById("filter-empty-state");
const filtersWrap = document.getElementById("voltage-filters");
const template = document.getElementById("product-card-template");

const modal = document.getElementById("voltage-modal");
const modalClose = document.getElementById("modal-close");
const modalOptions = document.getElementById("modal-options");
const modalCounter = document.getElementById("modal-counter");
const modalCounterValue = document.getElementById("modal-counter-value");

let activeVoltage = "all";

/* Orden preferido de los voltajes más comunes; cualquier otro voltaje
   que aparezca en el Sheet se agrega al final en el orden en que se encuentre. */
const VOLTAGE_ORDER = ["5V", "12V", "24V", "110V", "220V"];

function normalizeVoltage(value) {
  return String(value || "").trim().toUpperCase();
}

function formatCOP(value) {
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return value || "";
  return num.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function isTrue(value) {
  return String(value).trim().toUpperCase() === "TRUE" || String(value).trim() === "1";
}

function buildCard(row) {
  const node = template.content.cloneNode(true);
  const card = node.querySelector(".product-card");
  card.dataset.voltage = normalizeVoltage(row.voltaje);

  const badge = node.querySelector(".card-badge");
  if (row.badge && row.badge.trim()) {
    badge.textContent = row.badge.trim();
    badge.hidden = false;
  }

  const img = node.querySelector(".card-image");
  img.src = row.imagen_url || "";
  img.alt = row.nombre || "Cinta LED";
  img.loading = "lazy";

  node.querySelector(".card-name").textContent = row.nombre || "";

  const tagsWrap = node.querySelector(".card-tags");
  [row.tipo, row.color, row.voltaje].forEach((tag) => {
    if (tag && tag.trim()) {
      const span = document.createElement("span");
      span.textContent = tag.trim();
      tagsWrap.appendChild(span);
    }
  });

  const tierUnit = node.querySelector(".tier-unit");
  tierUnit.querySelector(".tier-price").textContent = formatCOP(row.precio_minorista);
  tierUnit.querySelector(".tier-qty").textContent = "Por metro / unidad";

  const tierBag = node.querySelector(".tier-bag");
  if (row.precio_bolsa && row.precio_bolsa.trim()) {
    tierBag.querySelector(".tier-price").textContent = formatCOP(row.precio_bolsa);
    tierBag.querySelector(".tier-qty").textContent = row.cantidad_bolsa || "";
  } else {
    tierBag.remove();
  }

  const tierBox = node.querySelector(".tier-box");
  if (row.precio_caja && row.precio_caja.trim()) {
    tierBox.querySelector(".tier-price").textContent = formatCOP(row.precio_caja);
    tierBox.querySelector(".tier-qty").textContent = row.cantidad_caja || "";
  } else {
    tierBox.remove();
  }

  const note = node.querySelector(".card-discount-note");
  if (row.descuento_texto && row.descuento_texto.trim()) {
    note.textContent = row.descuento_texto.trim();
  } else {
    note.remove();
  }

  const buyBtn = node.querySelector(".btn-buy");
  buyBtn.href = row.link_compra || "https://www.tuvoltio.com";

  return node;
}

function buildVoltageFilters(rows) {
  const found = [...new Set(rows.map((row) => normalizeVoltage(row.voltaje)).filter(Boolean))];

  const ordered = [
    ...VOLTAGE_ORDER.filter((v) => found.includes(v)),
    ...found.filter((v) => !VOLTAGE_ORDER.includes(v)),
  ];

  if (ordered.length < 2) return; // no vale la pena filtrar con un solo voltaje

  ordered.forEach((voltage) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-pill";
    btn.dataset.voltage = voltage;
    btn.textContent = voltage;
    filtersWrap.appendChild(btn);
  });

  filtersWrap.hidden = false;
}

function applyVoltageFilter(voltage) {
  activeVoltage = voltage;

  filtersWrap.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.voltage === voltage);
  });

  const cards = grid.querySelectorAll(".product-card");
  if (cards.length === 0) return; // los productos aún no cargan; se aplica al terminar de renderizar

  let visibleCount = 0;
  cards.forEach((card) => {
    const matches = voltage === "all" || card.dataset.voltage === voltage;
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  filterEmptyState.hidden = visibleCount > 0;
  grid.hidden = visibleCount === 0;
}

filtersWrap.addEventListener("click", (event) => {
  const btn = event.target.closest(".filter-pill");
  if (!btn) return;
  applyVoltageFilter(btn.dataset.voltage);
});

function renderProducts(rows) {
  const activos = rows
    .filter((row) => isTrue(row.activo) && row.nombre && row.nombre.trim())
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  loadingState.hidden = true;

  if (activos.length === 0) {
    emptyState.hidden = false;
    return;
  }

  buildVoltageFilters(activos);
  activos.forEach((row) => grid.appendChild(buildCard(row)));
  grid.hidden = false;
  applyVoltageFilter(activeVoltage);
}

function loadProducts() {
  Papa.parse(SHEET_CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => renderProducts(results.data),
    error: () => {
      loadingState.hidden = true;
      errorState.hidden = false;
    },
  });
}

loadProducts();

/* ============================================================
   MODAL DE BIENVENIDA + CONTADOR DE INTERACCIONES
   ============================================================ */
function closeModal() {
  modal.hidden = true;
}

function fetchCounter() {
  if (!COUNTER_APPS_SCRIPT_URL) return;

  fetch(COUNTER_APPS_SCRIPT_URL)
    .then((res) => res.json())
    .then((data) => {
      modalCounterValue.textContent = (data.total || 0).toLocaleString("es-CO");
      modalCounter.hidden = false;
    })
    .catch(() => {
      // Si falla, simplemente no mostramos el contador; el modal sigue funcionando.
    });
}

function logInteraction(voltage) {
  if (!COUNTER_APPS_SCRIPT_URL) return;

  // Actualiza el número en pantalla al toque, sin esperar respuesta del servidor.
  const current = Number(modalCounterValue.textContent.replace(/[^0-9]/g, "")) || 0;
  modalCounterValue.textContent = (current + 1).toLocaleString("es-CO");
  modalCounter.hidden = false;

  fetch(COUNTER_APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ voltaje: voltage }),
  }).catch(() => {
    // Si falla el registro, no interrumpe la experiencia del usuario.
  });
}

modalOptions.addEventListener("click", (event) => {
  const btn = event.target.closest(".modal-option");
  if (!btn) return;

  const voltage = btn.dataset.voltage;
  logInteraction(voltage);
  applyVoltageFilter(voltage);
  closeModal();
});

modalClose.addEventListener("click", () => {
  applyVoltageFilter("all");
  closeModal();
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    applyVoltageFilter("all");
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    applyVoltageFilter("all");
    closeModal();
  }
});

fetchCounter();


