/* =========================================
   PDFKit Studio — Create Page
   ========================================= */

const PRESETS = {
  a4: { width: 595, height: 842, unit: "pt" },
  a5: { width: 420, height: 595, unit: "pt" },
  a3: { width: 842, height: 1191, unit: "pt" },
  letter: { width: 612, height: 792, unit: "pt" },
  legal: { width: 612, height: 1008, unit: "pt" },
  square: { width: 800, height: 800, unit: "pt" },
};

let selectedPreset = "a4";
let selectedOrientation = "portrait";
let selectedBg = "#ffffff";

document.addEventListener("DOMContentLoaded", init);

function init() {
  // Presets
  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPreset = btn.dataset.preset;
    });
  });

  // Orientation
  document.querySelectorAll(".toggle[data-orientation]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".toggle[data-orientation]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedOrientation = btn.dataset.orientation;
    });
  });

  // Backgrounds
  document.querySelectorAll(".bg-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bg-swatch").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedBg = btn.dataset.bg;
    });
  });

  // Create button
  document.getElementById("create-project-btn").addEventListener("click", createProject);
}

async function createProject() {
  const nameInput = document.getElementById("project-name");
  const name = nameInput.value.trim() || "Untitled project";

  const preset = PRESETS[selectedPreset];
  let width = preset.width;
  let height = preset.height;

  // Apply orientation (swap dimensions if landscape)
  if (selectedOrientation === "landscape" && height > width) {
    [width, height] = [height, width];
  }

  const project = {
    name: name,
    width: width,
    height: height,
    unit: preset.unit,
    background: selectedBg,
    pages: [
      {
        id: "page_1",
        background: selectedBg,
        elements: [],
      },
    ],
    thumbnail: null,
  };

  const saved = await saveProject(project);
  window.location.href = "studio.html?id=" + saved.id;
}
