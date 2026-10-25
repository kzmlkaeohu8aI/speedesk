/* test-planner/js/interactions.js */
(function (global) {
  "use strict";

  const C = global.TP.config;
  const el = (id) => document.getElementById(id);

  /* =========================================================
   *  Snackbar
   * ========================================================= */
  let snackTimer = null;
  function snackbar(message, opts) {
    const bar = el("snackbar");
    const text = el("snackbar-text");
    const action = el("snackbar-action");

    text.textContent = message;

    if (opts && opts.actionLabel && typeof opts.onAction === "function") {
      action.hidden = false;
      action.textContent = opts.actionLabel;
      action.onclick = () => { hideSnackbar(); opts.onAction(); };
    } else {
      action.hidden = true;
      action.onclick = null;
    }

    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("is-open");

    if (snackTimer) clearTimeout(snackTimer);
    snackTimer = setTimeout(hideSnackbar, opts && opts.duration ? opts.duration : 5000);
  }
  function hideSnackbar() {
    const bar = el("snackbar");
    bar.classList.remove("is-open");
    if (snackTimer) { clearTimeout(snackTimer); snackTimer = null; }
    setTimeout(() => {
      if (!bar.classList.contains("is-open")) bar.hidden = true;
    }, 220);
  }

  /* =========================================================
   *  Theme
   * ========================================================= */
  function getStoredTheme() {
    try {
      const v = localStorage.getItem(C.THEME_STORAGE_KEY);
      if (v && C.THEMES.indexOf(v) !== -1) return v;
    } catch (e) { /* ignore */ }
    return C.DEFAULT_THEME;
  }

  function applyTheme(theme) {
    const t = C.THEMES.indexOf(theme) !== -1 ? theme : C.DEFAULT_THEME;
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(C.THEME_STORAGE_KEY, t); } catch (e) { /* ignore */ }
    syncThemeSwitcher(t);
  }

  function syncThemeSwitcher(theme) {
    const buttons = document.querySelectorAll(".theme-switcher__btn");
    for (const b of buttons) {
      const isActive = b.dataset.themeChoice === theme;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-pressed", String(isActive));
    }
  }

  function wireThemeSwitcher() {
    const buttons = document.querySelectorAll(".theme-switcher__btn");
    for (const b of buttons) {
      b.addEventListener("click", () => {
        applyTheme(b.dataset.themeChoice);
      });
    }
    syncThemeSwitcher(getStoredTheme());
  }

  function initThemeEarly() {
    syncThemeSwitcher(getStoredTheme());
  }

  /* =========================================================
   *  Custom dropdown
   * ========================================================= */
  const menuRegistry = {};
  let openMenuId = null;

  function registerMenu(config) {
    menuRegistry[config.id] = config;
    const { trigger } = config;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenuId === config.id) closeMenu();
      else openMenu(config.id);
    });
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu(config.id, true);
      }
    });
  }

  function openMenu(id, focusFirst) {
    if (openMenuId && openMenuId !== id) closeMenu();
    const cfg = menuRegistry[id];
    if (!cfg) return;

    const { trigger, menu } = cfg;
    const options = cfg.getOptions();
    menu.innerHTML = "";

    for (const opt of options) {
      const li = document.createElement("li");
      li.className = "menu__item";
      li.setAttribute("role", "option");
      li.setAttribute("tabindex", "-1");
      li.dataset.value = opt.value;
      if (opt.value === cfg.selectedKey()) li.setAttribute("aria-selected", "true");

      const label = document.createElement("span");
      label.textContent = opt.label;
      li.appendChild(label);

      const check = document.createElement("span");
      check.className = "material-symbols-outlined";
      check.textContent = "check";
      check.setAttribute("aria-hidden", "true");
      li.appendChild(check);

      li.addEventListener("click", () => {
        cfg.onSelect(opt.value);
        closeMenu();
        trigger.focus();
      });

      menu.appendChild(li);
    }

    menu.hidden = false;
    const rect = trigger.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    const menuRect = menu.getBoundingClientRect();
    const overflowRight = rect.left + menuRect.width - window.innerWidth;
    if (overflowRight > 0) {
      menu.style.left = `${Math.max(8, window.innerWidth - menuRect.width - 8)}px`;
    }
    trigger.setAttribute("aria-expanded", "true");
    openMenuId = id;
    if (focusFirst) {
      const first = menu.querySelector(".menu__item");
      if (first) first.focus();
    }
    document.addEventListener("mousedown", outsideClick, true);
    document.addEventListener("keydown", keyNav, true);
    window.addEventListener("scroll", onScrollClose, true);
    window.addEventListener("resize", closeMenu);
  }

  function closeMenu() {
    if (!openMenuId) return;
    const cfg = menuRegistry[openMenuId];
    if (cfg) {
      cfg.menu.hidden = true;
      cfg.trigger.setAttribute("aria-expanded", "false");
    }
    openMenuId = null;
    document.removeEventListener("mousedown", outsideClick, true);
    document.removeEventListener("keydown", keyNav, true);
    window.removeEventListener("scroll", onScrollClose, true);
    window.removeEventListener("resize", closeMenu);
  }

  function outsideClick(e) {
    if (!openMenuId) return;
    const cfg = menuRegistry[openMenuId];
    if (!cfg) return;
    if (cfg.menu.contains(e.target) || cfg.trigger.contains(e.target)) return;
    closeMenu();
  }
  function onScrollClose(e) {
    if (!openMenuId) return;
    const cfg = menuRegistry[openMenuId];
    if (cfg && cfg.menu.contains(e.target)) return;
    closeMenu();
  }
  function keyNav(e) {
    if (!openMenuId) return;
    const cfg = menuRegistry[openMenuId];
    const items = Array.from(cfg.menu.querySelectorAll(".menu__item"));
    if (!items.length) return;
    const idx = items.findIndex((it) => it === document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      cfg.trigger.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  }

  /* =========================================================
   *  Drawer — own scroll, opens from top
   * ========================================================= */
  let drawerOpen = false;
  let lastFocused = null;
  let savedScrollY = 0;

  function lockBodyScroll() {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = `-${savedScrollY}px`;
    document.body.classList.add("is-locked");
  }
  function unlockBodyScroll() {
    document.body.classList.remove("is-locked");
    document.body.style.top = "";
    window.scrollTo(0, savedScrollY);
  }

  function openDrawer() {
    if (drawerOpen) return;
    drawerOpen = true;
    lastFocused = document.activeElement;

    lockBodyScroll();

    const scrim = el("drawer-scrim");
    const drawer = el("drawer");
    const body = el("drawer-body");

    // Reset drawer scroll BEFORE we show it.
    body.scrollTop = 0;
    body.style.overscrollBehavior = "contain";

    scrim.hidden = false;
    drawer.hidden = false;
    void drawer.offsetWidth;
    scrim.classList.add("is-open");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");

    // Reset again AFTER the browser lays out the freshly rendered content.
    requestAnimationFrame(() => {
      body.scrollTop = 0;
    });

    // One more reset at the end of the slide transition.
    setTimeout(() => {
      if (drawerOpen) body.scrollTop = 0;
    }, 320);

    // Focus the drawer container itself, not the close button.
    // - Keeps focus trapped inside the dialog (required for a11y).
    // - No visible focus ring on the close button when the drawer opens.
    // - Keyboard users Tab forward to reach close / share.
    setTimeout(() => el("drawer").focus({ preventScroll: true }), 60);
    document.addEventListener("keydown", drawerKey, true);
    window.addEventListener("resize", onResizeDrawer);
  }

  function closeDrawer() {
    if (!drawerOpen) return;
    drawerOpen = false;

    const scrim = el("drawer-scrim");
    const drawer = el("drawer");
    scrim.classList.remove("is-open");
    drawer.classList.remove("is-open");

    setTimeout(() => {
      if (!drawerOpen) {
        scrim.hidden = true;
        drawer.hidden = true;
      }
    }, 220);

    unlockBodyScroll();
    document.removeEventListener("keydown", drawerKey, true);
    window.removeEventListener("resize", onResizeDrawer);

    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  }

  function drawerKey(e) {
    if (!drawerOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
      return;
    }
    if (e.key === "Tab") {
      const focusables = el("drawer").querySelectorAll(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
  }
  function onResizeDrawer() {
    if (window.innerWidth >= 900 && drawerOpen) closeDrawer();
  }
  function isDrawerOpen() { return drawerOpen; }

  /* =========================================================
   *  Filters wiring
   * ========================================================= */
  function wireFilters(opts) {
    const { getTypeOptions, onTypeChange } = opts;
    registerMenu({
      id: "type",
      trigger: el("type-trigger"),
      menu: el("type-menu"),
      getOptions: getTypeOptions,
      selectedKey: () => el("type-trigger").dataset.value || "all",
      onSelect: (value) => {
        el("type-trigger").dataset.value = value;
        el("type-value").textContent =
          value === "all" ? C.STRINGS.filterAll : value;
        onTypeChange(value);
      },
    });
  }

  /* =========================================================
   *  Share — copies the current URL (with #hash) to clipboard
   * ========================================================= */
  async function shareCurrentUrl() {
    const url = window.location.href;

    // Preferred: modern clipboard API (requires secure context or localhost)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        snackbar("Link copied.");
        return true;
      } catch (e) {
        // fall through to legacy
      }
    }

    // Fallback: hidden textarea + execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        snackbar("Link copied.");
        return true;
      }
    } catch (e) {
      /* ignore */
    }

    snackbar("Couldn't copy the link.");
    return false;
  }

  global.TP = global.TP || {};
  global.TP.ui = {
    snackbar,
    hideSnackbar,
    wireFilters,
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    applyTheme,
    wireThemeSwitcher,
    initThemeEarly,
    getStoredTheme,
    shareCurrentUrl,
  };
})(window);