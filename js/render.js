/* test-planner/js/render.js */
(function (global) {
  "use strict";

  const C = global.TP.config;
  const U = global.TP.utils;
  const F = global.TP.filters;
  const Time = global.TP.time;

  const el = (id) => document.getElementById(id);

  /* =========================================================
   *  List
   * ========================================================= */
  function renderList(params) {
    const { grouped, timeCtx, selectedSno, query } = params;
    const listEl = el("list");
    const emptyEl = el("empty-state");
    const skeletonEl = el("skeleton");

    skeletonEl.hidden = true;
    listEl.innerHTML = "";

    const tokens = U.tokenize(query);

    const total = grouped.grouped
      ? grouped.byName.length + grouped.byChapter.length
      : grouped.all.length;

    if (total === 0) {
      listEl.hidden = true;
      emptyEl.hidden = false;
      const noUpcoming =
        F.state.scope === "upcoming" && !F.state.query && F.state.type === "all";
      el("empty-text").textContent = noUpcoming
        ? C.STRINGS.emptyUpcoming
        : C.STRINGS.emptyNoMatch;
      return;
    }

    listEl.hidden = false;
    emptyEl.hidden = true;

    if (!grouped.grouped) {
      const frag = document.createDocumentFragment();
      for (const test of grouped.all) {
        frag.appendChild(buildRow(test, { timeCtx, selectedSno, tokens }));
      }
      listEl.appendChild(frag);
      return;
    }

    if (grouped.byName.length) {
      listEl.appendChild(buildGroupHeader("Matching tests", grouped.byName.length));
      const frag = document.createDocumentFragment();
      for (const r of grouped.byName) {
        frag.appendChild(
          buildRow(r.test, {
            timeCtx, selectedSno, tokens, matchedChapters: r.matchedChapters,
          })
        );
      }
      listEl.appendChild(frag);
    }
    if (grouped.byChapter.length) {
      listEl.appendChild(
        buildGroupHeader("Matching chapters", grouped.byChapter.length)
      );
      const frag = document.createDocumentFragment();
      for (const r of grouped.byChapter) {
        frag.appendChild(
          buildRow(r.test, {
            timeCtx, selectedSno, tokens, matchedChapters: r.matchedChapters,
          })
        );
      }
      listEl.appendChild(frag);
    }
  }

  function buildGroupHeader(label, count) {
    const div = document.createElement("div");
    div.className = "group-header";
    div.textContent = `${label} · ${count}`;
    return div;
  }

  function buildRow(test, opts) {
    const { timeCtx, selectedSno, tokens, matchedChapters } = opts;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row";
    btn.dataset.sno = String(test.sno);
    btn.setAttribute("role", "listitem");
    btn.setAttribute("aria-label", `${test.name}, ${test.dateStr}`);

    const tileKey = C.tileKeyFor(test);
    if (tileKey !== "none") btn.classList.add("row--type-" + tileKey);

    if (selectedSno === test.sno) btn.classList.add("is-selected");

    const rel = timeCtx && timeCtx.bySno[test.sno]
      ? timeCtx.bySno[test.sno].rel
      : null;
    if (rel && rel.isPast) btn.classList.add("is-past");

    const top = document.createElement("div");
    top.className = "row__top";

    const name = document.createElement("span");
    name.className = "row__name";
    name.innerHTML = U.highlight(test.name, tokens || []);
    top.appendChild(name);

    const when = document.createElement("span");
    when.className = "row__when";
    if (rel && rel.isToday) when.textContent = "Today";
    else if (rel) when.textContent = rel.label;
    top.appendChild(when);
    btn.appendChild(top);

    const meta = document.createElement("div");
    meta.className = "row__meta";

    const dateSpan = document.createElement("span");
    dateSpan.className = "row__date";
    dateSpan.textContent = U.formatDateShort(test._date);
    meta.appendChild(dateSpan);

    if (test.type) meta.appendChild(chipNeutral(test.type));
    if (test.pattern && test.pattern !== test.type) {
      meta.appendChild(chipNeutral(test.pattern));
    }
    btn.appendChild(meta);

    if (!test.isFullSyllabus) {
      const pills = subjectPillsFor(test);
      if (pills.childNodes.length) btn.appendChild(pills);
    }

    if (matchedChapters && matchedChapters.length) {
      const snip = document.createElement("div");
      snip.className = "row__snippet";
      const first = matchedChapters[0];
      const chapterText = U.cleanChapter(first.chapter);
      const labelPrefix = C.SUBJECT_LABEL[first.subject] || first.subject;
      const more =
        matchedChapters.length > 1
          ? ` +${matchedChapters.length - 1} more`
          : "";
      snip.innerHTML =
        `<strong>${U.escapeHTML(labelPrefix)}:</strong> ` +
        U.highlight(chapterText, tokens || []) +
        U.escapeHTML(more);
      btn.appendChild(snip);
    }

    return btn;
  }

  function chipNeutral(label) {
    const span = document.createElement("span");
    span.className = "chip chip--neutral";
    span.textContent = label;
    return span;
  }

  function subjectPillsFor(test) {
    const wrap = document.createElement("div");
    wrap.className = "row__subjects";
    for (const key of C.SUBJECT_ORDER) {
      const chapters = test.subjects[key] || [];
      if (!chapters.length) continue;
      const span = document.createElement("span");
      span.className = "chip " + (C.SUBJECT_CLASS[key] || "chip--muted");
      span.textContent = C.SUBJECT_LABEL[key];
      wrap.appendChild(span);
    }
    return wrap;
  }

  /* =========================================================
   *  Detail
   * ========================================================= */
  function renderDetail(params) {
    const { test, timeCtx, query, targetEl } = params;
    targetEl.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "detail";
    wrap.dataset.sno = String(test.sno);

    const tileKey = C.tileKeyFor(test);
    if (tileKey !== "none") wrap.classList.add("detail--type-" + tileKey);

    const header = document.createElement("div");
    header.className = "detail__header";

    const eyebrow = document.createElement("span");
    eyebrow.className = "detail__eyebrow";
    eyebrow.textContent = test.type || "Test";
    header.appendChild(eyebrow);

    const nameEl = document.createElement("h2");
    nameEl.className = "detail__name";
    nameEl.textContent = test.name;
    header.appendChild(nameEl);

    const meta = document.createElement("div");
    meta.className = "detail__meta";

    const dateIcon = document.createElement("span");
    dateIcon.className = "material-symbols-outlined detail__meta-icon";
    dateIcon.textContent = "event";
    dateIcon.setAttribute("aria-hidden", "true");
    meta.appendChild(dateIcon);

    const dateText = document.createElement("span");
    dateText.textContent = U.formatDateLong(test._date);
    meta.appendChild(dateText);

    if (test.pattern && test.pattern !== test.type) {
      meta.appendChild(chipNeutral(test.pattern));
    }
    if (test.batch) {
      const b = document.createElement("span");
      b.className = "chip chip--lavender";
      b.textContent = test.batch;
      meta.appendChild(b);
    }
    header.appendChild(meta);

    const rel = timeCtx && timeCtx.bySno[test.sno]
      ? timeCtx.bySno[test.sno].rel
      : null;
    const isPast = rel ? rel.isPast : false;

    const cdBlock = document.createElement("div");
    cdBlock.className = "detail__countdown-block";

    const cdRow = document.createElement("div");
    cdRow.className = "detail__countdown-row";

    if (isPast) {
      const relEl = document.createElement("span");
      relEl.className = "detail__relative";
      relEl.textContent = "Past · " + rel.label;
      cdRow.appendChild(relEl);
    } else {
      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined detail__countdown-icon";
      icon.textContent = "schedule";
      icon.setAttribute("aria-hidden", "true");
      cdRow.appendChild(icon);

      const label = document.createElement("span");
      label.className = "detail__countdown-label";
      label.textContent = C.STRINGS.countdownLabel;
      cdRow.appendChild(label);

      const value = document.createElement("span");
      value.className = "detail__countdown-value";
      value.dataset.countdownFor = String(test.sno);
      const parts = Time.countdownParts(test._date, new Date());
      value.textContent = Time.formatCountdownLong(parts);
      cdRow.appendChild(value);

      const hint = document.createElement("span");
      hint.className = "detail__countdown-hint";
      hint.textContent = Time.formatHumanHint(test._date, timeCtx.today);
      cdRow.appendChild(hint);
    }
    cdBlock.appendChild(cdRow);

    const progress = document.createElement("div");
    progress.className = "detail__progress" + (isPast ? " is-past" : "");
    const fill = document.createElement("div");
    fill.className = "detail__progress-fill";
    fill.dataset.progressFor = String(test.sno);
    progress.appendChild(fill);
    cdBlock.appendChild(progress);

    header.appendChild(cdBlock);
    wrap.appendChild(header);

    requestAnimationFrame(() => updateProgressFill(test, fill));

    if (test.isFullSyllabus) {
      const note = document.createElement("div");
      note.className = "detail__empty";
      note.textContent = "Full syllabus as per NEET pattern.";
      wrap.appendChild(note);
      targetEl.appendChild(wrap);
      return;
    }

    const tokens = U.tokenize(query);
    for (const key of C.SUBJECT_ORDER) {
      const chapters = test.subjects[key] || [];
      if (!chapters.length) continue;

      const section = document.createElement("section");
      section.className = "detail__section";

      const title = document.createElement("h3");
      title.className = "detail__section-title";

      const heading = document.createElement("span");
      heading.className = "detail__section-heading";

      const pill = document.createElement("span");
      pill.className = "chip " + (C.SUBJECT_CLASS[key] || "chip--muted");
      pill.textContent = C.SUBJECT_LABEL[key];
      heading.appendChild(pill);

      const count = document.createElement("span");
      count.className = "detail__count";
      count.textContent = String(chapters.length) + " chapters";
      heading.appendChild(count);

      title.appendChild(heading);
      section.appendChild(title);

      const box = document.createElement("div");
      box.className = "detail__chapters";

      for (const raw of chapters) {
        const item = document.createElement("div");
        item.className = "detail__chapter";

        const isMatch =
          tokens.length > 0 &&
          tokens.every((t) => raw.toLowerCase().includes(t));
        if (isMatch) item.classList.add("is-match");

        const text = document.createElement("div");
        text.className = "detail__chapter-text";
        text.innerHTML = U.highlight(U.cleanChapter(raw), tokens);
        item.appendChild(text);

        if (U.isFullChapter(raw)) {
          const tag = document.createElement("span");
          tag.className = "chip chip--muted";
          tag.textContent = "Full chapter";
          item.appendChild(tag);
        }
        box.appendChild(item);
      }
      section.appendChild(box);
      wrap.appendChild(section);
    }

    if (!wrap.querySelector(".detail__section")) {
      const empty = document.createElement("div");
      empty.className = "detail__empty";
      empty.textContent = C.STRINGS.noChapters;
      wrap.appendChild(empty);
    }


        // QR block — hidden on screen (see components.css), shown in print.
    // Encodes the deep-link URL for this specific test so a student
    // can scan the printed page and land on the exact test in the app.
    // Uses a bundled encoder (js/qr.js) — no network, no dead API.
    const qr = document.createElement("div");
    qr.className = "detail__qr";

    const deepUrl =
      window.location.origin +
      window.location.pathname +
      "#" + encodeURIComponent(test.name);

    const qrCanvas = document.createElement("canvas");
    qrCanvas.className = "detail__qr-canvas";
    qrCanvas.setAttribute("aria-label", "QR code linking to this test in Speedesk");
    qr.appendChild(qrCanvas);

    try {
      global.TP.qr.renderToCanvas(deepUrl, qrCanvas, { size: 180, margin: 2 });
    } catch (err) {
      // URL too long for the bundled encoder (unlikely for our URLs).
      // Fall back to a plain text note instead of a broken image.
      console.warn("[Speedesk] QR render failed:", err);
      const fallback = document.createElement("div");
      fallback.className = "detail__qr-fallback";
      fallback.textContent = deepUrl;
      qr.appendChild(fallback);
    }

    const qrText = document.createElement("div");
    qrText.className = "detail__qr-text";
    qrText.innerHTML =
      "<strong>Scan to open in Speedesk</strong>" +
      "Point your camera at the code to open this test in the planner.";
    qr.appendChild(qrText);

    wrap.appendChild(qr);
    targetEl.appendChild(wrap);
  }

  function updateProgressFill(test, fillEl) {
    if (!test || !test._date) { fillEl.style.width = "0%"; return; }
    const now = new Date();
    const target = new Date(
      test._date.getFullYear(), test._date.getMonth(), test._date.getDate(),
      0, 0, 0, 0
    );
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) { fillEl.style.width = "100%"; return; }
    const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const clamped = Math.min(diff, WINDOW_MS);
    const pct = 100 * (1 - clamped / WINDOW_MS);
    fillEl.style.width = Math.max(2, pct).toFixed(2) + "%";
  }

  /* =========================================================
   *  Hero + stats
   * ========================================================= */
  function renderHero(targetTest, isPastOverride, stats) {
    const hero = el("hero-tile");
    if (!targetTest) {
      hero.hidden = true;
      return;
    }
    hero.hidden = false;
    hero.dataset.sno = String(targetTest.sno);

    const key = C.tileKeyFor(targetTest);
    hero.dataset.tile = key;

    el("hero-name").textContent = targetTest.name;

    const now = new Date();
    const parts = Time.countdownParts(targetTest._date, now);
    const label = isPastOverride
      ? "Past"
      : Time.formatCountdownLong(parts);
    el("hero-countdown").textContent = label;

    // Mobile-only eyebrow extra: "8 / 31 done".
    // Hidden on desktop via CSS; filled here so mobile sees the stat
    // without needing the three-tile stat row.
    const extra = el("hero-done-extra");
    if (extra) {
      if (stats && stats.done != null && stats.total) {
        extra.textContent = `${stats.done} / ${stats.total} done`;
        extra.hidden = false;
      } else {
        extra.textContent = "";
        extra.hidden = true;
      }
    }

    const fill = el("hero-bar-fill");
    updateProgressFill(targetTest, fill);
  }

  function renderStats(timeCtx, tests) {
    const nextTile = el("stat-next");
    const timeTile = el("stat-time");
    const doneTile = el("stat-done");

    const next = timeCtx.activeTest || timeCtx.nextTest || null;
    if (next) {
      const key = C.tileKeyFor(next);
      nextTile.dataset.tile = key === "none" ? "none" : key;
      el("stat-next-value").textContent = next.name;
      timeTile.dataset.tile = key === "none" ? "none" : key;

      const now = new Date();
      const parts = Time.countdownParts(next._date, now);
      el("stat-time-value").textContent = Time.formatCountdownLong(parts);
    } else {
      nextTile.dataset.tile = "none";
      timeTile.dataset.tile = "none";
      el("stat-next-value").textContent = "—";
      el("stat-time-value").textContent = "—";
    }

    const today = timeCtx.today;
    let done = 0;
    for (const t of tests) {
      if (!t._date) continue;
      if (U.daysBetween(today, t._date) < 0) done++;
    }
    doneTile.dataset.tile = "none";
    el("stat-done-value").textContent = `${done} / ${tests.length}`;
  }

  function tickCountdowns(tests) {
    const bySno = {};
    for (const t of tests) bySno[t.sno] = t;
    const now = new Date();

    const cdNodes = document.querySelectorAll("[data-countdown-for]");
    for (const node of cdNodes) {
      const sno = Number(node.dataset.countdownFor);
      const test = bySno[sno];
      if (!test || !test._date) continue;
      const parts = Time.countdownParts(test._date, now);
      node.textContent = parts.isPast
        ? "0 Days • 00h • 00m • 00s"
        : Time.formatCountdownLong(parts);
    }

    const progNodes = document.querySelectorAll("[data-progress-for]");
    for (const node of progNodes) {
      const sno = Number(node.dataset.progressFor);
      const test = bySno[sno];
      if (!test) continue;
      updateProgressFill(test, node);
    }

    // Hero + stat tiles also tick every second
    const state = global.TP.data.getState();
    if (state.loaded) {
      const next =
        (global.TP.time.buildContext(state.tests).activeTest) ||
        (global.TP.time.buildContext(state.tests).nextTest) ||
        null;
      if (next) {
        const nextParts = Time.countdownParts(next._date, now);
        el("hero-countdown").textContent = Time.formatCountdownLong(nextParts);
        el("stat-time-value").textContent = Time.formatCountdownLong(nextParts);
      }
    }
  }

  /* =========================================================
   *  Empty / loading / header
   * ========================================================= */
  function showSkeleton(show) {
    el("skeleton").hidden = !show;
    el("list").hidden = show;
    if (show) el("empty-state").hidden = true;
  }

  function setHeaderDate(label, batchShort) {
    // label is "Today · Sun, 25 Oct 2026" — split out the day word.
    // If for any reason the label doesn't match, treat it as the whole
    // date text so nothing breaks.
    let dayWord = "Today";
    let dateText = label;
    const m = String(label || "").match(/^([^·]+?)\s*·\s*(.+)$/);
    if (m) {
      dayWord = m[1].trim();
      dateText = m[2].trim();
    }

    const dateWrap = el("header-date");
    dateWrap.innerHTML = "";

    const pill = document.createElement("span");
    pill.className = "app-header__day-pill";
    pill.textContent = dayWord;
    dateWrap.appendChild(pill);

    const dateEl = document.createElement("span");
    dateEl.className = "app-header__date-text";
    dateEl.textContent = dateText;
    dateWrap.appendChild(dateEl);

    const batchEl = el("header-batch");
    if (batchEl) {
      batchEl.textContent = batchShort || "";
    }
  }

  global.TP = global.TP || {};
  global.TP.render = {
    renderList,
    renderDetail,
    renderHero,
    renderStats,
    tickCountdowns,
    showSkeleton,
    setHeaderDate,
  };
})(window);