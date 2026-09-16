"use strict";

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Graph settings (persisted per-browser; not vault content)
// ---------------------------------------------------------------------
const GRAPH_SETTINGS_KEY = "sb-graph-settings";
const GRAPH_SETTINGS_DEFAULTS = { fontSize: 5, nodeScale: 1, linkIntensity: 0.45, theme: "", tags: [], solarMode: false };

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
    return {
      fontSize: typeof saved.fontSize === "number" ? saved.fontSize : GRAPH_SETTINGS_DEFAULTS.fontSize,
      nodeScale: typeof saved.nodeScale === "number" ? saved.nodeScale : GRAPH_SETTINGS_DEFAULTS.nodeScale,
      linkIntensity: typeof saved.linkIntensity === "number" ? saved.linkIntensity : GRAPH_SETTINGS_DEFAULTS.linkIntensity,
      theme: typeof saved.theme === "string" ? saved.theme : GRAPH_SETTINGS_DEFAULTS.theme,
      tags: Array.isArray(saved.tags) ? saved.tags : [],
      solarMode: typeof saved.solarMode === "boolean" ? saved.solarMode : GRAPH_SETTINGS_DEFAULTS.solarMode,
    };
  } catch {
    return { ...GRAPH_SETTINGS_DEFAULTS, tags: [] };
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
  index: {}, // path -> note meta (from /api/index)
  currentPath: null,
  dirty: false,
  mode: "edit", // "edit" | "preview"
  activeTag: null,
  graphSettings: loadGraphSettings(),
};

// ---------------------------------------------------------------------
// Custom confirm/alert (no native window.confirm/alert — those block the
// whole page and are unpleasant UX for a local app)
// ---------------------------------------------------------------------
function showConfirm(message, { okOnly } = {}) {
  return new Promise((resolve) => {
    el("confirmMessage").textContent = message;
    el("confirmCancel").classList.toggle("hidden", !!okOnly);
    el("confirmModal").classList.remove("hidden");
    const cleanup = (result) => {
      el("confirmModal").classList.add("hidden");
      el("confirmOk").removeEventListener("click", onOk);
      el("confirmCancel").removeEventListener("click", onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    el("confirmOk").addEventListener("click", onOk);
    el("confirmCancel").addEventListener("click", onCancel);
  });
}

function showAlert(message) {
  return showConfirm(message, { okOnly: true });
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
// API helpers
// ---------------------------------------------------------------------
async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function fetchTree() {
  const data = await api("/api/tree");
  state.tree = data.tree;
}

async function fetchIndex() {
  const data = await api("/api/index");
  state.index = data.notes;
}

async function fetchNote(path) {
  return api(`/api/note?path=${encodeURIComponent(path)}`);
}

async function saveNote(path, content) {
  return api("/api/note", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

async function createNote(path, content) {
  return api("/api/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

async function deleteNoteApi(path) {
  return api(`/api/note?path=${encodeURIComponent(path)}`, { method: "DELETE" });
}

async function searchNotes(query, tag) {
  return api("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, tag }),
  });
}

async function fetchTemplates() {
  const data = await api("/api/templates");
  return data.templates;
}

// ---------------------------------------------------------------------
// Tree rendering
// ---------------------------------------------------------------------
function renderTree(nodes, container, depth) {
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
      childWrap.appendChild(renderTree(node.children, childWrap, depth + 1));
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
  renderTree(state.tree, el("tree"), 0);
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
// Search (filters tree by re-rendering as flat filtered list when active)
// ---------------------------------------------------------------------
async function runSearch() {
  const q = el("searchInput").value.trim();
  if (!q && !state.activeTag) {
    refreshTreeView();
    return;
  }
  const data = await searchNotes(q, state.activeTag);
  const container = el("tree");
  container.innerHTML = "";
  const ul = document.createElement("ul");
  for (const r of data.results) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "node file" + (r.path === state.currentPath ? " active" : "");
    row.textContent = "📄 " + r.title;
    row.title = r.path;
    row.addEventListener("click", () => openNote(r.path));
    li.appendChild(row);
    ul.appendChild(li);
  }
  if (data.results.length === 0) {
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
  // strip frontmatter block for preview
  let body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  // protect wikilinks before markdown parsing by converting them to placeholder tokens
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
    if (resolved) {
      return `<a class="wikilink" data-path="${resolved}">${label}</a>`;
    }
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
        const target = a.getAttribute("data-target");
        promptCreateFromLink(target);
      }
    });
  });
}

async function promptCreateFromLink(title) {
  const ok = await showConfirm(`A nota "${title}" ainda não existe. Criar agora?`);
  if (!ok) return;
  const folder = state.currentPath ? state.currentPath.split("/").slice(0, -1).join("/") : "Inbox";
  const path = (folder ? folder + "/" : "") + title + ".md";
  const today = new Date().toISOString().slice(0, 10);
  const content = `---\ntags: []\ndata: ${today}\n---\n\n# ${title}\n\n`;
  await createNote(path, content);
  await refreshAll();
  openNote(path);
}

// ---------------------------------------------------------------------
// Opening / editing notes
// ---------------------------------------------------------------------
async function openNote(path) {
  if (state.dirty && state.currentPath) {
    const ok = await showConfirm("Você tem alterações não salvas. Descartar e abrir outra nota?");
    if (!ok) return;
  }
  const data = await fetchNote(path);
  state.currentPath = path;
  state.dirty = false;

  el("emptyState").classList.add("hidden");
  el("graphView").classList.add("hidden");
  el("graphSettingsBtn").classList.add("hidden");
  el("graphSettingsPanel").classList.add("hidden");
  el("solarToggleBtn").classList.add("hidden");
  el("editorView").classList.remove("hidden");
  el("notePath").textContent = path;
  el("editorTextarea").value = data.content;

  setMode(state.mode || "edit");
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

  // Shortcut button in the editor toolbar for one-click access to the source.
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
      a.addEventListener("click", () => promptCreateFromLink(link.target));
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

// ---------------------------------------------------------------------
// Editor events
// ---------------------------------------------------------------------
el("editorTextarea").addEventListener("input", () => {
  state.dirty = true;
});

el("modeEditBtn").addEventListener("click", () => setMode("edit"));
el("modePreviewBtn").addEventListener("click", () => setMode("preview"));

el("saveBtn").addEventListener("click", async () => {
  if (!state.currentPath) return;
  await saveNote(state.currentPath, el("editorTextarea").value);
  state.dirty = false;
  await fetchIndex();
  renderTagList();
  renderSideMeta(state.currentPath);
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    el("saveBtn").click();
  }
});

el("deleteBtn").addEventListener("click", async () => {
  if (!state.currentPath) return;
  const ok = await showConfirm(`Excluir "${state.currentPath}"? Essa ação não pode ser desfeita.`);
  if (!ok) return;
  await deleteNoteApi(state.currentPath);
  state.currentPath = null;
  el("editorView").classList.add("hidden");
  el("emptyState").classList.remove("hidden");
  await refreshAll();
});

// ---------------------------------------------------------------------
// Search input
// ---------------------------------------------------------------------
let searchDebounce;
el("searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(runSearch, 200);
});

// ---------------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------------
el("toggleSidebar").addEventListener("click", () => {
  el("sidebar").classList.toggle("collapsed");
});

// ---------------------------------------------------------------------
// New note modal
// ---------------------------------------------------------------------
function collectFolders(nodes, prefix, out) {
  for (const node of nodes) {
    if (node.type === "dir") {
      out.push(node.path);
      collectFolders(node.children, node.path, out);
    }
  }
  return out;
}

async function openNewNoteModal(prefillFolder) {
  const folders = ["", ...collectFolders(state.tree, "", [])];
  const folderSel = el("newNoteFolder");
  folderSel.innerHTML = "";
  for (const f of folders) {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f || "(raiz)";
    folderSel.appendChild(opt);
  }
  if (prefillFolder) folderSel.value = prefillFolder;

  const templates = await fetchTemplates();
  const tplSel = el("newNoteTemplate");
  tplSel.innerHTML = "";
  const blankOpt = document.createElement("option");
  blankOpt.value = "";
  blankOpt.textContent = "(em branco)";
  tplSel.appendChild(blankOpt);
  for (const t of templates) {
    const opt = document.createElement("option");
    opt.value = t.path;
    opt.textContent = t.name;
    tplSel.appendChild(opt);
  }

  el("newNoteTitle").value = "";
  el("newNoteModal").classList.remove("hidden");
  el("newNoteTitle").focus();
}

el("newNoteBtn").addEventListener("click", () => {
  const folder = state.currentPath ? state.currentPath.split("/").slice(0, -1).join("/") : "";
  openNewNoteModal(folder);
});
el("newNoteCancel").addEventListener("click", () => el("newNoteModal").classList.add("hidden"));

el("newNoteCreate").addEventListener("click", async () => {
  const folder = el("newNoteFolder").value;
  const title = el("newNoteTitle").value.trim();
  const tplPath = el("newNoteTemplate").value;
  if (!title) {
    await showAlert("Digite um título.");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  let content;
  if (tplPath) {
    const tplData = await fetchNote(tplPath);
    content = tplData.content.replaceAll("{{title}}", title).replaceAll("{{date}}", today);
  } else {
    content = `---\ntags: []\ndata: ${today}\n---\n\n# ${title}\n\n`;
  }
  const path = (folder ? folder + "/" : "") + title + ".md";
  try {
    await createNote(path, content);
  } catch (e) {
    await showAlert("Erro ao criar nota: " + e.message);
    return;
  }
  el("newNoteModal").classList.add("hidden");
  await refreshAll();
  openNote(path);
});

// ---------------------------------------------------------------------
// Daily note
// ---------------------------------------------------------------------
el("dailyNoteBtn").addEventListener("click", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const path = `Diario/${today}.md`;
  if (!state.index[path]) {
    let content = `---\ntags: [diario, sessao]\ndata: ${today}\n---\n\n# ${today}\n\n## Projeto(s) tocado(s)\n- [[]]\n\n## O que foi feito\n\n## Decisões tomadas\n\n## Bloqueios / dúvidas em aberto\n\n## Próxima ação\n`;
    const tpl = (await fetchTemplates()).find((t) => t.name.toLowerCase().includes("sessao") || t.name.toLowerCase().includes("sessão"));
    if (tpl) {
      const tplData = await fetchNote(tpl.path);
      content = tplData.content.replaceAll("{{title}}", today).replaceAll("{{date}}", today);
    }
    await createNote(path, content);
    await refreshAll();
  }
  openNote(path);
});

// ---------------------------------------------------------------------
// Graph view
// ---------------------------------------------------------------------
// A "tema" folder is one directly containing Artigos/ and/or Minhas Notas/
// (the vault's convention) — these are what the user picks from in the
// theme filter, e.g. "QUIMIOINFORMATICA", not arbitrary intermediate folders.
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
  renderGraphThemeFilter();
  renderGraphTagFilter();
  applyGraphCssVars();
}

function folderColor(folder) {
  const top = (folder || "").split("/")[0] || "raiz";
  let hash = 0;
  for (let i = 0; i < top.length; i++) hash = top.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

// Splits a title into up to 3 short lines (word-wrapped), ellipsizing
// whatever doesn't fit, so labels stay readable at small node sizes.
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

// Gently nudges every node's velocity each tick so the graph keeps drifting
// like loose particles instead of settling into a static layout.
function forceJiggle(strength) {
  let nodes = [];
  function force() {
    for (const n of nodes) {
      if (n.fx != null) continue; // being dragged, leave it alone
      n.vx += (Math.random() - 0.5) * strength;
      n.vy += (Math.random() - 0.5) * strength;
    }
  }
  force.initialize = (_nodes) => { nodes = _nodes; };
  return force;
}

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
    nodesMap.set(path, { id: path, title: note.title, folder: note.folder, degree: 0 });
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

  const AMBIENT_ALPHA = 0.08;

  const simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(0.02)
    .alphaTarget(AMBIENT_ALPHA)
    .velocityDecay(0.35)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(70).strength(0.35))
    .force("charge", d3.forceManyBody().strength((d) => -80 - radiusOf(d) * 6))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide((d) => radiusOf(d) + 14))
    .force("jiggle", forceJiggle(0.5));

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
          if (!event.active) simulation.alphaTarget(AMBIENT_ALPHA);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => openNote(d.id));

  node.append("circle").attr("r", radiusOf).attr("fill", (d) => folderColor(d.folder));

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

  const sunNodes = SOLAR_TAGS.map((tag) => ({ id: "sun:" + tag, tag, isSun: true, degree: 0 }));
  const sunById = new Map(sunNodes.map((s) => [s.id, s]));

  const planetNodes = [];
  const links = [];
  for (const [path, note] of Object.entries(state.index)) {
    if (!noteMatchesGraphFilters(note)) continue;
    const matchingTags = note.tags.filter((t) => sunById.has("sun:" + t));
    if (matchingTags.length === 0) continue;
    planetNodes.push({ id: path, title: note.title, folder: note.folder, isSun: false, degree: matchingTags.length });
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

  const AMBIENT_ALPHA = 0.05;
  const simulation = d3
    .forceSimulation(nodes)
    .alphaDecay(0.02)
    .alphaTarget(AMBIENT_ALPHA)
    .velocityDecay(0.35)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance((d) => radiusOf(d.source) + radiusOf(d.target) + 26)
        .strength(0.5)
    )
    .force("charge", d3.forceManyBody().strength((d) => (d.isSun ? -320 : -40)))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide((d) => radiusOf(d) + (d.isSun ? 20 : 10)))
    .force("jiggle", forceJiggle(0.35));

  const link = g.append("g").selectAll("line").data(links).join("line").attr("class", "graph-link orbit");

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
          if (!event.active) simulation.alphaTarget(AMBIENT_ALPHA);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => {
      if (!d.isSun) openNote(d.id);
    });

  node.append("circle").attr("r", radiusOf).attr("fill", (d) => (d.isSun ? null : folderColor(d.folder)));
  node.append("title").text((d) => (d.isSun ? `${d.tag} (${d.degree} nota${d.degree === 1 ? "" : "s"})` : d.title));

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

el("graphBtn").addEventListener("click", () => {
  el("emptyState").classList.add("hidden");
  el("editorView").classList.add("hidden");
  el("graphView").classList.remove("hidden");
  el("graphSettingsBtn").classList.remove("hidden");
  el("solarToggleBtn").classList.remove("hidden");
  populateGraphSettingsUI();
  updateSolarToggleUI();
  renderActiveGraph();
});

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

let nodeSizeDebounce;
el("gsNodeSize").addEventListener("input", (e) => {
  state.graphSettings.nodeScale = parseFloat(e.target.value);
  el("gsNodeSizeVal").textContent = state.graphSettings.nodeScale.toFixed(1) + "×";
  saveGraphSettings();
  clearTimeout(nodeSizeDebounce);
  nodeSizeDebounce = setTimeout(renderActiveGraph, 120);
});

el("gsThemeFilter").addEventListener("change", (e) => {
  state.graphSettings.theme = e.target.value;
  saveGraphSettings();
  renderActiveGraph();
});

el("gsReset").addEventListener("click", () => {
  state.graphSettings = { ...GRAPH_SETTINGS_DEFAULTS, tags: [] };
  saveGraphSettings();
  populateGraphSettingsUI();
  updateSolarToggleUI();
  renderActiveGraph();
});

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
async function refreshAll() {
  await Promise.all([fetchTree(), fetchIndex()]);
  refreshTreeView();
  renderTagList();
}

refreshAll();
