/* =========================================
   PDFKit Studio — Element Panel
   لوحة تعديل العنصر المحدد
   ========================================= */

(function () {
  "use strict";

  window.ElementPanel = {
    current: null,
    isOpen: false,
  };

  function renderPanel(element) {
    const panel = document.getElementById("element-panel");
    const content = document.getElementById("element-panel-content");
    if (!panel || !content) return;

    const header = `
      <div class="ep-header">
        <span class="ep-title">${getElementLabel(element.type)}</span>
        <button class="ep-close" id="ep-close-btn" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    let body = "";
    if (element.type === "text") body = renderTextControls(element);
    else if (element.type === "image") body = renderImageControls(element);
    else if (element.type === "shape" || element.type === "highlight") body = renderShapeControls(element);

    const actions = renderActions(element);

    content.innerHTML = header + body + actions;
    panel.hidden = false;
    window.ElementPanel.isOpen = true;

    bindEvents(element);
  }

  function getElementLabel(type) {
    const labels = { text: "Text", image: "Image", shape: "Shape", highlight: "Highlight", draw: "Drawing" };
    return labels[type] || "Element";
  }

  function renderTextControls(el) {
    return `
      <div class="ep-section">
        <label class="ep-label">Content</label>
        <textarea class="ep-textarea" id="ep-text-content" dir="auto" placeholder="Type text...">${escapeHtml(el.text || "")}</textarea>
      </div>

      <div class="ep-section">
        <label class="ep-label">Font</label>
        <div class="ep-font-grid" id="ep-font-grid">
          ${["Inter", "Cairo", "Amiri", "Tajawal", "Georgia", "Courier New"]
            .map((f) => `<button class="ep-font ${el.font === f ? "active" : ""}" data-font="${f}" style="font-family:'${f}',sans-serif;">${f}</button>`).join("")}
        </div>
      </div>

      <div class="ep-section">
        <label class="ep-label">Size: <span id="ep-size-value">${el.size || 24}</span>px</label>
        <input type="range" class="ep-slider" id="ep-text-size" min="10" max="200" value="${el.size || 24}" />
      </div>

      <div class="ep-section">
        <label class="ep-label">Color</label>
        <div class="ep-colors" id="ep-text-colors">
          ${["#1a1a1a", "#e53935", "#2563eb", "#16a34a", "#f59e0b", "#ffffff", "#9333ea", "#0891b2"]
            .map((c) => `<button class="ep-color ${el.color === c ? "active" : ""}" data-color="${c}" style="background:${c};${c === "#ffffff" ? "border:2px solid #e5e5e5;" : ""}"></button>`).join("")}
        </div>
      </div>

      <div class="ep-section">
        <label class="ep-label">Style</label>
        <div class="ep-toggle-group" id="ep-text-style">
          <button class="ep-toggle ${el.bold ? "active" : ""}" data-style="bold" style="font-weight:900;">B</button>
          <button class="ep-toggle ${el.italic ? "active" : ""}" data-style="italic" style="font-style:italic;">I</button>
        </div>
      </div>

      <div class="ep-section">
        <label class="ep-label">Alignment</label>
        <div class="ep-toggle-group" id="ep-text-align">
          <button class="ep-toggle ${!el.align || el.align === "left" ? "active" : ""}" data-align="left">⟵</button>
          <button class="ep-toggle ${el.align === "center" ? "active" : ""}" data-align="center">↔</button>
          <button class="ep-toggle ${el.align === "right" ? "active" : ""}" data-align="right">⟶</button>
        </div>
      </div>
    `;
  }

  function renderImageControls(el) {
    return `
      <div class="ep-section">
        <label class="ep-label">Width: <span id="ep-w-value">${Math.round(el.width || 100)}</span>px</label>
        <input type="range" class="ep-slider" id="ep-img-w" min="20" max="800" value="${Math.round(el.width || 100)}" />
      </div>
      <div class="ep-section">
        <label class="ep-label">Height: <span id="ep-h-value">${Math.round(el.height || 100)}</span>px</label>
        <input type="range" class="ep-slider" id="ep-img-h" min="20" max="800" value="${Math.round(el.height || 100)}" />
      </div>
    `;
  }

  function renderShapeControls(el) {
    return `
      <div class="ep-section">
        <label class="ep-label">Fill color</label>
        <div class="ep-colors" id="ep-shape-colors">
          ${["#1a1a1a", "#e53935", "#2563eb", "#16a34a", "#f59e0b", "#fef08a", "#bbf7d0", "#bfdbfe", "#f5f5f5"]
            .map((c) => `<button class="ep-color ${(el.fill || el.color) === c ? "active" : ""}" data-color="${c}" style="background:${c};${c === "#f5f5f5" ? "border:2px solid #e5e5e5;" : ""}"></button>`).join("")}
        </div>
      </div>
      <div class="ep-section">
        <label class="ep-label">Width: <span id="ep-w-value">${Math.round(el.width || 100)}</span>px</label>
        <input type="range" class="ep-slider" id="ep-shape-w" min="20" max="800" value="${Math.round(el.width || 100)}" />
      </div>
      <div class="ep-section">
        <label class="ep-label">Height: <span id="ep-h-value">${Math.round(el.height || 100)}</span>px</label>
        <input type="range" class="ep-slider" id="ep-shape-h" min="20" max="800" value="${Math.round(el.height || 100)}" />
      </div>
    `;
  }

  function renderActions(el) {
    return `
      <div class="ep-actions">
        <button class="ep-action" data-action="front" title="Bring to front">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"></polyline><line x1="12" y1="18" x2="12" y2="6"></line></svg>
          <span>Front</span>
        </button>
        <button class="ep-action" data-action="back" title="Send to back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><line x1="12" y1="6" x2="12" y2="18"></line></svg>
          <span>Back</span>
        </button>
        <button class="ep-action" data-action="duplicate" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy</span>
        </button>
        <button class="ep-action ep-danger" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
          <span>Delete</span>
        </button>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  window.ElementPanel.render = renderPanel;
  window.ElementPanel.close = function () {
    const panel = document.getElementById("element-panel");
    if (panel) panel.hidden = true;
    window.ElementPanel.isOpen = false;
    window.ElementPanel.current = null;
  };
  window.ElementPanel.escapeHtml = escapeHtml;
     function bindEvents(el) {
    document.getElementById("ep-close-btn")?.addEventListener("click", () => {
      window.ElementPanel.close();
      if (typeof window.deselectElement === "function") window.deselectElement();
    });

    // ---- Text ----
    if (el.type === "text") {
      const contentEl = document.getElementById("ep-text-content");
      contentEl?.addEventListener("input", () => { el.text = contentEl.value; updateElement(); });

      const sizeSlider = document.getElementById("ep-text-size");
      const sizeValue = document.getElementById("ep-size-value");
      sizeSlider?.addEventListener("input", () => {
        el.size = parseInt(sizeSlider.value);
        if (sizeValue) sizeValue.textContent = el.size;
        updateElement();
      });

      document.querySelectorAll("#ep-font-grid .ep-font").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#ep-font-grid .ep-font").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          el.font = btn.dataset.font;
          updateElement();
        });
      });

      document.querySelectorAll("#ep-text-colors .ep-color").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#ep-text-colors .ep-color").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          el.color = btn.dataset.color;
          updateElement();
        });
      });

      document.querySelectorAll("#ep-text-style .ep-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const style = btn.dataset.style;
          if (style === "bold") el.bold = !el.bold;
          if (style === "italic") el.italic = !el.italic;
          btn.classList.toggle("active");
          updateElement();
        });
      });

      document.querySelectorAll("#ep-text-align .ep-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#ep-text-align .ep-toggle").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          el.align = btn.dataset.align;
          updateElement();
        });
      });
    }

    // ---- Image ----
    if (el.type === "image") {
      const wSlider = document.getElementById("ep-img-w");
      const wValue = document.getElementById("ep-w-value");
      wSlider?.addEventListener("input", () => {
        el.width = parseInt(wSlider.value);
        if (wValue) wValue.textContent = el.width;
        updateElement();
      });

      const hSlider = document.getElementById("ep-img-h");
      const hValue = document.getElementById("ep-h-value");
      hSlider?.addEventListener("input", () => {
        el.height = parseInt(hSlider.value);
        if (hValue) hValue.textContent = el.height;
        updateElement();
      });
    }

    // ---- Shape / Highlight ----
    if (el.type === "shape" || el.type === "highlight") {
      document.querySelectorAll("#ep-shape-colors .ep-color").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("#ep-shape-colors .ep-color").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          el.fill = btn.dataset.color;
          el.color = btn.dataset.color;
          updateElement();
        });
      });

      const wSlider = document.getElementById("ep-shape-w");
      const wValue = document.getElementById("ep-w-value");
      wSlider?.addEventListener("input", () => {
        el.width = parseInt(wSlider.value);
        if (wValue) wValue.textContent = el.width;
        updateElement();
      });

      const hSlider = document.getElementById("ep-shape-h");
      const hValue = document.getElementById("ep-h-value");
      hSlider?.addEventListener("input", () => {
        el.height = parseInt(hSlider.value);
        if (hValue) hValue.textContent = el.height;
        updateElement();
      });
    }

    // ---- Actions ----
    document.querySelectorAll(".ep-action").forEach((btn) => {
      btn.addEventListener("click", () => handleAction(btn.dataset.action, el));
    });
  }

  // ---------- Update element on canvas ----------
  function updateElement() {
    if (typeof window.triggerRender === "function") window.triggerRender();
    if (typeof window.triggerAutoSave === "function") window.triggerAutoSave();
  }

  // ---------- Actions handler ----------
  function handleAction(action, el) {
    const project = window.getActiveProject ? window.getActiveProject() : null;
    if (!project) return;

    const pageIndex = window.getCurrentPageIndex ? window.getCurrentPageIndex() : 0;
    const page = project.pages[pageIndex];
    if (!page) return;

    const idx = page.elements.findIndex((e) => e.id === el.id);
    if (idx === -1) return;

    if (action === "delete") {
      page.elements.splice(idx, 1);
      window.ElementPanel.close();
      if (typeof window.deselectElement === "function") window.deselectElement();
    }

    if (action === "duplicate") {
      const copy = JSON.parse(JSON.stringify(el));
      copy.id = "el_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      copy.x = (copy.x || 0) + 20;
      copy.y = (copy.y || 0) + 20;
      page.elements.push(copy);
      if (typeof window.triggerPushHistory === "function") window.triggerPushHistory();
    }

    if (action === "front") {
      page.elements.splice(idx, 1);
      page.elements.push(el);
      if (typeof window.triggerPushHistory === "function") window.triggerPushHistory();
    }

    if (action === "back") {
      page.elements.splice(idx, 1);
      page.elements.unshift(el);
      if (typeof window.triggerPushHistory === "function") window.triggerPushHistory();
    }

    if (typeof window.triggerRender === "function") window.triggerRender();
    if (typeof window.triggerAutoSave === "function") window.triggerAutoSave();
  }

  // ---------- Public API ----------
  window.openElementPanel = function (element) {
    window.ElementPanel.current = element;
    renderPanel(element);
  };

  window.closeElementPanel = function () {
    window.ElementPanel.close();
  };

  // ---------- Drag down to close ----------
  function setupDrag(panel) {
    let startY = 0, isDown = false;
    const header = panel.querySelector(".ep-header");
    if (!header) return;

    header.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; isDown = true; }, { passive: true });
    header.addEventListener("touchmove", (e) => {
      if (!isDown) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 80) {
        window.ElementPanel.close();
        if (typeof window.deselectElement === "function") window.deselectElement();
        isDown = false;
      }
    }, { passive: true });
    header.addEventListener("touchend", () => { isDown = false; });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const panel = document.getElementById("element-panel");
    if (panel) setupDrag(panel);
  });

})();
