/* =========================================
   PDFKit Studio — Editor
   ========================================= */

let project = null;
let currentPageIndex = 0;
let activeTool = null;
let selectedElement = null;

/* Undo / Redo */
let history = [];
let historyIndex = -1;

/* Tool settings */
const toolSettings = {
  text: {
    text: "Type here",
    font: "Inter",
    size: 24,
    color: "#1a1a1a",
    bold: false,
    italic: false,
  },
  highlight: {
    color: "#fef08a",
    size: 20,
  },
  draw: {
    color: "#e53935",
    size: 4,
  },
  shape: {
    color: "#1a1a1a",
    fill: "transparent",
    type: "rect",
  },
  eraser: {},
};

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");

  if (!projectId) {
    window.location.href = "index.html";
    return;
  }

  project = await getProject(projectId);

  if (!project) {
    alert("Project not found");
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

  document.getElementById("project-title").value = project.name || "Untitled";

  renderPages();
  setupToolbar();
  setupHeader();

  pushHistory();
});

/* ---------- Header setup ---------- */
function setupHeader() {
  document.getElementById("save-btn").addEventListener("click", saveProjectNow);
  document.getElementById("undo-btn").addEventListener("click", undo);
  document.getElementById("redo-btn").addEventListener("click", redo);
  document.getElementById("export-btn").addEventListener("click", exportProject);

  document.getElementById("project-title").addEventListener("input", (e) => {
    project.name = e.target.value.trim() || "Untitled";
    scheduleAutoSave();
  });

  document.getElementById("panel-close").addEventListener("click", closePanel);
}

/* ---------- Toolbar setup ---------- */
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

  document.getElementById("canvas-stage").addEventListener("click", (e) => {
    if (e.target.id === "canvas-stage" || e.target.classList.contains("page-canvas")) {
      deselectElement();
    }
  });
}

/* ---------- Pages rendering ---------- */
function renderPages() {
  const stage = document.getElementById("canvas-stage");
  stage.innerHTML = "";

  project.pages.forEach((page, idx) => {
    const pageEl = document.createElement("div");
    pageEl.className = "page-canvas";
    pageEl.dataset.pageIndex = idx;

    const scale = calculateScale();
    pageEl.style.width = project.width * scale + "px";
    pageEl.style.height = project.height * scale + "px";
    pageEl.style.background = page.background || "#ffffff";

    page.pagescale = scale;

    page.elements.forEach((el) => {
      pageEl.appendChild(createElementNode(el, scale, idx));
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
  const availableWidth = wrapper.clientWidth - 48;
  const availableHeight = window.innerHeight - 200;
  const maxW = availableWidth / project.width;
  const maxH = availableHeight / project.height;
  return Math.min(maxW, maxH, 1.5);
}

/* ---------- Element nodes ---------- */
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
    div.style.fontWeight = el.bold ? "700" : "400";
    div.style.fontStyle = el.italic ? "italic" : "normal";
    div.style.width = el.width ? el.width * scale + "px" : "auto";
    div.textContent = el.text || "";

    div.innerHTML += '<span class="resize-handle"></span>';

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
    div.innerHTML = `<img src="${el.src}" alt="" /><span class="resize-handle"></span>`;

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

/* ---------- Dragging ---------- */
function makeDraggable(node, el, scale, pageIdx) {
  let startX, startY, startLeft, startTop;
  let dragging = false;

  const onStart = (e) => {
    if (e.target.classList.contains("resize-handle")) return;
    e.preventDefault();
    selectElement(node, el, pageIdx);
    dragging = true;
    const point = getPoint(e);
    startX = point.x;
    startY = point.y;
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
    const point = getPoint(e);
    const dx = (point.x - startX) / scale;
    const dy = (point.y - startY) / scale;
    el.x = startLeft + dx;
    el.y = startTop + dy;
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

/* ---------- Resizing ---------- */
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
    const point = getPoint(e);
    startX = point.x;
    startY = point.y;
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
    const point = getPoint(e);
    const dw = (point.x - startX) / scale;
    const dh = (point.y - startY) / scale;
    el.width = Math.max(30, startW + dw);
    el.height = Math.max(20, startH + dh);
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

/* ---------- Selection ---------- */
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

/* ---------- Tool panel ---------- */
function openToolPanel(tool) {
  const panel = document.getElementById("tool-panel");
  const content = document.getElementById("panel-content");

  if (tool === "text") content.innerHTML = renderTextPanel();
  else if (tool === "highlight") content.innerHTML = renderHighlightPanel();
  else if (tool === "draw") content.innerHTML = renderDrawPanel();
  else if (tool === "shape") content.innerHTML = renderShapePanel();
  else if (tool === "eraser") content.innerHTML = renderEraserPanel();

  panel.hidden = false;
  bindPanelEvents(tool);
}

function closePanel() {
  document.getElementById("tool-panel").hidden = true;
}

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

/* ---------- Panel events ---------- */
function bindPanelEvents(tool) {
  if (tool === "text") {
    const content = document.getElementById("text-content");
    const sizeSlider = document.getElementById("text-size");
    const sizeValue = document.getElementById("size-value");

    content.addEventListener("input", () => {
      toolSettings.text.text = content.value;
    });

    sizeSlider.addEventListener("input", () => {
      sizeValue.textContent = sizeSlider.value;
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

    document.getElementById("add-text-btn").addEventListener("click", () => {
      const text = content.value.trim() || toolSettings.text.text;
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

    document.getElementById("add-highlight-btn").addEventListener("click", addHighlightElement);
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

    document.getElementById("add-shape-btn").addEventListener("click", addShapeElement);
  }
}

/* ---------- Add elements ---------- */
function addTextElement(text) {
  const page = project.pages[currentPageIndex];
  const el = {
    id: "el_" + Date.now(),
    type: "text",
    text: text,
    x: 50,
    y: 50,
    width: null,
    height: null,
    font: toolSettings.text.font,
    size: toolSettings.text.size,
    color: toolSettings.text.color,
    bold: toolSettings.text.bold,
    italic: toolSettings.text.italic,
  };
  page.elements.push(el);
  renderPages();
  pushHistory();
  scheduleAutoSave();
  closePanel();
  activeTool = null;
  document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
}

function addHighlightElement() {
  const page = p
