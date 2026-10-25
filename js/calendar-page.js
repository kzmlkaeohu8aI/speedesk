/* test-planner/js/calendar-page.js */
(function () {
  "use strict";

  const C = window.TP.config;
  const U = window.TP.utils;
  const Time = window.TP.time;
  const Data = window.TP.data;

  const el = (id) => document.getElementById(id);

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const state = {
    tests: [],
    testsByDate: new Map(),
    viewYear: 0,
    viewMonth: 0,
    selectedDate: null,
    today: U.todayMidnight(),
    timeCtx: null,
    hoverOpenFor: null, // dateKey of day whose card is open, or null
  };

  let hoverHideTimer = null;

  // ---------- bootstrap ----------
  async function boot() {
    wireTheme();
    if (window.TP && window.TP.reminderModal) {
      window.TP.reminderModal.init();
    }
    el("cal-prev").addEventListener("click", () => shiftMonth(-1));
    el("cal-next").addEventListener("click", () => shiftMonth(1));
    el("cal-detail-close").addEventListener("click", () => {
      state.selectedDate = null;
      render();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideHoverCard();
    });
    document.addEventListener("mousedown", (e) => {
      if (!el("cal-hover").hidden &&
          !el("cal-hover").contains(e.target) &&
          !e.target.closest(".cal-cell")) {
        hideHoverCard();
      }
    });

    let loaded;
    try {
      loaded = await Data.load();
    } catch (err) {
      console.error("[Speedesk calendar] load failed:", err);
      showError("Couldn't load the test list.");
      return;
    }

    if (!loaded || loaded.error || !loaded.loaded || !Array.isArray(loaded.tests)) {
      console.error("[Speedesk calendar] bad state:", loaded);
      showError("Couldn't load the test list.");
      return;
    }

    state.tests = loaded.tests.slice();
    state.timeCtx = Time.buildContext(state.tests);

    for (const t of state.tests) {
      const d = normalizeToLocalDay(t._date);
      if (!d) continue;
      const key = dateKey(d);
      if (!state.testsByDate.has(key)) state.testsByDate.set(key, []);
      state.testsByDate.get(key).push(t);
    }

    if (state.testsByDate.size === 0) {
      console.error("[Speedesk calendar] no tests bucketed:", state.tests.length);
      showError("No tests available.");
      return;
    }

    const anchorDate =
      (state.timeCtx.activeTest && state.timeCtx.activeTest._date) ||
      (state.timeCtx.nextTest && state.timeCtx.nextTest._date) ||
      state.today;
    const anchor = normalizeToLocalDay(anchorDate) || state.today;
    state.viewYear = anchor.getFullYear();
    state.viewMonth = anchor.getMonth();

    el("cal-skeleton").hidden = true;
    render();
  }

  // ---------- theme ----------
  function wireTheme() {
    const buttons = document.querySelectorAll(".theme-switcher__btn");
    const stored = (function () {
      try {
        const v = localStorage.getItem(C.THEME_STORAGE_KEY);
        if (v && C.THEMES.indexOf(v) !== -1) return v;
      } catch (e) { /* ignore */ }
      return C.DEFAULT_THEME;
    })();

    const sync = (theme) => {
      for (const b of buttons) {
        const active = b.dataset.themeChoice === theme;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      }
    };
    sync(stored);

    for (const b of buttons) {
      b.addEventListener("click", () => {
        const theme = b.dataset.themeChoice;
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem(C.THEME_STORAGE_KEY, theme); } catch (e) { /* ignore */ }
        sync(theme);
      });
    }
  }

  // ---------- month navigation ----------
  function shiftMonth(delta) {
    let m = state.viewMonth + delta;
    let y = state.viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    state.viewMonth = m;
    state.viewYear = y;
    state.selectedDate = null;
    hideHoverCard();
    render();
  }

  // ---------- render ----------
  function render() {
    renderHeader();
    renderGrid();
    renderDetail();
  }

  function renderHeader() {
    el("cal-month").textContent =
      MONTHS[state.viewMonth] + " " + state.viewYear;
  }

  function renderGrid() {
    const grid = el("cal-grid");
    grid.innerHTML = "";

    const firstOfMonth = new Date(state.viewYear, state.viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(
      state.viewYear, state.viewMonth + 1, 0
    ).getDate();

    const frag = document.createDocumentFragment();

    for (let i = 0; i < startWeekday; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell is-empty";
      frag.appendChild(blank);
    }

    const todayKey = dateKey(state.today);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(state.viewYear, state.viewMonth, day);
      const key = dateKey(date);
      const tests = state.testsByDate.get(key) || [];
      const weekday = date.getDay();

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.date = key;

      if (weekday === 0) cell.classList.add("is-sunday");
      if (tests.length) cell.classList.add("has-tests");
      if (key === todayKey) cell.classList.add("is-today");
      if (key === state.selectedDate) cell.classList.add("is-selected");
      if (!tests.length) cell.disabled = true;

      const dayEl = document.createElement("span");
      dayEl.className = "cal-cell__day";
      dayEl.textContent = String(day);
      cell.appendChild(dayEl);

      if (tests.length) {
        const dots = document.createElement("div");
        dots.className = "cal-dots";
        for (const t of tests.slice(0, 3)) {
          const dot = document.createElement("span");
          dot.className = "cal-dot cal-dot--" + typeKeyFor(t);
          dots.appendChild(dot);
        }
        if (tests.length > 3) {
          const more = document.createElement("span");
          more.className = "cal-dot-more";
          more.textContent = "+" + (tests.length - 3);
          dots.appendChild(more);
        }
        cell.appendChild(dots);
      }

      cell.setAttribute(
        "aria-label",
        `${day} ${MONTHS[state.viewMonth]} ${state.viewYear}` +
        (tests.length ? ` — ${tests.length} test${tests.length === 1 ? "" : "s"}` : " — no tests")
      );

      if (tests.length) {
        cell.addEventListener("click", () => {
          state.selectedDate = key;
          hideHoverCard();
          render();
        });
        cell.addEventListener("mouseenter", () => {
          scheduleHoverCard(key, cell);
        });
        cell.addEventListener("mouseleave", () => {
          scheduleHideHoverCard();
        });
        cell.addEventListener("focus", () => {
          scheduleHoverCard(key, cell);
        });
        cell.addEventListener("blur", () => {
          scheduleHideHoverCard();
        });
      }

      frag.appendChild(cell);
    }

    grid.appendChild(frag);
  }

  // ---------- hover card ----------
  function scheduleHoverCard(key, cell) {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    }
    // small delay so moving between cells doesn't flicker
    setTimeout(() => showHoverCard(key, cell), 120);
  }

  function scheduleHideHoverCard() {
    if (hoverHideTimer) clearTimeout(hoverHideTimer);
    hoverHideTimer = setTimeout(hideHoverCard, 200);
  }

  function showHoverCard(key, cell) {
    const tests = state.testsByDate.get(key) || [];
    if (!tests.length) return;

    state.hoverOpenFor = key;
    const card = el("cal-hover");
    card.innerHTML = "";

    // date heading
    const parts = key.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const head = document.createElement("div");
    head.className = "cal-hover__date";
    head.textContent = U.formatDateLong(d);
    card.appendChild(head);

    for (const t of tests) {
      const row = document.createElement("div");
      row.className = "cal-hover__test";
      row.dataset.type = typeKeyFor(t);

      const title = document.createElement("div");
      title.className = "cal-hover__name";
      title.textContent = t.name;
      row.appendChild(title);

      const meta = document.createElement("div");
      meta.className = "cal-hover__meta";
      const rel = state.timeCtx && state.timeCtx.bySno[t.sno]
        ? state.timeCtx.bySno[t.sno].rel
        : null;
      meta.textContent = (t.type || "") + (rel ? " · " + rel.label : "");
      row.appendChild(meta);

      if (!t.isFullSyllabus) {
        const subjWrap = document.createElement("div");
        subjWrap.className = "cal-hover__subjects";
        for (const sk of C.SUBJECT_ORDER) {
          const chapters = (t.subjects && t.subjects[sk]) || [];
          if (!chapters.length) continue;
          const p = document.createElement("span");
          p.className = "chip " + (C.SUBJECT_CLASS[sk] || "chip--neutral");
          p.textContent = C.SUBJECT_LABEL[sk];
          subjWrap.appendChild(p);
        }
        row.appendChild(subjWrap);
      }

      const actions = document.createElement("div");
      actions.className = "cal-hover__actions";

      const openBtn = document.createElement("a");
      openBtn.className = "btn btn--ghost cal-hover__btn";
      openBtn.href = "./#" + encodeURIComponent(t.name);
      openBtn.textContent = "Open";
      actions.appendChild(openBtn);

      const remindBtn = document.createElement("button");
      remindBtn.type = "button";
      remindBtn.className = "btn btn--ghost cal-hover__btn";
      remindBtn.textContent = "Remind";
      remindBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadReminder(t);
      });
      actions.appendChild(remindBtn);

      row.appendChild(actions);
      card.appendChild(row);
    }

    card.hidden = false;

    // position near the cell
    const rect = cell.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = rect.left + rect.width / 2 - cardRect.width / 2;
    left = Math.max(8, Math.min(left, winW - cardRect.width - 8));

    let top = rect.top - cardRect.height - 8;
    if (top < 8) {
      // flip below the cell if not enough room above
      top = rect.bottom + 8;
    }
    if (top + cardRect.height > winH - 8) {
      top = winH - cardRect.height - 8;
    }

    card.style.left = left + "px";
    card.style.top = top + "px";
  }

  function hideHoverCard() {
    if (hoverHideTimer) {
      clearTimeout(hoverHideTimer);
      hoverHideTimer = null;
    }
    state.hoverOpenFor = null;
    const card = el("cal-hover");
    if (card) {
      card.hidden = true;
      card.innerHTML = "";
    }
  }

  // ---------- reminders ----------
  function downloadReminder(test) {
    if (window.TP && window.TP.reminderModal) {
      window.TP.reminderModal.open(test);
    } else {
      // Fallback: use the old direct path if the modal script failed to load
      try {
        window.TP.calendar.downloadForTest(test, C.BATCH_NAME);
      } catch (err) {
        console.error("[Speedesk] reminder failed:", err);
      }
    }
  }

  // ---------- day detail panel ----------
  function renderDetail() {
    const panel = el("cal-detail");
    if (!state.selectedDate) {
      panel.hidden = true;
      return;
    }
    const tests = state.testsByDate.get(state.selectedDate) || [];
    if (!tests.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    const parts = state.selectedDate.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    el("cal-detail-date").textContent = U.formatDateLong(d);

    const list = el("cal-detail-list");
    list.innerHTML = "";

    for (const t of tests) {
      const card = document.createElement("div");
      card.className = "cal-card";
      card.dataset.type = typeKeyFor(t);

      const head = document.createElement("div");
      head.className = "cal-card__head";

      const name = document.createElement("div");
      name.className = "cal-card__name";
      name.textContent = t.name;
      head.appendChild(name);

      if (t.type) {
        const typeChip = document.createElement("span");
        typeChip.className = "chip chip--neutral";
        typeChip.textContent = t.type;
        head.appendChild(typeChip);
      }

      card.appendChild(head);

      const meta = document.createElement("div");
      meta.className = "cal-card__meta";
      const rel = state.timeCtx && state.timeCtx.bySno[t.sno]
        ? state.timeCtx.bySno[t.sno].rel
        : null;
      meta.textContent = U.formatDateShort(t._date) +
        (rel ? " · " + rel.label : "");
      card.appendChild(meta);

      if (!t.isFullSyllabus) {
        const subjWrap = document.createElement("div");
        subjWrap.className = "cal-card__subjects";
        for (const key of C.SUBJECT_ORDER) {
          const chapters = (t.subjects && t.subjects[key]) || [];
          if (!chapters.length) continue;
          const p = document.createElement("span");
          p.className = "chip " + (C.SUBJECT_CLASS[key] || "chip--neutral");
          p.textContent = C.SUBJECT_LABEL[key];
          subjWrap.appendChild(p);
        }
        if (subjWrap.childNodes.length) card.appendChild(subjWrap);
      } else {
        const note = document.createElement("div");
        note.className = "cal-card__meta";
        note.textContent = "Full syllabus";
        card.appendChild(note);
      }

      if (t.subjects) {
        const preview = document.createElement("div");
        preview.className = "cal-card__preview";
        let count = 0;
        for (const key of C.SUBJECT_ORDER) {
          const chapters = t.subjects[key] || [];
          for (const raw of chapters) {
            if (count >= 4) break;
            const line = document.createElement("div");
            line.className = "cal-card__chapter";
            line.innerHTML =
              "<span class='cal-card__subject'>" +
              U.escapeHTML(C.SUBJECT_LABEL[key]) +
              "</span> " +
              U.escapeHTML(U.cleanChapter(raw));
            preview.appendChild(line);
            count++;
          }
          if (count >= 4) break;
        }
        if (preview.childNodes.length) card.appendChild(preview);

        const totalChapters = Object.keys(t.subjects).reduce(
          (n, k) => n + (t.subjects[k] || []).length, 0
        );
        if (totalChapters > 4) {
          const more = document.createElement("div");
          more.className = "cal-card__more";
          more.textContent = "+" + (totalChapters - 4) + " more chapters";
          card.appendChild(more);
        }
      }

      const actions = document.createElement("div");
      actions.className = "cal-card__actions";

      const openLink = document.createElement("a");
      openLink.className = "btn btn--ghost cal-card__open";
      openLink.href = "./#" + encodeURIComponent(t.name);
      openLink.textContent = "Open test";
      actions.appendChild(openLink);

      const remindBtn = document.createElement("button");
      remindBtn.type = "button";
      remindBtn.className = "btn btn--ghost cal-card__open";
      remindBtn.textContent = "Set reminder";
      remindBtn.addEventListener("click", () => downloadReminder(t));
      actions.appendChild(remindBtn);

      card.appendChild(actions);
      list.appendChild(card);
    }
  }

  // ---------- helpers ----------
  function normalizeToLocalDay(d) {
    if (!d) return null;
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dateKey(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function typeKeyFor(test) {
    const k = C.tileKeyFor(test);
    return k === "none" ? "part" : k;
  }

  function showError(msg) {
    el("cal-skeleton").hidden = true;
    el("cal-grid").innerHTML = "";
    el("cal-month").textContent = msg || "Couldn't load the calendar";
    const bar = el("snackbar");
    el("snackbar-text").textContent = msg || C.STRINGS.loadError;
    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("is-open");
    setTimeout(() => bar.classList.remove("is-open"), 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();