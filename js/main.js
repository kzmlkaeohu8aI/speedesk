/* test-planner/js/main.js */
(function () {
  "use strict";

  const C = window.TP.config;
  const U = window.TP.utils;
  const Time = window.TP.time;
  const Data = window.TP.data;
  const F = window.TP.filters;
  const R = window.TP.render;
  const UI = window.TP.ui;

  const el = (id) => document.getElementById(id);

  const app = {
    timeCtx: null,
    selectedSno: null,
    tickTimer: null,
    refreshTimer: null,
    wired: {
      filters: false,
      scope: false,
      search: false,
      refresh: false,
      emptyClear: false,
      drawerClose: false,
      rowSelection: false,
      hash: false,
      visibility: false,
      hero: false,
      theme: false,
      share: false,
      calendar: false,
      print: false,
    },
  };

  async function bootstrap() {
    UI.initThemeEarly();

    R.setHeaderDate(Time.headerLabel(U.todayMidnight()), C.BATCH_SHORT);
    R.showSkeleton(true);

    const state = await Data.load();

    if (state.error || !state.loaded || state.tests.length === 0) {
      showLoadError();
      return;
    }

    app.timeCtx = Time.buildContext(state.tests);
    R.setHeaderDate(Time.headerLabel(app.timeCtx.today), C.BATCH_SHORT);

    R.showSkeleton(false);
    reRenderList();

    try {
      wireThemeSwitcher();
      wireFiltersOnce(state.tests);
      wireScopeToggle();
      wireSearch();
      wireRefresh();
      wireEmptyClear();
      wireDrawerClose();
      wireRowSelection();
      wireHashNavigation();
      wireVisibility();
      wireHero();
      wireShare();
      wireCalendar();
      wirePrint();
      if (window.TP && window.TP.reminderModal) {
        window.TP.reminderModal.init();
      }
    } catch (err) {
      console.error("[Speedesk] wiring failed:", err);
      UI.snackbar("Some controls failed to initialize. Reload the page.", {
        duration: 8000,
      });
    }

    // On cold load: if URL has a #hash pointing to a test, open it in the
    // drawer immediately. Otherwise just highlight today's / next test
    // without opening anything.
    const fromHash = findHashTest();

    if (fromHash) {
      // Select + open the drawer for the shared test.
      highlightTest(fromHash.sno);
      // Defer by one frame so the DOM (drawer, drawer-body, title) is
      // fully laid out before we open — prevents any flash of empty content.
      requestAnimationFrame(() => {
        openDrawerForTest(fromHash.sno);
      });
    } else {
      const initial =
        (app.timeCtx.activeTest && app.timeCtx.activeTest.sno) ||
        (app.timeCtx.nextTest && app.timeCtx.nextTest.sno) ||
        null;
      if (initial != null) {
        highlightTest(initial);
      }
    }

    startTimers();
  }

  function startTimers() {
    stopTimers();
    tickOnce();
    app.tickTimer = setInterval(tickOnce, C.TICK_MS);
    app.refreshTimer = setInterval(relabelPass, 60 * 1000);
  }
  function stopTimers() {
    if (app.tickTimer) { clearInterval(app.tickTimer); app.tickTimer = null; }
    if (app.refreshTimer) { clearInterval(app.refreshTimer); app.refreshTimer = null; }
  }
  function tickOnce() {
    const state = Data.getState();
    if (!state.loaded) return;
    R.tickCountdowns(state.tests);
  }
  function relabelPass() {
    const state = Data.getState();
    if (!state.loaded) return;
    app.timeCtx = Time.buildContext(state.tests);
    R.setHeaderDate(Time.headerLabel(app.timeCtx.today), C.BATCH_SHORT);
    reRenderList();
  }
  function wireVisibility() {
    if (app.wired.visibility) return;
    app.wired.visibility = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTimers();
      else startTimers();
    });
  }

  function wireThemeSwitcher() {
    if (app.wired.theme) return;
    app.wired.theme = true;
    UI.wireThemeSwitcher();
  }

  function wireFiltersOnce(tests) {
    if (app.wired.filters) return;
    app.wired.filters = true;
    const typeOptions = F.typeOptions(tests);
    UI.wireFilters({
      getTypeOptions: () => {
        const opts = [{ value: "all", label: C.STRINGS.filterAll }];
        for (const t of typeOptions) opts.push({ value: t, label: t });
        return opts;
      },
      onTypeChange: (value) => { F.set({ type: value }); reRenderList(); },
    });
  }

  function wireScopeToggle() {
    if (app.wired.scope) return;
    app.wired.scope = true;
    const up = el("scope-upcoming");
    const all = el("scope-all");
    const setScope = (scope) => {
      F.set({ scope });
      up.classList.toggle("is-active", scope === "upcoming");
      all.classList.toggle("is-active", scope === "all");
      up.setAttribute("aria-selected", String(scope === "upcoming"));
      all.setAttribute("aria-selected", String(scope === "all"));
      reRenderList();
    };
    up.addEventListener("click", () => setScope("upcoming"));
    all.addEventListener("click", () => setScope("all"));
  }

  function wireSearch() {
    if (app.wired.search) return;
    app.wired.search = true;
    const input = el("search-input");
    const clear = el("search-clear");
    const onInput = U.debounce(() => {
      const value = input.value;
      clear.hidden = value.length === 0;
      F.set({ query: value });
      reRenderList();
    }, 120);
    input.addEventListener("input", onInput);
    clear.addEventListener("click", () => {
      input.value = "";
      clear.hidden = true;
      F.set({ query: "" });
      reRenderList();
      input.focus();
    });
  }

  function wireRefresh() {
    if (app.wired.refresh) return;
    app.wired.refresh = true;
    const btn = el("refresh-btn");
    btn.addEventListener("click", async () => {
      if (btn.classList.contains("is-loading")) return;
      btn.classList.add("is-loading");
      btn.disabled = true;
      R.showSkeleton(true);
      const state = await Data.reload();
      btn.classList.remove("is-loading");
      btn.disabled = false;
      if (state.error || !state.loaded || state.tests.length === 0) {
        showLoadError(); return;
      }
      R.showSkeleton(false);
      app.timeCtx = Time.buildContext(state.tests);
      R.setHeaderDate(Time.headerLabel(app.timeCtx.today), C.BATCH_SHORT);
      reRenderList();
      tickOnce();
      UI.snackbar("Test list refreshed.");
    });
  }

  function wireEmptyClear() {
    if (app.wired.emptyClear) return;
    app.wired.emptyClear = true;
    el("empty-clear").addEventListener("click", () => {
      if (el("empty-text").textContent === C.STRINGS.loadError) return;
      F.reset();
      el("search-input").value = "";
      el("search-clear").hidden = true;
      el("type-trigger").dataset.value = "all";
      el("type-value").textContent = C.STRINGS.filterAll;
      el("scope-upcoming").classList.add("is-active");
      el("scope-all").classList.remove("is-active");
      el("scope-upcoming").setAttribute("aria-selected", "true");
      el("scope-all").setAttribute("aria-selected", "false");
      reRenderList();
    });
  }

  function wireDrawerClose() {
    if (app.wired.drawerClose) return;
    app.wired.drawerClose = true;
    el("drawer-close").addEventListener("click", () => UI.closeDrawer());
    el("drawer-scrim").addEventListener("click", () => UI.closeDrawer());
  }

  function wireRowSelection() {
    if (app.wired.rowSelection) return;
    app.wired.rowSelection = true;
    el("list").addEventListener("click", (e) => {
      const row = e.target.closest(".row");
      if (!row) return;
      const sno = Number(row.dataset.sno);
      if (!sno) return;
      openTest(sno);
    });
  }

  function wireHero() {
    if (app.wired.hero) return;
    app.wired.hero = true;
    const hero = el("hero-tile");
    hero.addEventListener("click", () => {
      const sno = Number(hero.dataset.sno);
      if (sno) openTest(sno);
    });
    hero.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const sno = Number(hero.dataset.sno);
        if (sno) openTest(sno);
      }
    });
  }

  function wireShare() {
    if (app.wired.share) return;
    app.wired.share = true;
    el("drawer-share").addEventListener("click", () => {
      UI.shareCurrentUrl();
    });
  }

  function wireCalendar() {
    if (app.wired.calendar) return;
    app.wired.calendar = true;
    el("drawer-calendar").addEventListener("click", () => {
      const state = Data.getState();
      if (!state.loaded || app.selectedSno == null) return;
      const test = state.bySno[app.selectedSno];
      if (!test) return;
      if (window.TP && window.TP.reminderModal) {
        window.TP.reminderModal.open(test);
      } else {
        // Fallback if the modal script didn't load
        try {
          window.TP.calendar.downloadForTest(test, C.BATCH_NAME);
          UI.snackbar("Reminder downloaded. Open it to add to your calendar.");
        } catch (err) {
          console.error("[Speedesk] calendar export failed:", err);
          UI.snackbar("Couldn't create the reminder file.");
        }
      }
    });
  }

  function wirePrint() {
    if (app.wired.print) return;
    app.wired.print = true;
    el("drawer-print").addEventListener("click", () => {
      const state = Data.getState();
      if (!state.loaded || app.selectedSno == null) {
        window.print();
        return;
      }
      const test = state.bySno[app.selectedSno];

      // Set document.title to a test-specific, date-stamped string so the
      // browser's "Save as PDF" dialog defaults to "<test> — <date>".
      // Restore the original title after the print dialog closes.
      const originalTitle = document.title;
      const safeDate = test._date ? U.formatDateShort(test._date) : "";
      const filenameTitle = safeDate
        ? `${test.name} — ${safeDate}`
        : test.name;
      document.title = filenameTitle;

      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        document.title = originalTitle;
        window.removeEventListener("afterprint", restore);
      };
      window.addEventListener("afterprint", restore);
      // Safety net: some browsers don't reliably fire afterprint when the
      // user cancels the dialog. Restore after a short delay regardless.
      setTimeout(restore, 2000);

      window.print();
    });
  }

  /**
   * Open a test — the SAME way on every screen size: open the drawer.
   * The list never scrolls. The page never scrolls. The drawer owns
   * its own scroll and always opens from the top (see interactions.js).
   */
  function openTest(sno) {
    highlightTest(sno, { scrollIntoView: false });
    updateHash(sno);
    openDrawerForTest(sno);
    tickOnce();
  }

  function highlightTest(sno) {
    const state = Data.getState();
    if (!state.bySno[sno]) return;
    app.selectedSno = sno;
    const rows = el("list").querySelectorAll(".row");
    rows.forEach((r) => {
      r.classList.toggle("is-selected", Number(r.dataset.sno) === sno);
    });
  }

  function openDrawerForTest(sno) {
    const state = Data.getState();
    const test = state.bySno[sno];
    if (!test) return;
    el("drawer-title").textContent = test.name;
    try {
      R.renderDetail({
        test,
        timeCtx: app.timeCtx,
        query: F.state.query,
        targetEl: el("drawer-body"),
      });
    } catch (err) {
      console.error("[Speedesk] detail render failed:", err);
      UI.snackbar("Couldn't open this test.");
      return;
    }
    UI.openDrawer();
  }

  function updateHash(sno) {
    const state = Data.getState();
    const test = state.bySno[sno];
    if (!test) return;
    const nextHash = "#" + encodeURIComponent(test.name);
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  }

  function findHashTest() {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) return null;
    let name = raw;
    try { name = decodeURIComponent(raw); } catch (e) { /* ignore */ }
    const state = Data.getState();
    return state.tests.find((t) => t.name.toLowerCase() === name.toLowerCase()) || null;
  }

  function wireHashNavigation() {
    if (app.wired.hash) return;
    app.wired.hash = true;
    window.addEventListener("hashchange", () => {
      const test = findHashTest();
      if (test) openTest(test.sno);
    });
  }

  function reRenderList() {
    const state = Data.getState();
    if (!state.loaded) return;
    if (!app.timeCtx) app.timeCtx = Time.buildContext(state.tests);
    const results = F.apply(state.tests, app.timeCtx);
    const grouped = F.groupResults(results, U.tokenize(F.state.query));
    R.renderList({
      grouped,
      timeCtx: app.timeCtx,
      selectedSno: app.selectedSno,
      query: F.state.query,
    });
    const nextForHero =
      (app.timeCtx.activeTest && app.timeCtx.activeTest) ||
      (app.timeCtx.nextTest && app.timeCtx.nextTest) ||
      null;

    const today = app.timeCtx.today;
    let doneCount = 0;
    for (const t of state.tests) {
      if (!t._date) continue;
      if (U.daysBetween(today, t._date) < 0) doneCount++;
    }
    const statBundle = { done: doneCount, total: state.tests.length };

    R.renderHero(nextForHero, false, statBundle);
    R.renderStats(app.timeCtx, state.tests);
  }

  function showLoadError() {
    R.showSkeleton(false);
    R.renderHero(null, false, null);
    R.renderStats(
      {
        today: U.todayMidnight(),
        activeTest: null,
        nextTest: null,
        allPast: true,
        bySno: {},
      },
      []
    );

    const listEl = el("list");
    const emptyEl = el("empty-state");
    const emptyText = el("empty-text");
    const clearBtn = el("empty-clear");

    listEl.hidden = true;
    listEl.innerHTML = "";
    emptyEl.hidden = false;
    emptyText.textContent = C.STRINGS.loadError;

    clearBtn.textContent = C.STRINGS.retry;
    clearBtn.onclick = () => {
      clearBtn.onclick = null;
      clearBtn.textContent = C.STRINGS.clearFilters;
      el("refresh-btn").click();
    };

    UI.snackbar(C.STRINGS.loadError, {
      actionLabel: C.STRINGS.retry,
      duration: 6000,
      onAction: () => el("refresh-btn").click(),
    });
  }

  function start() {
    Promise.resolve().then(bootstrap).catch((err) => {
      console.error("[Speedesk] bootstrap failed:", err);
      R.showSkeleton(false);
      showLoadError();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();