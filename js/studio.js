/* =========================================
   PDFKit Studio — Editor (Part 1: Core)
   ========================================= */

let project = null;
let currentPageIndex = 0;
let activeTool = null;
let selectedElement = null;
let history = [];
let historyIndex = -1;

const toolSettings = {
  text: { text: "Type here", font: "Inter", size: 24, color: "#1a1a1a", bold: false, italic: false },
  highlight: { color: "#fef08a", size: 20 },
  draw: { color: "#e53935", size: 4 },
  shape: { color: "#1a1a1a", fill: "transparent", type: "rect" },
  eraser: {},
};

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (!projectId) {
    window.location.href = "index.html";
    return;
  }

  try {
    project = await getProject(projectId);
  } catch (err) {
    console.error("Failed to load project:", err);
  }

  if (!project) {
    alert("Project not found. Redirecting to home.");
    window.location.href = "index.html";
    return;
  }

  if (!project.pages || project.pages.length === 0) {
    project.pages = [{
      id: "page_1",
      background: project.background || "#ffffff",
      elements: [],
    }];
  }

  const titleInput = document.getElementById("project-title");
  if (titleInput) titleInput.value = project.name || "Untitled";

  try {
    renderPages();
    setupToolbar();
    setupHeader();
    pushHistory();
  } catch (err) {
    console.error("Setup error:", err);
  }
});

function setupHeader() {
  document.getElementById("save-btn")?.addEventListener("click", saveProjectNow);
  document.getElementById("undo-btn")?.addEventListener("click", undo);
  document.getElementById("redo-btn")?.addEventListener("click", redo);
  document.getElementById("export-btn")?.addEventListener("click", exportProject);

  document.getElementById("project-title")?.addEventListener("input", (e) => {
    project.name = e.target.value.trim() || "Untitled";
    scheduleAutoSave();
  });

  document.getElementById("panel-close")?.addEventListener("click", closePanel);
}

function setupToolbar() {
  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool;
      if (activeTool === tool) {
        activeTool = null;
        btn.classList.remove("active");
        closePanel();
        return;
      }
      document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeTool = tool;
      openToolPanel(tool);
    });
  });
}

function renderPages() {
  const stage = document.getElementById("canvas-stage");
  if (!stage) return;
  stage.innerHTML = "";

  const scale = calculateScale();

  project.pages.forEach((page, idx) => {
    const pageEl = document.createElement("div");
    pageEl.className = "page-canvas";
    pageEl.dataset.pageIndex = idx;

    pageEl.style.width = project.width * scale + "px";
    pageEl.style.height = project.height * scale + "px";
    pageEl.style.background = page.background || "#ffffff";

    page.elements.forEach((el) => {
      const node = createElementNode(el, scale, idx);
      if (node) pageEl.appendChild(node);
    });

    if (activeTool === "draw") {
      setupDrawing(pageEl, idx);
    }

    pageEl.addEventListener("click", (e) => {
      if (e.target === pageEl) deselectElement();
    });

    stage.appendChild(pageEl);
  });
}

function calculateScale() {
  const wrapper = document.getElementById("canvas-wrapper");
  if (!wrapper) return 1;
  const availableWidth = wrapper.clientWidth - 40;
  const availableHeight = window.innerHeight - 220;
  const maxW = availableWidth / project.width;
  const maxH = availableHeight / project.height;
  return Math.min(maxW, maxH, 1.2);
}
/* =========================================
   Part 2: Elements & Tools
   ========================================= */

function createElementNode(el, scale, pageIdx) {
  if (el.type === "text") {
    const div = document.createElement("div");
    div.className = "text-element";
    div.dataset.elementId = el.id;
    div.style.left = el.x * scale + "px";
    div.style.top = el.y * scale + "px";
    div.style.fontSize = el.size * scale + "px";
    div.style.fontFamily = el.font || "Inter";
    div.style.color = el.color || "#1a1a1a";
     div.style.direction = "auto";
div.style.unicodeBidi = "plaintext";
    div.style.fontWeight = el.bold ? "700" : "400";
    div.style.fontStyle = el.italic ? "italic" : "normal";
    if (el.width) div.style.width = el.width * scale + "px";
    div.textContent = el.text || "";
    const handle = document.createElement("span");
    handle.className = "resize-handle";
    div.appendChild(handle);
    makeDraggable(div, el, scale, pageIdx);
    makeResizable(div, el, scale, pageIdx);
    return div;
  }

  if (el.type === "image") {
    const div = document.createElement("div");
    div.className = "image-element";
    div.dataset.elementId = el.id;
    div.style.left = el.x * scale + "px";
    div.style.top = el.y * scale + "px";
    div.style.width = el.width * scale + "px";
    div.style.height = el.height * scale + "px";
    div.innerHTML = '<img src="' + el.src + '" alt="" /><span class="resize-handle"></span>';
    makeDraggable(div, el, scale, pageIdx);
    makeResizable(div, el, scale, pageIdx);
    return div;
  }

  if (el.type === "highlight" || el.type === "shape") {
    const div = document.createElement("div");
    div.className = "text-element";
    div.dataset.elementId = el.id;
    div.style.left = el.x * scale + "px";
    div.style.top = el.y * scale + "px";
    div.style.width = (el.width || 100) * scale + "px";
    div.style.height = (el.height || 30) * scale + "px";
    div.style.background = el.fill || el.color || "#fef08a";
    div.style.borderRadius = el.type === "shape" && el.shapeType === "circle" ? "50%" : "4px";
    div.innerHTML = '<span class="resize-handle"></span>';
    makeDraggable(div, el, scale, pageIdx);
    makeResizable(div, el, scale, pageIdx);
    return div;
  }

  return null;
}

function makeDraggable(node, el, scale, pageIdx) {
  let startX, startY, startLeft, startTop;
  let dragging = false;

  const onStart = (e) => {
    if (e.target.classList.contains("resize-handle")) return;
    e.preventDefault();
    selectElement(node, el, pageIdx);
    dragging = true;
    const p = getPoint(e);
    startX = p.x;
    startY = p.y;
    startLeft = el.x;
    startTop = el.y;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  };

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const p = getPoint(e);
    el.x = startLeft + (p.x - startX) / scale;
    el.y = startTop + (p.y - startY) / scale;
    node.style.left = el.x * scale + "px";
    node.style.top = el.y * scale + "px";
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    pushHistory();
    scheduleAutoSave();
  };

  node.addEventListener("mousedown", onStart);
  node.addEventListener("touchstart", onStart, { passive: false });
}

function makeResizable(node, el, scale, pageIdx) {
  const handle = node.querySelector(".resize-handle");
  if (!handle) return;

  let startX, startY, startW, startH;
  let resizing = false;

  const onStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectElement(node, el, pageIdx);
    resizing = true;
    const p = getPoint(e);
    startX = p.x;
    startY = p.y;
    startW = el.width || node.offsetWidth / scale;
    startH = el.height || node.offsetHeight / scale;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
  };

  const onMove = (e) => {
    if (!resizing) return;
    e.preventDefault();
    const p = getPoint(e);
    el.width = Math.max(30, startW + (p.x - startX) / scale);
    el.height = Math.max(20, startH + (p.y - startY) / scale);
    node.style.width = el.width * scale + "px";
    node.style.height = el.height * scale + "px";
  };

  const onEnd = () => {
    if (!resizing) return;
    resizing = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    pushHistory();
    scheduleAutoSave();
  };

  handle.addEventListener("mousedown", onStart);
  handle.addEventListener("touchstart", onStart, { passive: false });
}

function selectElement(node, el, pageIdx) {
  if (selectedElement && selectedElement.node !== node) {
    selectedElement.node.classList.remove("selected");
  }
  node.classList.add("selected");
  selectedElement = { node, el, pageIdx };
}

function deselectElement() {
  if (selectedElement) {
    selectedElement.node.classList.remove("selected");
    selectedElement = null;
  }
}

function openToolPanel(tool) {
  const panel = document.getElementById("tool-panel");
  const content = document.getElementById("panel-content");
  if (!panel || !content) return;

  if (tool === "text") content.innerHTML = renderTextPanel();
  else if (tool === "highlight") content.innerHTML = renderHighlightPanel();
  else if (tool === "draw") content.innerHTML = renderDrawPanel();
  else if (tool === "shape") content.innerHTML = renderShapePanel();
  else if (tool === "eraser") content.innerHTML = renderEraserPanel();

  panel.hidden = false;
  bindPanelEvents(tool);
}

function closePanel() {
  const panel = document.getElementById("tool-panel");
  if (panel) panel.hidden = true;
       }
/* =========================================
   Part 3: Panels, Drawing, Save, Export
   ========================================= */

function renderTextPanel() {
  return `
    <h3 class="panel-title">Text</h3>
    <div class="panel-row">
      <label class="panel-label">Content</label>
      <textarea class="panel-textarea" id="text-content" placeholder="Type your text..."></textarea>
    </div>
    <div class="panel-row">
      <label class="panel-label">Font</label>
      <div class="font-grid" id="font-grid">
        <button class="font-option active" data-font="Inter" style="font-family:Inter;">Inter</button>
        <button class="font-option" data-font="Cairo" style="font-family:Cairo;">Cairo</button>
        <button class="font-option" data-font="Amiri" style="font-family:Amiri;">Amiri</button>
        <button class="font-option" data-font="Tajawal" style="font-family:Tajawal;">Tajawal</button>
        <button class="font-option" data-font="Georgia, serif" style="font-family:Georgia;">Georgia</button>
        <button class="font-option" data-font="Courier New, monospace" style="font-family:'Courier New';">Mono</button>
      </div>
    </div>
    <div class="panel-row">
      <label class="panel-label">Size: <span id="size-value">24</span>px</label>
      <input type="range" class="size-slider" id="text-size" min="10" max="120" value="24" />
    </div>
    <div class="panel-row">
      <label class="panel-label">Color</label>
      <div class="color-options" id="text-colors">
        <button class="color-swatch active" data-color="#1a1a1a" style="background:#1a1a1a;"></button>
        <button class="color-swatch" data-color="#e53935" style="background:#e53935;"></button>
        <button class="color-swatch" data-color="#2563eb" style="background:#2563eb;"></button>
        <button class="color-swatch" data-color="#16a34a" style="background:#16a34a;"></button>
        <button class="color-swatch" data-color="#f59e0b" style="background:#f59e0b;"></button>
        <button class="color-swatch" data-color="#ffffff" style="background:#ffffff;border:1px solid #ccc;"></button>
      </div>
    </div>
    <button class="panel-btn" id="add-text-btn">Add Text</button>
  `;
}

function renderHighlightPanel() {
  return `
    <h3 class="panel-title">Highlight</h3>
    <div class="panel-row">
      <label class="panel-label">Color</label>
      <div class="color-options" id="hl-colors">
        <button class="color-swatch active" data-color="#fef08a" style="background:#fef08a;"></button>
        <button class="color-swatch" data-color="#bbf7d0" style="background:#bbf7d0;"></button>
        <button class="color-swatch" data-color="#fecaca" style="background:#fecaca;"></button>
        <button class="color-swatch" data-color="#bfdbfe" style="background:#bfdbfe;"></button>
        <button class="color-swatch" data-color="#e9d5ff" style="background:#e9d5ff;"></button>
      </div>
    </div>
    <button class="panel-btn" id="add-highlight-btn">Add Highlight</button>
  `;
}

function renderDrawPanel() {
  return `
    <h3 class="panel-title">Draw</h3>
    <div class="panel-row">
      <label class="panel-label">Color</label>
      <div class="color-options" id="draw-colors">
        <button class="color-swatch active" data-color="#1a1a1a" style="background:#1a1a1a;"></button>
        <button class="color-swatch" data-color="#e53935" style="background:#e53935;"></button>
        <button class="color-swatch" data-color="#2563eb" style="background:#2563eb;"></button>
        <button class="color-swatch" data-color="#16a34a" style="background:#16a34a;"></button>
        <button class="color-swatch" data-color="#f59e0b" style="background:#f59e0b;"></button>
      </div>
    </div>
    <div class="panel-row">
      <label class="panel-label">Brush size</label>
      <div class="brush-options" id="brush-options">
        <button class="brush-size active" data-size="2" style="--size:4px;"></button>
        <button class="brush-size" data-size="4" style="--size:8px;"></button>
        <button class="brush-size" data-size="8" style="--size:14px;"></button>
        <button class="brush-size" data-size="14" style="--size:22px;"></button>
      </div>
    </div>
    <p style="font-size:13px;color:var(--muted);text-align:center;">Draw directly on the page.</p>
  `;
}

function renderShapePanel() {
  return `
    <h3 class="panel-title">Shape</h3>
    <div class="panel-row">
      <label class="panel-label">Type</label>
      <div class="font-grid" id="shape-types">
        <button class="font-option active" data-shape="rect">Rectangle</button>
        <button class="font-option" data-shape="circle">Circle</button>
      </div>
    </div>
    <div class="panel-row">
      <label class="panel-label">Color</label>
      <div class="color-options" id="shape-colors">
        <button class="color-swatch active" data-color="#1a1a1a" style="background:#1a1a1a;"></button>
        <button class="color-swatch" data-color="#e53935" style="background:#e53935;"></button>
        <button class="color-swatch" data-color="#2563eb" style="background:#2563eb;"></button>
        <button class="color-swatch" data-color="#16a34a" style="background:#16a34a;"></button>
        <button class="color-swatch" data-color="#f59e0b" style="background:#f59e0b;"></button>
        <button class="color-swatch" data-color="#f5f5f5" style="background:#f5f5f5;border:1px solid #ccc;"></button>
      </div>
    </div>
    <button class="panel-btn" id="add-shape-btn">Add Shape</button>
  `;
}

function renderEraserPanel() {
  return `
    <h3 class="panel-title">Eraser</h3>
    <p style="font-size:14px;color:var(--muted);text-align:center;padding:20px 0;">
      Tap an element to delete it.
    </p>
  `;
}

function bindPanelEvents(tool) {
  if (tool === "text") {
    const content = document.getElementById("text-content");
    const sizeSlider = document.getElementById("text-size");
    const sizeValue = document.getElementById("size-value");

    content?.addEventListener("input", () => { toolSettings.text.text = content.value; });
    sizeSlider?.addEventListener("input", () => {
      if (sizeValue) sizeValue.textContent = sizeSlider.value;
      toolSettings.text.size = parseInt(sizeSlider.value);
    });

    document.querySelectorAll("#font-grid .font-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#font-grid .font-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.text.font = btn.dataset.font;
      });
    });

    document.querySelectorAll("#text-colors .color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#text-colors .color-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.text.color = btn.dataset.color;
      });
    });

    document.getElementById("add-text-btn")?.addEventListener("click", () => {
      const text = content?.value.trim() || toolSettings.text.text;
      addTextElement(text);
    });
  }

  if (tool === "highlight") {
    document.querySelectorAll("#hl-colors .color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#hl-colors .color-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.highlight.color = btn.dataset.color;
      });
    });
    document.getElementById("add-highlight-btn")?.addEventListener("click", addHighlightElement);
  }

  if (tool === "draw") {
    document.querySelectorAll("#draw-colors .color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#draw-colors .color-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.draw.color = btn.dataset.color;
      });
    });
    document.querySelectorAll("#brush-options .brush-size").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#brush-options .brush-size").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.draw.size = parseInt(btn.dataset.size);
      });
    });
    renderPages();
  }

  if (tool === "shape") {
    document.querySelectorAll("#shape-types .font-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#shape-types .font-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.shape.type = btn.dataset.shape;
      });
    });
    document.querySelectorAll("#shape-colors .color-swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#shape-colors .color-swatch").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        toolSettings.shape.color = btn.dataset.color;
      });
    });
    document.getElementById("add-shape-btn")?.addEventListener("click", addShapeElement);
  }
}

function addTextElement(text) {
  const page = project.pages[currentPageIndex];
  page.elements.push({
    id: "el_" + Date.now(),
    type: "text",
    text: text,
    x: 40,
    y: 40,
    font: toolSettings.text.font,
    size: toolSettings.text.size,
    color: toolSettings.text.color,
    bold: toolSettings.text.bold,
    italic: toolSettings.text.italic,
  });
  renderPages();
  pushHistory();
  scheduleAutoSave();
  closePanel();
  activeTool = null;
  document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
}

function addHighlightElement() {
  const page = project.pages[currentPageIndex];
  page.elements.push({
    id: "el_" + Date.now(),
    type: "highlight",
    x: 40,
    y: 40,
    width: 150,
    height: 30,
    color: toolSettings.highlight.color,
  });
  renderPages();
  pushHistory();
  scheduleAutoSave();
}

function addShapeElement() {
  const page = project.pages[currentPageIndex];
  page.elements.push({
    id: "el_" + Date.now(),
    type: "shape",
    shapeType: toolSettings.shape.type,
    x: 40,
    y: 40,
    width: 100,
    height: 100,
    color: toolSettings.shape.color,
    fill: toolSettings.shape.color,
  });
  renderPages();
  pushHistory();
  scheduleAutoSave();
}

function setupDrawing(pageEl, pageIdx) {
  const canvas = document.createElement("canvas");
  const scale = calculateScale();
  canvas.width = project.width * scale;
  canvas.height = project.height * scale;
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.touchAction = "none";
  canvas.style.zIndex = "5";

  pageEl.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let drawing = false;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const p = getPoint(e);
    return { x: p.x - rect.left, y: p.y - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = toolSettings.draw.color;
    ctx.lineWidth = toolSettings.draw.size * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing) return;
    drawing = false;
    const dataUrl = canvas.toDataURL("image/png");
    project.pages[pageIdx].elements.push({
      id: "el_" + Date.now(),
      type: "image",
      src: dataUrl,
      x: 0,
      y: 0,
      width: project.width,
      height: project.height,
      isDrawing: true,
    });
    canvas.remove();
    renderPages();
    pushHistory();
    scheduleAutoSave();
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}

function getPoint(e) {
  if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function pushHistory() {
  const snapshot = JSON.stringify(project.pages);
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(snapshot);
  if (history.length > 30) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  project.pages = JSON.parse(history[historyIndex]);
  renderPages();
  updateHistoryButtons();
  scheduleAutoSave();
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  project.pages = JSON.parse(history[historyIndex]);
  renderPages();
  updateHistoryButtons();
  scheduleAutoSave();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  if (undoBtn) undoBtn.disabled = historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = historyIndex >= history.length - 1;
}

let autoSaveTimer = null;

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveProjectNow, 1500);
}

async function saveProjectNow() {
  if (!project) return;
  try {
    await saveProject(project);
    const btn = document.getElementById("save-btn");
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = "Saved";
    setTimeout(() => { btn.innerHTML = original; }, 1200);
  } catch (err) {
    console.error("Save failed:", err);
  }
}

async function exportProject() {
  await saveProjectNow();
  if (!window.jspdf) {
    await new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }
  exportAsPDF(window.jspdf.jsPDF);
}

async function exportAsPDF(jsPDF) {
  const doc = new jsPDF({
    orientation: project.width > project.height ? "landscape" : "portrait",
    unit: "pt",
    format: [project.width, project.height],
  });

  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];
    if (i > 0) doc.addPage([project.width, project.height]);

    doc.setFillColor(page.background || "#ffffff");
    doc.rect(0, 0, project.width, project.height, "F");

    for (const el of page.elements) {
      if (el.type === "text") {
        doc.setFontSize(el.size);
        const rgb = hexToRgb(el.color);
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.text(el.text, el.x, el.y + el.size);
      } else if (el.type === "image" && el.src) {
        try {
          const format = el.src.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(el.src, format, el.x, el.y, el.width, el.height);
        } catch (e) { console.error(e); }
      } else if (el.type === "highlight" || el.type === "shape") {
        const rgb = hexToRgb(el.fill || el.color);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        if (el.shapeType === "circle") {
          doc.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, "F");
        } else {
          doc.rect(el.x, el.y, el.width, el.height, "F");
        }
      }
    }
  }

  doc.save((project.name || "project") + ".pdf");
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}
