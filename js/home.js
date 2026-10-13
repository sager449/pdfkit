/* =========================================
   PDFKit Studio — Home Page
   ========================================= */

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await renderProjects();
  document.getElementById("create-btn").addEventListener("click", () => {
    window.location.href = "create.html";
  });
}

async function renderProjects() {
  const grid = document.getElementById("projects-grid");
  const emptyState = document.getElementById("empty-state");
  const countEl = document.getElementById("projects-count");

  const projects = await getAllProjects();

  countEl.textContent = projects.length;

  if (projects.length === 0) {
    grid.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  grid.innerHTML = "";

  projects.forEach((project) => {
    const card = document.createElement("div");
    card.className = "project-card";

    const thumb = project.thumbnail
      ? `<img src="${project.thumbnail}" alt="" />`
      : `<span class="placeholder">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
             <polyline points="14 2 14 8 20 8"></polyline>
           </svg>
         </span>`;

    card.innerHTML = `
      <div class="project-thumb">${thumb}</div>
      <div class="project-info">
        <div class="project-name-wrap" style="flex:1;min-width:0;">
          <div class="project-name">${escapeHtml(project.name || "Untitled")}</div>
          <div class="project-date">${formatDate(project.updatedAt)}</div>
        </div>
        <button class="project-delete" data-id="${project.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
          </svg>
        </button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".project-delete")) return;
      window.location.href = "studio.html?id=" + project.id;
    });

    card.querySelector(".project-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this project?")) return;
      await deleteProject(project.id);
      await renderProjects();
    });

    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const now = new Date();
  const diff = (now - d) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " hr ago";
  if (diff < 604800) return Math.floor(diff / 86400) + " days ago";

  return d.toLocaleDateString();
                   }
