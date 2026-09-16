"use strict";
// Read-only viewer for GitHub Pages — same UI/logic as the local app
// (app/static/app.js) but backed by a pre-baked docs/data.json instead of
// the local Python API, and with all write actions (save/create/delete)
// removed. Regenerate data.json with scripts/build_static_site.py.

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Graph settings (persisted per-browser; not vault content)
// ---------------------------------------------------------------------
const GRAPH_SETTINGS_KEY = "sb-graph-settings";
const GRAPH_SETTINGS_DEFAULTS = {
  fontSize: 5,
  nodeScale: 1,
  linkIntensity: 0.45,
  theme: "",
  tags: [],
  solarMode: false,
  centerStrength: 1,
  chargeStrength: 80,
  linkStrength: 0.35,
  linkDistance: 60,
  labelVisibilityThreshold: 0,
  movementIntensity: 0,
  groups: [],
  solarTagsDisabled: [],
};

// Etiquetas usadas como "sóis" na visão Sistema Solar — cada uma vira um
// centro brilhante e as notas que carregam essa tag orbitam ao redor dela.
const SOLAR_TAGS = [
  "aplicacao/bancos-de-dados-quimicos",
  "aplicacao/catalise",
  "aplicacao/ciencia-de-alimentos",
  "aplicacao/ciencia-de-materiais",
  "aplicacao/descoberta-de-farmacos",
  "aplicacao/quimica-ambiental",
  "aplicacao/quimica-analitica",
  "aplicacao/quimica-computacional-geral",
  "biblioteca/atomic-simulation-environment",
  "biblioteca/deepchem",
  "biblioteca/mdanalysis",
  "biblioteca/mordred",
  "biblioteca/openbabel",
  "biblioteca/padel-descriptor",
  "biblioteca/pyscf",
  "biblioteca/rdkit",
  "biblioteca/torchdrug",
  "bioadsorcao",
  "diario",
  "estatistica",
  "estrategia",
  "fila-leitura",
  "indice",
  "literatura",
  "meta",
  "permanente",
  "projeto",
  "quimiometria",
  "sessao",
  "tema/computacao-quantica",
  "tema/curadoria-de-dados-quimicos",
  "tema/docking",
  "tema/geracao-de-moleculas",
  "tema/interpretabilidade-xai",
  "tema/materiais-polimericos",
  "tema/planejamento-de-sintese",
  "tema/predicao-de-propriedades",
  "tema/quimica-computacional-geral",
  "tema/simulacao-molecular",
  "tema/triagem-virtual",
  "tema/visualizacao-de-espaco-quimico",
  "tutorial",
  "índice",
];

function loadGraphSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GRAPH_SETTINGS_KEY) || "{}");
    const num = (v, fallback) => (typeof v === "number" && !Number.isNaN(v) ? v : fallback);
    const groups = Array.isArray(saved.groups)
      ? saved.groups
          .filter((g) => g && typeof g === "object")
          .map((g) => ({
            id: typeof g.id === "string" ? g.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: typeof g.name === "string" ? g.name : "",
            keyword: typeof g.keyword === "string" ? g.keyword : "",
            color: typeof g.color === "string" ? g.color : "#4a6fa5",
            enabled: typeof g.enabled === "boolean" ? g.enabled : true,
          }))
      : [];
    return {
      fontSize: num(saved.fontSize, GRAPH_SETTINGS_DEFAULTS.fontSize),
      nodeScale: num(saved.nodeScale, GRAPH_SETTINGS_DEFAULTS.nodeScale),
      linkIntensity: num(saved.linkIntensity, GRAPH_SETTINGS_DEFAULTS.linkIntensity),
      theme: typeof saved.theme === "string" ? saved.theme : GRAPH_SETTINGS_DEFAULTS.theme,
      tags: Array.isArray(saved.tags) ? saved.tags : [],
      solarMode: typeof saved.solarMode === "boolean" ? saved.solarMode : GRAPH_SETTINGS_DEFAULTS.solarMode,
      centerStrength: num(saved.centerStrength, GRAPH_SETTINGS_DEFAULTS.centerStrength),
      chargeStrength: num(saved.chargeStrength, GRAPH_SETTINGS_DEFAULTS.chargeStrength),
      linkStrength: num(saved.linkStrength, GRAPH_SETTINGS_DEFAULTS.linkStrength),
      linkDistance: num(saved.linkDistance, GRAPH_SETTINGS_DEFAULTS.linkDistance),
      labelVisibilityThreshold: num(saved.labelVisibilityThreshold, GRAPH_SETTINGS_DEFAULTS.labelVisibilityThreshold),
      movementIntensity: num(saved.movementIntensity, GRAPH_SETTINGS_DEFAULTS.movementIntensity),
      groups,
      solarTagsDisabled: Array.isArray(saved.solarTagsDisabled) ? saved.solarTagsDisabled : [],
    };
  } catch {
    return { ...GRAPH_SETTINGS_DEFAULTS, tags: [], groups: [], solarTagsDisabled: [] };
  }
}

function saveGraphSettings() {
  try {
    localStorage.setItem(GRAPH_SETTINGS_KEY, JSON.stringify(state.graphSettings));
  } catch {
    // private browsing / storage disabled — settings just won't persist
  }
}

const state = {
  tree: [],
  index: {}, // path -> note meta (from data.json, content included)
  currentPath: null,
  mode: "preview", // "edit" (raw source) | "preview" (rendered)
  activeTag: null,
  graphSettings: loadGraphSettings(),
};

// ---------------------------------------------------------------------
// Simple message modal (no destructive actions exist in read-only mode,
// so this is only ever used as an "OK"-only alert)
// ---------------------------------------------------------------------
function showAlert(message) {
  return new Promise((resolve) => {
    el("confirmMessage").textContent = message;
    el("confirmModal").classList.remove("hidden");
    const onOk = () => {
      el("confirmModal").classList.add("hidden");
      el("confirmOk").removeEventListener("click", onOk);
      resolve(true);
    };
    el("confirmOk").addEventListener("click", onOk);
  });
}

// ---------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------
(function initTheme() {
  const saved = localStorage.getItem("sb-theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  el("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sb-theme", next);
  });
})();

// ---------------------------------------------------------------------
// Tree rendering
// ---------------------------------------------------------------------
function renderTree(nodes, container) {
  const ul = document.createElement("ul");
  for (const node of nodes) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "node " + (node.type === "dir" ? "dir" : "file");
    if (node.type === "file" && node.path === state.currentPath) row.classList.add("active");

    if (node.type === "dir") {
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = "▾";
      row.appendChild(caret);
      row.appendChild(document.createTextNode(node.name));
      li.appendChild(row);
      const childWrap = document.createElement("div");
      childWrap.appendChild(renderTree(node.children, childWrap));
      li.appendChild(childWrap);
      row.addEventListener("click", () => {
        childWrap.classList.toggle("hidden");
        caret.textContent = childWrap.classList.contains("hidden") ? "▸" : "▾";
      });
    } else {
      row.appendChild(document.createTextNode("📄 " + node.name.replace(/\.md$/, "")));
      row.addEventListener("click", () => openNote(node.path));
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  container.innerHTML = "";
  container.appendChild(ul);
  return ul;
}

function refreshTreeView() {
  renderTree(state.tree, el("tree"));
}

// ---------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------
function renderTagList() {
  const tagCounts = {};
  for (const note of Object.values(state.index)) {
    for (const t of note.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  const tags = Object.keys(tagCounts).sort();
  const box = el("tagList");
  box.innerHTML = "";
  for (const tag of tags) {
    const pill = document.createElement("span");
    pill.className = "tag-pill" + (state.activeTag === tag ? " active" : "");
    pill.textContent = `${tag} (${tagCounts[tag]})`;
    pill.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? null : tag;
      renderTagList();
      runSearch();
    });
    box.appendChild(pill);
  }
}

// ---------------------------------------------------------------------
// Search — client-side, over the already-loaded index (no backend here)
// ---------------------------------------------------------------------
function runSearch() {
  const q = el("searchInput").value.trim().toLowerCase();
  if (!q && !state.activeTag) {
    refreshTreeView();
    return;
  }
  const results = [];
  for (const [path, note] of Object.entries(state.index)) {
    if (state.activeTag && !note.tags.includes(state.activeTag)) continue;
    if (q) {
      const haystack = (note.title + " " + path + " " + note.tags.join(" ") + " " + note.content).toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    results.push({ path, title: note.title });
  }
  results.sort((a, b) => a.title.localeCompare(b.title));

  const container = el("tree");
  container.innerHTML = "";
  const ul = document.createElement("ul");
  for (const r of results) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "node file" + (r.path === state.currentPath ? " active" : "");
    row.textContent = "📄 " + r.title;
    row.title = r.path;
    row.addEventListener("click", () => openNote(r.path));
    li.appendChild(row);
    ul.appendChild(li);
  }
  if (results.length === 0) {
    const li = document.createElement("li");
    li.className = "node";
    li.style.color = "var(--text-dim)";
    li.textContent = "Nenhum resultado";
    ul.appendChild(li);
  }
  container.appendChild(ul);
}

// ---------------------------------------------------------------------
// Wikilink rendering (markdown preview)
// ---------------------------------------------------------------------
function findNoteByStem(name) {
  const target = name.split("/").pop().trim().toLowerCase();
  for (const [path, note] of Object.entries(state.index)) {
    const stem = path.split("/").pop().replace(/\.md$/i, "").toLowerCase();
    if (stem === target) return path;
  }
  return null;
}

function renderMarkdownWithWikilinks(raw) {
  let body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const links = [];
  body = body.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (m, target, alias) => {
    const idx = links.length;
    links.push({ target: target.trim(), alias: (alias || "").trim() });
    return `%%WIKILINK${idx}%%`;
  });
  let html = window.marked.parse(body);
  html = html.replace(/%%WIKILINK(\d+)%%/g, (m, idx) => {
    const { target, alias } = links[idx];
    const resolved = findNoteByStem(target);
    const label = alias || target;
    if (resolved) return `<a class="wikilink" data-path="${resolved}">${label}</a>`;
    return `<a class="wikilink broken" data-target="${target}">${label}</a>`;
  });
  return html;
}

function attachPreviewLinkHandlers() {
  el("previewPane").querySelectorAll("a.wikilink").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const path = a.getAttribute("data-path");
      if (path) {
        openNote(path);
      } else {
        showAlert(`A nota "${a.getAttribute("data-target")}" não existe (ou não foi publicada) nesta cópia somente leitura.`);
      }
    });
  });
}

// ---------------------------------------------------------------------
// Opening notes
// ---------------------------------------------------------------------
function openNote(path) {
  const note = state.index[path];
  if (!note) return;
  state.currentPath = path;

  el("emptyState").classList.add("hidden");
  el("graphView").classList.add("hidden");
  el("graphSettingsBtn").classList.add("hidden");
  el("graphSettingsPanel").classList.add("hidden");
  el("solarToggleBtn").classList.add("hidden");
  el("editorView").classList.remove("hidden");
  el("notePath").textContent = path;
  el("editorTextarea").value = note.content;

  setMode(state.mode || "preview");
  renderSideMeta(path);
  refreshTreeView();
}

function setMode(mode) {
  state.mode = mode;
  const isEdit = mode === "edit";
  el("modeEditBtn").classList.toggle("active", isEdit);
  el("modePreviewBtn").classList.toggle("active", !isEdit);
  el("editorTextarea").classList.toggle("hidden", !isEdit);
  el("previewPane").classList.toggle("hidden", isEdit);
  if (!isEdit) {
    el("previewPane").innerHTML = renderMarkdownWithWikilinks(el("editorTextarea").value);
    attachPreviewLinkHandlers();
  }
}

function renderSideMeta(path) {
  const note = state.index[path];
  const fmBox = el("frontmatterBox");
  const outBox = el("outLinks");
  const backBox = el("backLinks");

  if (!note) {
    fmBox.textContent = "—";
    outBox.textContent = "—";
    backBox.textContent = "—";
    el("articleLinkBtn").classList.add("hidden");
    return;
  }

  fmBox.innerHTML = "";
  const fm = note.frontmatter || {};
  const keys = Object.keys(fm);
  if (keys.length === 0) fmBox.textContent = "—";
  for (const k of keys) {
    const row = document.createElement("div");
    row.className = "fm-row";
    const val = Array.isArray(fm[k]) ? fm[k].join(", ") : fm[k];
    const keyEl = `<span class="fm-key">${k}:</span>`;
    if ((k === "link" || k === "doi") && val) {
      const href = k === "doi" ? `https://doi.org/${encodeURI(String(val))}` : String(val);
      row.innerHTML = keyEl;
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = String(val);
      a.style.display = "inline";
      row.appendChild(a);
    } else {
      row.innerHTML = keyEl + escapeHtml(String(val));
    }
    fmBox.appendChild(row);
  }

  const articleBtn = el("articleLinkBtn");
  const articleHref = fm.link || (fm.doi ? `https://doi.org/${encodeURI(String(fm.doi))}` : "");
  if (articleHref) {
    articleBtn.href = articleHref;
    articleBtn.classList.remove("hidden");
  } else {
    articleBtn.classList.add("hidden");
    articleBtn.removeAttribute("href");
  }

  outBox.innerHTML = "";
  if (note.links.length === 0) outBox.textContent = "—";
  for (const link of note.links) {
    const a = document.createElement("a");
    a.textContent = link.alias || link.target;
    if (link.resolved) {
      a.addEventListener("click", () => openNote(link.resolved));
    } else {
      a.classList.add("broken-link");
      a.title = "nota não encontrada";
      a.addEventListener("click", () => showAlert(`A nota "${link.target}" não existe nesta cópia somente leitura.`));
    }
    outBox.appendChild(a);
  }

  backBox.innerHTML = "";
  if (note.backlinks.length === 0) backBox.textContent = "—";
  for (const bp of note.backlinks) {
    const a = document.createElement("a");
    a.textContent = state.index[bp] ? state.index[bp].title : bp;
    a.addEventListener("click", () => openNote(bp));
    backBox.appendChild(a);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

el("modeEditBtn").addEventListener("click", () => setMode("edit"));
el("modePreviewBtn").addEventListener("click", () => setMode("preview"));

// ---------------------------------------------------------------------
// Search input
// ---------------------------------------------------------------------
let searchDebounce;
el("searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 150);
});

// ---------------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------------
el("toggleSidebar").addEventListener("click", () => {
  el("sidebar").classList.toggle("collapsed");
});

// ---------------------------------------------------------------------
// Graph view (identical to the local app — pure client-side over state.index)
// ---------------------------------------------------------------------
function folderColor(folder) {
  const top = (folder || "").split("/")[0] || "raiz";
  let hash = 0;
  for (let i = 0; i < top.length; i++) hash = top.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

function wrapLabel(title, maxCharsPerLine) {
  const words = title.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < 3 && current) lines.push(current);
  if (lines.length === 3) {
    const consumed = lines.slice(0, 2).join(" ").length + 1;
    let last = title.slice(consumed).trim() || lines[2];
    if (last.length > maxCharsPerLine) last = last.slice(0, maxCharsPerLine - 1).trimEnd() + "…";
    lines[2] = last;
  }
  return lines;
}

function forceJiggle(strength) {
  let nodes = [];
  function force() {
    for (const n of nodes) {
      if (n.fx != null) continue;
      n.vx += (Math.random() - 0.5) * strength;
      n.vy += (Math.random() - 0.5) * strength;
    }
  }
  force.initialize = (_nodes) => { nodes = _nodes; };
  return force;
}

function collectThemeFolders(nodes) {
  const result = [];
  function walk(list) {
    for (const n of list) {
      if (n.type !== "dir") continue;
      const dirChildNames = n.children.filter((c) => c.type === "dir").map((c) => c.name);
      if (dirChildNames.includes("Artigos") || dirChildNames.includes("Minhas Notas")) {
        result.push({ name: n.name, path: n.path });
      }
      walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

function noteMatchesGraphFilters(note) {
  const { theme, tags } = state.graphSettings;
  if (theme && !(note.folder + "/").startsWith(theme + "/")) return false;
  if (tags.length && !tags.some((t) => note.tags.includes(t))) return false;
  return true;
}

function applyGraphCssVars() {
  const svgEl = el("graphSvg");
  if (!svgEl) return;
  svgEl.style.setProperty("--graph-font-size", state.graphSettings.fontSize + "px");
  svgEl.style.setProperty("--graph-link-opacity", state.graphSettings.linkIntensity);
  svgEl.style.setProperty("--graph-link-width", (0.5 + state.graphSettings.linkIntensity * 2.5).toFixed(2) + "px");
}

// Labels are always created but hidden/shown live from the last render's
// selection, so dragging the threshold slider doesn't require re-simulating.
let currentLabelSelection = null;
function applyLabelVisibility() {
  if (!currentLabelSelection) return;
  const threshold = state.graphSettings.labelVisibilityThreshold;
  currentLabelSelection.style("display", (d) => (d._r >= threshold ? null : "none"));
}

// Debounced re-render for settings that require restarting the force
// simulation (as opposed to font size / link opacity / label threshold,
// which apply live without rebuilding the layout).
let forceRenderDebounce;
function debounceRenderActiveGraph() {
  clearTimeout(forceRenderDebounce);
  forceRenderDebounce = setTimeout(renderActiveGraph, 150);
}

function renderGraphThemeFilter() {
  const sel = el("gsThemeFilter");
  const themes = collectThemeFolders(state.tree);
  sel.innerHTML = '<option value="">Todos os temas</option>';
  for (const t of themes) {
    const opt = document.createElement("option");
    opt.value = t.path;
    opt.textContent = t.name;
    sel.appendChild(opt);
  }
  sel.value = state.graphSettings.theme || "";
}

function renderGraphTagFilter() {
  const tagCounts = {};
  for (const note of Object.values(state.index)) {
    for (const t of note.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
  }
  const tags = Object.keys(tagCounts).sort();
  const box = el("gsTagFilter");
  box.innerHTML = "";
  for (const tag of tags) {
    const pill = document.createElement("span");
    const active = state.graphSettings.tags.includes(tag);
    pill.className = "tag-pill" + (active ? " active" : "");
    pill.textContent = tag;
    pill.addEventListener("click", () => {
      const idx = state.graphSettings.tags.indexOf(tag);
      if (idx === -1) state.graphSettings.tags.push(tag);
      else state.graphSettings.tags.splice(idx, 1);
      saveGraphSettings();
      renderGraphTagFilter();
      renderActiveGraph();
    });
    box.appendChild(pill);
  }
}

function populateGraphSettingsUI() {
  el("gsFontSize").value = state.graphSettings.fontSize;
  el("gsFontSizeVal").textContent = state.graphSettings.fontSize + "px";
  el("gsNodeSize").value = state.graphSettings.nodeScale;
  el("gsNodeSizeVal").textContent = state.graphSettings.nodeScale.toFixed(1) + "×";
  el("gsLinkIntensity").value = state.graphSettings.linkIntensity;
  el("gsLinkIntensityVal").textContent = state.graphSettings.linkIntensity.toFixed(2);
  el("gsLabelThreshold").value = state.graphSettings.labelVisibilityThreshold;
  el("gsLabelThresholdVal").textContent = state.graphSettings.labelVisibilityThreshold;
  el("gsCenterStrength").value = state.graphSettings.centerStrength;
  el("gsCenterStrengthVal").textContent = state.graphSettings.centerStrength.toFixed(1);
  el("gsChargeStrength").value = state.graphSettings.chargeStrength;
  el("gsChargeStrengthVal").textContent = state.graphSettings.chargeStrength;
  el("gsLinkStrength").value = state.graphSettings.linkStrength;
  el("gsLinkStrengthVal").textContent = state.graphSettings.linkStrength.toFixed(2);
  el("gsLinkDistance").value = state.graphSettings.linkDistance;
  el("gsLinkDistanceVal").textContent = state.graphSettings.linkDistance;
  el("gsMovement").value = state.graphSettings.movementIntensity;
  el("gsMovementVal").textContent = state.graphSettings.movementIntensity.toFixed(2);
  renderGraphThemeFilter();
  renderGraphTagFilter();
  renderGroupsList();
  renderSolarTagToggles();
  applyGraphCssVars();
}

// A note is colored by the first enabled group whose keyword matches one of
// its tags (exact or partial) or appears in its title; otherwise falls back
// to the theme-folder color.
function nodeColor(d) {
  const groups = state.graphSettings.groups || [];
  const tags = (d.tags || []).map((t) => t.toLowerCase());
  const title = (d.title || "").toLowerCase();
  for (const g of groups) {
    if (!g.enabled) continue;
    const kw = (g.keyword || "").toLowerCase().trim();
    if (!kw) continue;
    if (tags.includes(kw) || tags.some((t) => t.includes(kw)) || title.includes(kw)) return g.color;
  }
  return folderColor(d.folder);
}

// ---------------------------------------------------------------------
// Groups (color-coded keyword clusters, overlaid on top of the theme color)
// ---------------------------------------------------------------------
function renderGroupsList() {
  const box = el("groupsList");
  box.innerHTML = "";
  const groups = state.graphSettings.groups;
  if (groups.length === 0) {
    box.innerHTML = '<div class="groups-empty">Nenhum grupo criado.</div>';
    return;
  }
  for (const g of groups) {
    const row = document.createElement("div");
    row.className = "group-row";

    const swatch = document.createElement("span");
    swatch.className = "group-swatch";
    swatch.style.background = g.color;

    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = `${g.name} (${g.keyword})`;
    label.title = label.textContent;

    const toggle = document.createElement("button");
    toggle.className = "btn small" + (g.enabled ? " active" : "");
    toggle.textContent = g.enabled ? "Ativo" : "Inativo";
    toggle.title = g.enabled ? "Desativar grupo" : "Ativar grupo";
    toggle.addEventListener("click", () => {
      g.enabled = !g.enabled;
      saveGraphSettings();
      renderGroupsList();
      renderActiveGraph();
    });

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "✕";
    del.title = "Remover grupo";
    del.addEventListener("click", () => {
      state.graphSettings.groups = state.graphSettings.groups.filter((x) => x.id !== g.id);
      saveGraphSettings();
      renderGroupsList();
      renderActiveGraph();
    });

    row.appendChild(swatch);
    row.appendChild(label);
    row.appendChild(toggle);
    row.appendChild(del);
    box.appendChild(row);
  }
}

el("groupAdd").addEventListener("click", () => {
  const name = el("groupName").value.trim();
  const keyword = el("groupKeyword").value.trim();
  const color = el("groupColor").value;
  if (!name || !keyword) return;
  state.graphSettings.groups.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    keyword,
    color,
    enabled: true,
  });
  saveGraphSettings();
  el("groupName").value = "";
  el("groupKeyword").value = "";
  renderGroupsList();
  renderActiveGraph();
});

// ---------------------------------------------------------------------
// Per-tag on/off toggles for which suns appear in the Solar System view
// ---------------------------------------------------------------------
function renderSolarTagToggles() {
  const box = el("solarTagToggles");
  box.innerHTML = "";
  for (const tag of SOLAR_TAGS) {
    const pill = document.createElement("span");
    const disabled = state.graphSettings.solarTagsDisabled.includes(tag);
    pill.className = "tag-pill" + (disabled ? "" : " active");
    pill.textContent = tag;
    pill.title = disabled ? "Desativada — clique para ativar" : "Ativa — clique para desativar";
    pill.addEventListener("click", () => {
      const idx = state.graphSettings.solarTagsDisabled.indexOf(tag);
      if (idx === -1) state.graphSettings.solarTagsDisabled.push(tag);
      else state.graphSettings.solarTagsDisabled.splice(idx, 1);
      saveGraphSettings();
      renderSolarTagToggles();
      renderActiveGraph();
    });
    box.appendChild(pill);
  }
}

// ---------------------------------------------------------------------
// Settings panel tabs
// ---------------------------------------------------------------------
function switchSettingsTab(tab) {
  for (const [id, key] of [
    ["gsTabForca", "forca"],
    ["gsTabTela", "tela"],
    ["gsTabGrupos", "grupos"],
  ]) {
    el(id).classList.toggle("active", tab === key);
  }
  for (const [id, key] of [
    ["gsPanelForca", "forca"],
    ["gsPanelTela", "tela"],
    ["gsPanelGrupos", "grupos"],
  ]) {
    el(id).classList.toggle("hidden", tab !== key);
  }
}
el("gsTabForca").addEventListener("click", () => switchSettingsTab("forca"));
el("gsTabTela").addEventListener("click", () => switchSettingsTab("tela"));
el("gsTabGrupos").addEventListener("click", () => switchSettingsTab("grupos"));

function renderGraph() {
  applyGraphCssVars();
  const svg = d3.select("#graphSvg");
  svg.selectAll("*").remove();
  const wrap = document.getElementById("graphView");
  const width = wrap.clientWidth || 800;
  const height = wrap.clientHeight || 600;
  svg.attr("viewBox", [0, 0, width, height]);

  const nodesMap = new Map();
  for (const [path, note] of Object.entries(state.index)) {
    if (!noteMatchesGraphFilters(note)) continue;
    nodesMap.set(path, { id: path, title: note.title, folder: note.folder, tags: note.tags, degree: 0 });
  }
  const links = [];
  for (const path of nodesMap.keys()) {
    const note = state.index[path];
    for (const l of note.links) {
      if (l.resolved && l.resolved !== path && nodesMap.has(l.resolved)) {
        links.push({ source: path, target: l.resolved });
      }
    }
  }
  for (const link of links) {
    nodesMap.get(link.source).degree += 1;
    nodesMap.get(link.target).degree += 1;
  }
  const nodes = Array.from(nodesMap.values());

  if (nodes.length === 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--text-dim)")
      .attr("font-size", 13)
      .text("Nenhuma nota corresponde aos filtros.");
    return;
  }

  const scale = state.graphSettings.nodeScale;
  const maxDegree = Math.max(1, ...nodes.map((n) => n.degree));
  const radiusScale = d3.scaleSqrt().domain([0, maxDegree]).range([4 * scale, 16 * scale]).clamp(true);
  const radiusOf = (d) => radiusScale(d.degree);

  const g = svg.append("g");
  svg.call(
    d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => g.attr("transform", event.transform))
  );

  const s = state.graphSettings;
  const ambientAlpha = s.movementIntensity > 0 ? 0.03 + s.movementIntensity * 0.12 : 0;

  const simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(0.02)
    .alphaTarget(ambientAlpha)
    .velocityDecay(0.35)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(s.linkDistance).strength(s.linkStrength))
    .force("charge", d3.forceManyBody().strength((d) => -s.chargeStrength - radiusOf(d) * 6))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(s.centerStrength))
    .force("collide", d3.forceCollide((d) => radiusOf(d) + 14))
    .force("jiggle", forceJiggle(s.movementIntensity * 1.2));

  const link = g
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "graph-link");

  const node = g
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "graph-node")
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(ambientAlpha);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => openNote(d.id));

  node.append("circle").attr("r", radiusOf).attr("fill", (d) => nodeColor(d));

  nodes.forEach((n) => { n._r = radiusOf(n); });
  const label = node.append("text").attr("dy", (d) => radiusOf(d) + 8);
  label.each(function (d) {
    const lines = wrapLabel(d.title, 16);
    const text = d3.select(this);
    lines.forEach((line, i) => {
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? 0 : "1.05em")
        .text(line);
    });
  });
  currentLabelSelection = label;
  applyLabelVisibility();

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  // Stop the simulation (and its perpetual ambient jiggle) once the user
  // navigates away from the graph view, so it doesn't run forever in the background.
  const graphViewEl = document.getElementById("graphView");
  const stopObserver = new MutationObserver(() => {
    if (graphViewEl.classList.contains("hidden")) {
      simulation.stop();
      stopObserver.disconnect();
    }
  });
  stopObserver.observe(graphViewEl, { attributes: true, attributeFilter: ["class"] });
}

// ---------------------------------------------------------------------
// Solar system view — etiquetas viram "sóis" e as notas que carregam
// aquela etiqueta orbitam ao redor dela como planetas.
// ---------------------------------------------------------------------
function sunLabel(tag) {
  return tag.split("/").pop().replace(/-/g, " ");
}

function renderSolarSystem() {
  applyGraphCssVars();
  const svg = d3.select("#graphSvg");
  svg.selectAll("*").remove();
  const wrap = document.getElementById("graphView");
  const width = wrap.clientWidth || 800;
  const height = wrap.clientHeight || 600;
  svg.attr("viewBox", [0, 0, width, height]);

  const scale = state.graphSettings.nodeScale;

  const activeSolarTags = SOLAR_TAGS.filter((t) => !state.graphSettings.solarTagsDisabled.includes(t));
  const sunNodes = activeSolarTags.map((tag) => ({ id: "sun:" + tag, tag, isSun: true, degree: 0 }));
  const sunById = new Map(sunNodes.map((s) => [s.id, s]));

  const planetNodes = [];
  const links = [];
  for (const [path, note] of Object.entries(state.index)) {
    if (!noteMatchesGraphFilters(note)) continue;
    const matchingTags = note.tags.filter((t) => sunById.has("sun:" + t));
    if (matchingTags.length === 0) continue;
    planetNodes.push({
      id: path,
      title: note.title,
      folder: note.folder,
      tags: note.tags,
      isSun: false,
      degree: matchingTags.length,
    });
    for (const t of matchingTags) {
      links.push({ source: "sun:" + t, target: path });
      sunById.get("sun:" + t).degree += 1;
    }
  }

  if (planetNodes.length === 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--text-dim)")
      .attr("font-size", 13)
      .text("Nenhuma nota com essas etiquetas (ou os filtros escondem todas).");
    return;
  }

  const nodes = [...sunNodes, ...planetNodes];
  const maxSunDegree = Math.max(1, ...sunNodes.map((n) => n.degree));
  const sunRadiusScale = d3.scaleSqrt().domain([0, maxSunDegree]).range([9 * scale, 26 * scale]).clamp(true);
  const maxPlanetDegree = Math.max(1, ...planetNodes.map((n) => n.degree));
  const planetRadiusScale = d3.scaleSqrt().domain([1, maxPlanetDegree]).range([3.5 * scale, 9 * scale]).clamp(true);
  const radiusOf = (d) => (d.isSun ? sunRadiusScale(d.degree) : planetRadiusScale(d.degree));

  const g = svg.append("g");
  svg.call(
    d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => g.attr("transform", event.transform))
  );

  const s = state.graphSettings;
  const ambientAlpha = s.movementIntensity > 0 ? 0.03 + s.movementIntensity * 0.12 : 0;
  const simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(0.02)
    .alphaTarget(ambientAlpha)
    .velocityDecay(0.35)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((d) => radiusOf(d.source) + radiusOf(d.target) + s.linkDistance)
        .strength(s.linkStrength)
    )
    .force("charge", d3.forceManyBody().strength((d) => (d.isSun ? -s.chargeStrength * 4 : -s.chargeStrength * 0.5)))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(s.centerStrength))
    .force("collide", d3.forceCollide((d) => radiusOf(d) + (d.isSun ? 20 : 10)))
    .force("jiggle", forceJiggle(s.movementIntensity * 1.2));

  const link = g.append("g").selectAll("line").data(links).join("line").attr("class", "graph-link orbit");

  // Clicking a sun highlights it and the planets orbiting it; clicking it
  // again (or another sun) resets/moves the focus.
  let focusedSun = null;
  function applyFocus() {
    if (!focusedSun) {
      node.classed("dimmed", false);
      link.classed("dimmed", false);
      return;
    }
    const connected = new Set([focusedSun]);
    for (const l of links) {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      if (src === focusedSun) connected.add(tgt);
      if (tgt === focusedSun) connected.add(src);
    }
    node.classed("dimmed", (d) => !connected.has(d.id));
    link.classed("dimmed", (l) => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      return src !== focusedSun && tgt !== focusedSun;
    });
  }

  const node = g
    .append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", (d) => "graph-node" + (d.isSun ? " sun" : ""))
    .call(
      d3
        .drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(ambientAlpha);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => {
      if (d.isSun) {
        focusedSun = focusedSun === d.id ? null : d.id;
        applyFocus();
      } else {
        openNote(d.id);
      }
    });

  node.append("circle").attr("r", radiusOf).attr("fill", (d) => (d.isSun ? null : nodeColor(d)));
  node.append("title").text((d) => (d.isSun ? `${d.tag} (${d.degree} nota${d.degree === 1 ? "" : "s"})` : d.title));

  nodes.forEach((n) => { n._r = radiusOf(n); });
  const label = node.append("text").attr("dy", (d) => radiusOf(d) + 8);
  label.each(function (d) {
    const text = d3.select(this);
    const lines = d.isSun ? wrapLabel(sunLabel(d.tag), 13) : wrapLabel(d.title, 16);
    lines.forEach((line, i) => {
      text
        .append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? 0 : "1.05em")
        .text(line);
    });
  });
  currentLabelSelection = label;
  applyLabelVisibility();

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  const graphViewEl = document.getElementById("graphView");
  const stopObserver = new MutationObserver(() => {
    if (graphViewEl.classList.contains("hidden")) {
      simulation.stop();
      stopObserver.disconnect();
    }
  });
  stopObserver.observe(graphViewEl, { attributes: true, attributeFilter: ["class"] });
}

function renderActiveGraph() {
  if (state.graphSettings.solarMode) renderSolarSystem();
  else renderGraph();
}

function updateSolarToggleUI() {
  el("solarToggleBtn").classList.toggle("active", state.graphSettings.solarMode);
}

function showGraphView() {
  el("emptyState").classList.add("hidden");
  el("editorView").classList.add("hidden");
  el("graphView").classList.remove("hidden");
  el("graphSettingsBtn").classList.remove("hidden");
  el("solarToggleBtn").classList.remove("hidden");
  populateGraphSettingsUI();
  updateSolarToggleUI();
  renderActiveGraph();
}

el("graphBtn").addEventListener("click", showGraphView);

el("solarToggleBtn").addEventListener("click", () => {
  state.graphSettings.solarMode = !state.graphSettings.solarMode;
  saveGraphSettings();
  updateSolarToggleUI();
  renderActiveGraph();
});

el("graphSettingsBtn").addEventListener("click", () => {
  el("graphSettingsPanel").classList.toggle("hidden");
});

el("gsFontSize").addEventListener("input", (e) => {
  state.graphSettings.fontSize = parseFloat(e.target.value);
  el("gsFontSizeVal").textContent = state.graphSettings.fontSize + "px";
  applyGraphCssVars();
  saveGraphSettings();
});

el("gsLinkIntensity").addEventListener("input", (e) => {
  state.graphSettings.linkIntensity = parseFloat(e.target.value);
  el("gsLinkIntensityVal").textContent = state.graphSettings.linkIntensity.toFixed(2);
  applyGraphCssVars();
  saveGraphSettings();
});

el("gsNodeSize").addEventListener("input", (e) => {
  state.graphSettings.nodeScale = parseFloat(e.target.value);
  el("gsNodeSizeVal").textContent = state.graphSettings.nodeScale.toFixed(1) + "×";
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsLabelThreshold").addEventListener("input", (e) => {
  state.graphSettings.labelVisibilityThreshold = parseFloat(e.target.value);
  el("gsLabelThresholdVal").textContent = state.graphSettings.labelVisibilityThreshold;
  saveGraphSettings();
  applyLabelVisibility();
});

el("gsCenterStrength").addEventListener("input", (e) => {
  state.graphSettings.centerStrength = parseFloat(e.target.value);
  el("gsCenterStrengthVal").textContent = state.graphSettings.centerStrength.toFixed(1);
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsChargeStrength").addEventListener("input", (e) => {
  state.graphSettings.chargeStrength = parseFloat(e.target.value);
  el("gsChargeStrengthVal").textContent = state.graphSettings.chargeStrength;
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsLinkStrength").addEventListener("input", (e) => {
  state.graphSettings.linkStrength = parseFloat(e.target.value);
  el("gsLinkStrengthVal").textContent = state.graphSettings.linkStrength.toFixed(2);
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsLinkDistance").addEventListener("input", (e) => {
  state.graphSettings.linkDistance = parseFloat(e.target.value);
  el("gsLinkDistanceVal").textContent = state.graphSettings.linkDistance;
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsMovement").addEventListener("input", (e) => {
  state.graphSettings.movementIntensity = parseFloat(e.target.value);
  el("gsMovementVal").textContent = state.graphSettings.movementIntensity.toFixed(2);
  saveGraphSettings();
  debounceRenderActiveGraph();
});

el("gsThemeFilter").addEventListener("change", (e) => {
  state.graphSettings.theme = e.target.value;
  saveGraphSettings();
  renderActiveGraph();
});

el("gsReset").addEventListener("click", () => {
  state.graphSettings = { ...GRAPH_SETTINGS_DEFAULTS, tags: [], groups: [], solarTagsDisabled: [] };
  saveGraphSettings();
  populateGraphSettingsUI();
  updateSolarToggleUI();
  renderActiveGraph();
});

// ---------------------------------------------------------------------
// Boot — load the pre-baked data.json instead of hitting a local API
// ---------------------------------------------------------------------
async function init() {
  const res = await fetch("data.json");
  const data = await res.json();
  state.tree = data.tree;
  state.index = data.notes;
  refreshTreeView();
  renderTagList();
}

init();
