/* PDFKit Studio — محرر PDF */
(function () {
  "use strict";

  const state = {
    project: null,
    activeTool: null,
    selected: null,
    pageIndex: 0,
    scale: 1,
    history: [],
    historyIndex: -1,
    saveTimer: null,
    drawSettings: { color: "#e53935", size: 4 },
    textSettings: { font: "Cairo", size: 24, color: "#1a1a1a" },
    highlightColor: "#fef08a",
    shapeSettings: { type: "rect", color: "#e53935", fill: "transparent" },
    language: localStorage.getItem("pdfkit-language") || "ar"
  };

  const I18N = {
    ar: { back:"رجوع", undo:"تراجع", redo:"إعادة", export:"تصدير", save:"حفظ", text:"نص", highlight:"تمييز", draw:"رسم", image:"صورة", shape:"شكل", eraser:"ممحاة", saved:"تم حفظ المشروع", exported:"تم تصدير PDF", empty:"لا يوجد عنصر محدد", addText:"إضافة النص", addHighlight:"إضافة تمييز", content:"المحتوى", font:"الخط", size:"الحجم", color:"اللون", brush:"حجم الفرشاة", shapeType:"نوع الشكل", rectangle:"مستطيل", circle:"دائرة", addShape:"إضافة الشكل", drawHint:"ارسم مباشرة على الصفحة", eraseHint:"اختر عنصرًا ثم احذفه", chooseImage:"اختر صورة", close:"إغلاق", textPlaceholder:"اكتب النص هنا…" },
    en: { back:"Back", undo:"Undo", redo:"Redo", export:"Export", save:"Save", text:"Text", highlight:"Highlight", draw:"Draw", image:"Image", shape:"Shape", eraser:"Eraser", saved:"Project saved", exported:"PDF exported", empty:"No element selected", addText:"Add text", addHighlight:"Add highlight", content:"Content", font:"Font", size:"Size", color:"Color", brush:"Brush size", shapeType:"Shape type", rectangle:"Rectangle", circle:"Circle", addShape:"Add shape", drawHint:"Draw directly on the page", eraseHint:"Select an element, then delete it", chooseImage:"Choose an image", close:"Close", textPlaceholder:"Type your text…" }
  };

  const t = (key) => (I18N[state.language] && I18N[state.language][key]) || key;
  const $ = (selector, root = document) => { try { return root.querySelector(selector); } catch (e) { return null; } };
  const $$ = (selector, root = document) => { try { return Array.from(root.querySelectorAll(selector)); } catch (e) { return []; } };
  const uid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; } };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    try {
      applyLanguage();
      const id = new URLSearchParams(location.search).get("id");
      if (!id) { location.href = "index.html"; return; }
      state.project = await getProjectSafe(id);
      if (!state.project) { showToast(state.language === "ar" ? "تعذر العثور على المشروع" : "Project not found"); return; }
      normalizeProject();
      bindHeader();
      bindToolbar();
      bindPanel();
      renderPages();
      pushHistory(false);
      updateHistoryButtons();
      window.addEventListener("resize", debounce(renderPages, 100));
    } catch (error) { console.error("Studio initialization failed", error); showToast(error.message); }
  }

  async function getProjectSafe(id) {
    try {
      if (typeof getProject === "function") return await getProject(id);
      return null;
    } catch (error) { console.error("Could not read project", error); return null; }
  }

  async function persistProject() {
    try {
      if (!state.project || typeof saveProject !== "function") return false;
      state.project.name = $("#project-title")?.value.trim() || state.project.name || "Untitled";
      state.project = await saveProject(clone(state.project));
      return true;
    } catch (error) { console.error("Could not save project", error); showToast(error.message); return false; }
  }

  function normalizeProject() {
    state.project.width = Number(state.project.width) || 595;
    state.project.height = Number(state.project.height) || 842;
    state.project.pages = Array.isArray(state.project.pages) && state.project.pages.length ? state.project.pages : [{ id:uid("page"), background:state.project.background || "#fff", elements:[] }];
    state.project.pages.forEach((page) => {
      page.elements = Array.isArray(page.elements) ? page.elements : [];
      page.background = page.background || state.project.background || "#fff";
    });
    const title = $("#project-title");
    if (title) title.value = state.project.name || (state.language === "ar" ? "مشروع بدون عنوان" : "Untitled project");
        }
  function bindHeader() {
  $("#project-title")?.addEventListener("input", debounce(() => scheduleAutoSave(), 400));
  $("#save-btn")?.addEventListener("click", () => saveProjectNow(true));
  $("#undo-btn")?.addEventListener("click", undo);
  $("#redo-btn")?.addEventListener("click", redo);
  $("#export-btn")?.addEventListener("click", exportProject);
}

function bindToolbar() {
  $$(".tool-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.tool;
      if (state.activeTool === tool) {
        state.activeTool = null;
        button.classList.remove("active");
        closePanel();
        renderPages();
        return;
      }
      $$(".tool-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state.activeTool = tool;
      openPanel(tool);
      renderPages();
    });
  });
}

function bindPanel() {
  $("#panel-close")?.addEventListener("click", () => { closePanel(); state.activeTool = null; $$(".tool-btn").forEach((item) => item.classList.remove("active")); renderPages(); });
  $("#image-upload")?.addEventListener("change", handleImageUpload);
}

function renderPages() {
  try {
    const stage = $("#canvas-stage");
    if (!stage || !state.project) return;
    const wrapper = $("#canvas-wrapper");
    const availableWidth = (wrapper?.clientWidth || window.innerWidth) - 32;
    const availableHeight = window.innerHeight - 220;
    state.scale = Math.min(availableWidth / state.project.width, availableHeight / state.project.height, 1.4);
    stage.innerHTML = "";
    state.project.pages.forEach((page, index) => {
      const pageNode = document.createElement("div");
      pageNode.className = "page-canvas";
      pageNode.dataset.pageIndex = index;
      pageNode.style.width = `${state.project.width * state.scale}px`;
      pageNode.style.height = `${state.project.height * state.scale}px`;
      pageNode.style.background = page.background || "#ffffff";
      (page.elements || []).forEach((element) => {
        const node = createElementNode(element, index);
        if (node) pageNode.appendChild(node);
      });
      const canvas = document.createElement("canvas");
      canvas.className = "draw-canvas";
      canvas.width = state.project.width * state.scale;
      canvas.height = state.project.height * state.scale;
      canvas.style.width = `${state.project.width * state.scale}px`;
      canvas.style.height = `${state.project.height * state.scale}px`;
      pageNode.appendChild(canvas);
      renderDrawings(canvas, page);
      setupDrawing(canvas, index);
      pageNode.addEventListener("pointerdown", (event) => { if (event.target === pageNode) deselect(); });
      stage.appendChild(pageNode);
    });
  } catch (error) { console.error("renderPages failed", error); }
}

function createElementNode(element, pageIndex) {
  try {
    const node = document.createElement("div");
    node.className = `canvas-element element-${element.type}`;
    node.dataset.elementId = element.id;
    positionNode(node, element);
    if (element.type === "text") {
      node.textContent = element.text || "";
      node.style.fontFamily = element.font || "Cairo";
      node.style.fontSize = `${(element.size || 24) * state.scale}px`;
      node.style.color = element.color || "#1a1a1a";
      node.style.direction = "auto";
      node.style.unicodeBidi = "plaintext";
      node.style.textAlign = element.align || "right";
    } else if (element.type === "image" && element.src) {
      const img = document.createElement("img");
      img.src = element.src;
      img.alt = element.alt || "";
      img.draggable = false;
      node.appendChild(img);
    } else if (element.type === "highlight") {
      node.style.background = element.color || "#fef08a";
      node.style.opacity = "0.65";
    } else if (element.type === "shape") {
      node.style.border = `2px solid ${element.color || "#e53935"}`;
      node.style.background = element.fill && element.fill !== "transparent" ? element.fill : "transparent";
      if (element.shapeType === "circle") node.style.borderRadius = "50%";
    } else { return null; }
    const handle = document.createElement("span");
    handle.className = "resize-handle";
    node.appendChild(handle);
    bindElementPointer(node, element, pageIndex);
    bindResize(handle, node, element);
    return node;
  } catch (error) { console.error("createElementNode failed", error); return null; }
}

function positionNode(node, element) {
  node.style.left = `${(element.x || 0) * state.scale}px`;
  node.style.top = `${(element.y || 0) * state.scale}px`;
  node.style.width = `${(element.width || (element.type === "text" ? 220 : 120)) * state.scale}px`;
  node.style.height = `${(element.height || (element.type === "text" ? 44 : 80)) * state.scale}px`;
}

function bindElementPointer(node, element, pageIndex) {
  let start = null;
  node.addEventListener("pointerdown", (event) => {
    if (event.target.classList.contains("resize-handle")) return;
    event.preventDefault(); event.stopPropagation();
    select(node, element, pageIndex);
    node.setPointerCapture?.(event.pointerId);
    start = { x:event.clientX, y:event.clientY, left:Number(element.x)||0, top:Number(element.y)||0 };
  });
  node.addEventListener("pointermove", (event) => {
    if (!start) return;
    element.x = clamp(start.left + (event.clientX - start.x) / state.scale, 0, state.project.width - 20);
    element.y = clamp(start.top + (event.clientY - start.y) / state.scale, 0, state.project.height - 20);
    positionNode(node, element);
  });
  node.addEventListener("pointerup", () => { if (start) { start = null; pushHistory(); scheduleAutoSave(); } });
  node.addEventListener("pointercancel", () => { start = null; });
}

function bindResize(handle, node, element) {
  let start = null;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault(); event.stopPropagation();
    select(node, element);
    start = { x:event.clientX, y:event.clientY, width:Number(element.width)||120, height:Number(element.height)||50 };
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (!start) return;
    element.width = clamp(start.width + (event.clientX - start.x) / state.scale, 30, state.project.width);
    element.height = clamp(start.height + (event.clientY - start.y) / state.scale, 20, state.project.height);
    positionNode(node, element);
  });
  handle.addEventListener("pointerup", () => { if (start) { start = null; pushHistory(); scheduleAutoSave(); } });
}

function select(node, element, pageIndex = state.pageIndex) {
  deselect();
  node.classList.add("selected");
  state.selected = { node, element, pageIndex };
  state.pageIndex = pageIndex;
  if (typeof window.openElementPanel === "function") {
    try { window.openElementPanel(element); } catch (e) { console.error("openElementPanel failed", e); }
  }
}

function deselect() {
  state.selected?.node?.classList.remove("selected");
  state.selected = null;
  if (typeof window.closeElementPanel === "function") {
    try { window.closeElementPanel(); } catch (e) { console.error("closeElementPanel failed", e); }
  }
        }
    function setupDrawing(canvas, pageIndex) {
    canvas.classList.toggle("is-active", state.activeTool === "draw");
    if (state.activeTool !== "draw") return;
    let drawing = false, points = [];
    canvas.addEventListener("pointerdown", (event) => { drawing = true; points = [canvasPoint(event, canvas)]; canvas.setPointerCapture?.(event.pointerId); });
    canvas.addEventListener("pointermove", (event) => { if (!drawing) return; points.push(canvasPoint(event, canvas)); paintPreview(canvas, points, pageIndex); });
    canvas.addEventListener("pointerup", () => {
      if (!drawing) return;
      drawing = false;
      const page = state.project.pages[pageIndex];
      page.drawings = Array.isArray(page.drawings) ? page.drawings : [];
      page.drawings.push({ color:state.drawSettings.color, size:state.drawSettings.size, points:clone(points) });
      renderPages();
      pushHistory();
      scheduleAutoSave();
    });
  }

  function canvasPoint(event, canvas) { const rect = canvas.getBoundingClientRect(); return { x:(event.clientX - rect.left) / state.scale, y:(event.clientY - rect.top) / state.scale }; }

  function renderDrawings(canvas, page) {
    try {
      const ctx = canvas.getContext("2d");
      (page.drawings || []).forEach((stroke) => {
        const points = stroke.points || [];
        if (points.length < 1) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color || "#e53935";
        ctx.lineWidth = (stroke.size || 4) * state.scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(points[0].x * state.scale, points[0].y * state.scale);
        points.slice(1).forEach((point) => ctx.lineTo(point.x * state.scale, point.y * state.scale));
        ctx.stroke();
      });
    } catch (error) { console.error("Drawing render failed", error); }
  }

  function paintPreview(canvas, points, pageIndex) {
    try {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0,0,canvas.width,canvas.height);
      renderDrawings(canvas, state.project.pages[pageIndex]);
      const last = points[points.length - 1];
      const previous = points[points.length - 2] || last;
      ctx.beginPath();
      ctx.strokeStyle = state.drawSettings.color;
      ctx.lineWidth = state.drawSettings.size * state.scale;
      ctx.lineCap = "round";
      ctx.moveTo(previous.x * state.scale, previous.y * state.scale);
      ctx.lineTo(last.x * state.scale, last.y * state.scale);
      ctx.stroke();
    } catch (error) { console.error("Drawing preview failed", error); }
  }

  function openPanel(tool) {
    try {
      const panel = $("#tool-panel"), content = $("#panel-content");
      if (!panel || !content) return;
      content.innerHTML = panelMarkup(tool);
      panel.hidden = false;
      bindPanelControls(tool);
    } catch (error) { console.error("Panel error", error); }
  }

  function closePanel() { const panel = $("#tool-panel"); if (panel) panel.hidden = true; }

  function panelMarkup(tool) {
    const colors = ["#1a1a1a","#e53935","#2563eb","#16a34a","#f59e0b","#fef08a"];
    const swatches = (id, current) => `<div class="color-options" id="${id}">${colors.map((color) => `<button type="button" class="color-swatch ${color === current ? "active" : ""}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join("")}</div>`;

    if (tool === "text") return `<h3 class="panel-title">${t("text")}</h3><div class="panel-row"><label class="panel-label">${t("content")}</label><textarea id="text-content" class="panel-textarea" dir="auto" placeholder="${t("textPlaceholder")}"></textarea></div><div class="panel-row"><label class="panel-label">${t("font")}</label><div class="font-grid">${["Inter","Cairo","Amiri","Tajawal"].map((font) => `<button type="button" class="font-option ${state.textSettings.font === font ? "active" : ""}" data-font="${font}" style="font-family:${font}">${font}</button>`).join("")}</div></div><div class="panel-row"><label class="panel-label">${t("size")} <output id="size-value">${state.textSettings.size}</output></label><input id="text-size" class="size-slider" type="range" min="10" max="120" value="${state.textSettings.size}"></div><div class="panel-row"><label class="panel-label">${t("color")}</label>${swatches("text-colors", state.textSettings.color)}</div><button id="add-text-btn" class="panel-btn" type="button">${t("addText")}</button>`;

    if (tool === "highlight") return `<h3 class="panel-title">${t("highlight")}</h3><div class="panel-row"><label class="panel-label">${t("color")}</label>${swatches("highlight-colors", state.highlightColor)}</div><button id="add-highlight-btn" class="panel-btn" type="button">${t("addHighlight")}</button>`;

    if (tool === "draw") return `<h3 class="panel-title">${t("draw")}</h3><div class="panel-row"><label class="panel-label">${t("color")}</label>${swatches("draw-colors", state.drawSettings.color)}</div><div class="panel-row"><label class="panel-label">${t("brush")}</label><div class="brush-options">${[2,4,8,14].map((size) => `<button type="button" class="brush-size ${size === state.drawSettings.size ? "active" : ""}" data-size="${size}">${size}px</button>`).join("")}</div></div><p class="panel-note">${t("drawHint")}</p>`;

    if (tool === "shape") return `<h3 class="panel-title">${t("shape")}</h3><div class="panel-row"><label class="panel-label">${t("shapeType")}</label><div class="shape-options"><button type="button" class="shape-option ${state.shapeSettings.type === "rect" ? "active" : ""}" data-shape="rect">${t("rectangle")}</button><button type="button" class="shape-option ${state.shapeSettings.type === "circle" ? "active" : ""}" data-shape="circle">${t("circle")}</button></div></div><div class="panel-row"><label class="panel-label">${t("color")}</label>${swatches("shape-colors", state.shapeSettings.color)}</div><button id="add-shape-btn" class="panel-btn" type="button">${t("addShape")}</button>`;

    if (tool === "image") return `<h3 class="panel-title">${t("image")}</h3><p class="panel-note">${state.language === "ar" ? "أضف صورة من جهازك" : "Add an image from your device"}</p><button id="open-image-btn" class="panel-btn" type="button">${t("chooseImage")}</button>`;

    if (tool === "eraser") return `<h3 class="panel-title">${t("eraser")}</h3><p class="panel-note">${t("eraseHint")}</p><button id="delete-selected-btn" class="panel-btn" type="button">${state.language === "ar" ? "حذف العنصر المحدد" : "Delete selected element"}</button>`;

    return "";
  }

  function bindPanelControls(tool) {
    $$(".color-swatch").forEach((button) => button.addEventListener("click", () => {
      $$(".color-swatch").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const color = button.dataset.color;
      if (tool === "text") state.textSettings.color = color;
      if (tool === "draw") state.drawSettings.color = color;
      if (tool === "highlight") state.highlightColor = color;
      if (tool === "shape") state.shapeSettings.color = color;
    }));
    $$(".font-option").forEach((button) => button.addEventListener("click", () => { state.textSettings.font = button.dataset.font; $$(".font-option").forEach((item) => item.classList.toggle("active", item === button)); }));
    $("#text-size")?.addEventListener("input", (event) => { state.textSettings.size = Number(event.target.value); const out = $("#size-value"); if (out) out.textContent = state.textSettings.size; });
    $$(".brush-size").forEach((button) => button.addEventListener("click", () => { state.drawSettings.size = Number(button.dataset.size); $$(".brush-size").forEach((item) => item.classList.toggle("active", item === button)); renderPages(); }));
    $$(".shape-option").forEach((button) => button.addEventListener("click", () => { state.shapeSettings.type = button.dataset.shape; $$(".shape-option").forEach((item) => item.classList.toggle("active", item === button)); }));
    $("#add-text-btn")?.addEventListener("click", addText);
    $("#add-highlight-btn")?.addEventListener("click", addHighlight);
    $("#add-shape-btn")?.addEventListener("click", addShape);
    $("#delete-selected-btn")?.addEventListener("click", deleteSelected);
    $("#open-image-btn")?.addEventListener("click", () => $("#image-upload")?.click());
  }

  function activePage() { return state.project.pages[state.pageIndex] || state.project.pages[0]; }

  function addElement(element) {
    const page = activePage();
    page.elements.push(element);
    pushHistory();
    scheduleAutoSave();
    renderPages();
    closePanel();
  }

  function addText() {
    const text = $("#text-content")?.value.trim();
    if (!text) return;
    addElement({ id:uid("text"), type:"text", text, x:40, y:40, width:240, height:Math.max(44, state.textSettings.size * 1.6), font:state.textSettings.font, size:state.textSettings.size, color:state.textSettings.color, align:"right" });
  }

  function addHighlight() { addElement({ id:uid("highlight"), type:"highlight", x:40, y:40, width:180, height:32, color:state.highlightColor }); }

  function addShape() { addElement({ id:uid("shape"), type:"shape", shapeType:state.shapeSettings.type, x:50, y:50, width:150, height:100, color:state.shapeSettings.color, fill:"transparent" }); }

  function deleteSelected() {
    try {
      if (!state.selected) { showToast(t("empty")); return; }
      const page = state.project.pages[state.selected.pageIndex];
      page.elements = page.elements.filter((item) => item.id !== state.selected.element.id);
      deselect();
      pushHistory();
      scheduleAutoSave();
      renderPages();
      closePanel();
    } catch (error) { console.error("Delete failed", error); }
  }

  function handleImageUpload(event) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const ratio = image.width / image.height || 1;
          addElement({ id:uid("image"), type:"image", src:reader.result, x:40, y:40, width:Math.min(260,image.width), height:Math.min(220,image.width / ratio), alt:file.name });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    } catch (error) { console.error("Image upload failed", error); }
  }

  function pushHistory(render = false) {
    try {
      const snapshot = clone(state.project);
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(snapshot);
      if (state.history.length > 50) state.history.shift();
      state.historyIndex = state.history.length - 1;
      updateHistoryButtons();
      if (render) renderPages();
    } catch (error) { console.error("History error", error); }
  }

  function restoreHistory(index) {
    try {
      const snapshot = state.history[index];
      if (!snapshot) return;
      state.project = clone(snapshot);
      state.historyIndex = index;
      deselect();
      renderPages();
      updateHistoryButtons();
      scheduleAutoSave();
    } catch (error) { console.error("Restore history failed", error); }
  }

  function undo() { if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1); }
  function redo() { if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1); }
  function updateHistoryButtons() { const undoBtn = $("#undo-btn"), redoBtn = $("#redo-btn"); if (undoBtn) undoBtn.disabled = state.historyIndex <= 0; if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1; }

  function scheduleAutoSave() { clearTimeout(state.saveTimer); state.saveTimer = setTimeout(() => saveProjectNow(false), 650); }

  async function saveProjectNow(showMessage) {
    try {
      const ok = await persistProject();
      if (ok && showMessage) showToast(t("saved"));
    } catch (error) { console.error("Auto-save failed", error); }
  }

  async function exportProject() {
    try {
      await persistProject();
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ unit:"pt", format:[state.project.width, state.project.height] });
      for (let index = 0; index < state.project.pages.length; index += 1) {
        if (index) doc.addPage([state.project.width, state.project.height]);
        await drawPageToPDF(doc, state.project.pages[index]);
      }
      doc.save(`${(state.project.name || "pdfkit-project").replace(/[\\/:*?"<>|]+/g, "-")}.pdf`);
      showToast(t("exported"));
    } catch (error) { console.error("PDF export failed", error); showToast(error.message || "Export failed"); }
  }

  function loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) { resolve(window.jspdf.jsPDF); return; }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF unavailable"));
      script.onerror = () => reject(new Error("Could not load jsPDF"));
      document.head.appendChild(script);
    });
  }

  async function drawPageToPDF(doc, page) {
    try {
      doc.setFillColor(page.background || "#ffffff");
      doc.rect(0,0,state.project.width,state.project.height,"F");
      for (const element of page.elements || []) {
        if (element.type === "text") {
          doc.setFont(element.font === "Amiri" ? "times" : "helvetica", "normal");
          doc.setFontSize(element.size || 24);
          doc.setTextColor(element.color || "#1a1a1a");
          const lines = doc.splitTextToSize(element.text || "", element.width || 240);
          doc.text(lines, element.x || 0, (element.y || 0) + (element.size || 24));
        } else if (element.type === "image" && element.src) {
          doc.addImage(element.src, "JPEG", element.x || 0, element.y || 0, element.width || 120, element.height || 80);
        } else if (element.type === "highlight") {
          doc.setFillColor(element.color || "#fef08a");
          doc.rect(element.x || 0, element.y || 0, element.width || 180, element.height || 32, "F");
        } else if (element.type === "shape") {
          doc.setDrawColor(element.color || "#e53935");
          if (element.shapeType === "circle") doc.ellipse((element.x||0)+(element.width||100)/2,(element.y||0)+(element.height||80)/2,(element.width||100)/2,(element.height||80)/2);
          else doc.rect(element.x||0,element.y||0,element.width||100,element.height||80);
        }
      }
      for (const stroke of page.drawings || []) {
        const points = stroke.points || [];
        if (points.length < 2) continue;
        doc.setDrawColor(stroke.color || "#e53935");
        doc.setLineWidth(stroke.size || 4);
        for (let i = 1; i < points.length; i++) {
          doc.line(points[i-1].x, points[i-1].y, points[i].x, points[i].y);
        }
      }
    } catch (error) { console.error("Page export failed", error); }
  }

  function toggleLanguage() {
    state.language = state.language === "ar" ? "en" : "ar";
    localStorage.setItem("pdfkit-language", state.language);
    applyLanguage();
    renderPages();
    if (state.activeTool) openPanel(state.activeTool);
  }

  function applyLanguage() {
    document.documentElement.lang = state.language;
    document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
    $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAria)); });
    const button = $("#language-btn");
    if (button) {
      button.textContent = state.language === "ar" ? "EN" : "ع";
      button.setAttribute("aria-label", state.language === "ar" ? "English" : "العربية");
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function debounce(fn, wait) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }

  // ---------- Public API for element-panel ----------
  window.getActiveProject = () => state.project;
  window.getCurrentPageIndex = () => state.pageIndex;
  window.triggerRender = () => renderPages();
  window.triggerAutoSave = () => scheduleAutoSave();
  window.triggerPushHistory = () => pushHistory();
  window.deselectElement = () => deselect();
})();
