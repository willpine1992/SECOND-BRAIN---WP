"use strict";

const state = {
  tree: [],
  index: {}, // path -> note meta (from /api/index)
  currentPath: null,
  dirty: false,
  mode: "edit", // "edit" | "preview"
  activeTag: null,
};

const el = (id) => document.getElementById(id);

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
    row.innerHTML = `<span class="fm-key">${k}:</span>${escapeHtml(String(val))}`;
    fmBox.appendChild(row);
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
function folderColor(folder) {
  const top = (folder || "").split("/")[0] || "raiz";
  let hash = 0;
  for (let i = 0; i < top.length; i++) hash = top.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

function renderGraph() {
  const svg = d3.select("#graphSvg");
  svg.selectAll("*").remove();
  const wrap = document.getElementById("graphView");
  const width = wrap.clientWidth || 800;
  const height = wrap.clientHeight || 600;
  svg.attr("viewBox", [0, 0, width, height]);

  const nodesMap = new Map();
  for (const [path, note] of Object.entries(state.index)) {
    nodesMap.set(path, { id: path, title: note.title, folder: note.folder });
  }
  const links = [];
  for (const [path, note] of Object.entries(state.index)) {
    for (const l of note.links) {
      if (l.resolved && l.resolved !== path && nodesMap.has(l.resolved)) {
        links.push({ source: path, target: l.resolved });
      }
    }
  }
  const nodes = Array.from(nodesMap.values());

  const g = svg.append("g");
  svg.call(
    d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => g.attr("transform", event.transform))
  );

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(70).strength(0.4))
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(16));

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
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    )
    .on("click", (event, d) => openNote(d.id));

  node.append("circle").attr("r", 7).attr("fill", (d) => folderColor(d.folder));
  node.append("text").attr("dx", 10).attr("dy", 4).text((d) => d.title);

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

el("graphBtn").addEventListener("click", () => {
  el("emptyState").classList.add("hidden");
  el("editorView").classList.add("hidden");
  el("graphView").classList.remove("hidden");
  renderGraph();
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
