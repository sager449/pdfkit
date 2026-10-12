const LANG_KEY = "pdfkit-lang";

function applyLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-en]").forEach((el) => {
    const value = el.getAttribute("data-" + lang);
    if (value) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = value;
      } else {
        el.innerHTML = value;
      }
    }
  });

  document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
    el.placeholder = el.getAttribute("data-" + lang + "-placeholder");
  });
}

function toggleLang() {
  const current = localStorage.getItem(LANG_KEY) || "en";
  const next = current === "en" ? "ar" : "en";
  localStorage.setItem(LANG_KEY, next);
  applyLang(next);
}

applyLang(localStorage.getItem(LANG_KEY) || "en");
