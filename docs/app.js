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
const GRAPH_SETTINGS_DEFAULTS = { fontSize: 5, nodeScale: 1, linkIntensity: 0.45, theme: "", tags: [] };

function loadGraphSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(GRAPH_SETTINGS_KEY) || "{}");
    return {
      fontSize: typeof saved.fontSize === "number" ? saved.fontSize : GRAPH_SETTINGS_DEFAULTS.fontSize,
      nodeScale: typeof saved.nodeScale === "number" ? saved.nodeScale : GRAPH_SETTINGS_DEFAULTS.nodeScale,
      linkIntensity: typeof saved.linkIntensity === "number" ? saved.linkIntensity : GRAPH_SETTINGS_DEFAULTS.linkIntensity,
      theme: typeof saved.theme === "string" ? saved.theme : GRAPH_SETTINGS_DEFAULTS.theme,
      tags: Array.isArray(saved.tags) ? saved.tags : [],
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
      renderGraph();
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

  const link = g.append("g").selectAll("line").data(links).join("line").attr("class", "graph-link");

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
      text.append("tspan").attr("x", 0).attr("dy", i === 0 ? 0 : "1.05em").text(line);
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

el("graphBtn").addEventListener("click", () => {
  el("emptyState").classList.add("hidden");
  el("editorView").classList.add("hidden");
  el("graphView").classList.remove("hidden");
  el("graphSettingsBtn").classList.remove("hidden");
  populateGraphSettingsUI();
  renderGraph();
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
  nodeSizeDebounce = setTimeout(renderGraph, 120);
});

el("gsThemeFilter").addEventListener("change", (e) => {
  state.graphSettings.theme = e.target.value;
  saveGraphSettings();
  renderGraph();
});

el("gsReset").addEventListener("click", () => {
  state.graphSettings = { ...GRAPH_SETTINGS_DEFAULTS, tags: [] };
  saveGraphSettings();
  populateGraphSettingsUI();
  renderGraph();
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
