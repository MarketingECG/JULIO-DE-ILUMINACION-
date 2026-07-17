const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt9KORPY7MxVuP8WgtUsy290ueFK0twcckpJGvuV540cf25bwBq2k0yJsr_oeAs4N79D-yZDbvaAPY/pub?gid=0&single=true&output=csv";
const grid = document.getElementById("product-grid");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const template = document.getElementById("product-card-template");

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

function renderProducts(rows) {
  const activos = rows
    .filter((row) => isTrue(row.activo) && row.nombre && row.nombre.trim())
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));

  loadingState.hidden = true;

  if (activos.length === 0) {
    emptyState.hidden = false;
    return;
  }

  activos.forEach((row) => grid.appendChild(buildCard(row)));
  grid.hidden = false;
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

