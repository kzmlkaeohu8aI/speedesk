/* test-planner/js/data.js */
(function (global) {
  "use strict";

  const C = global.TP.config;
  const U = global.TP.utils;

  const state = {
    loaded: false,
    loading: false,
    error: null,
    tests: [],
    bySno: {},
    order: [],
  };

  // Single in-flight promise so every caller awaits the SAME fetch.
  let inflight = null;

  function normalize(raw, index) {
    const sno = Number(raw["S.No."]) || index + 1;
    const name = String(raw["Test Name"] || "").trim();
    const type = String(raw["Test Type"] || "").trim();
    const pattern = String(raw["Test Pattern"] || "").trim();
    const batch = String(raw["Batch Name"] || "").trim();
    const dateStr = String(raw["Date"] || "").trim();
    const date = U.parseDate(dateStr);

    const subjects = {};
    for (const key of C.SUBJECT_ORDER) {
      const arr = Array.isArray(raw[key]) ? raw[key] : [];
      subjects[key] = arr
        .map((s) => String(s || "").trim())
        .filter(Boolean);
    }

    const allChapters = [];
    for (const key of C.SUBJECT_ORDER) {
      for (const ch of subjects[key]) {
        allChapters.push({ subject: key, chapter: ch });
      }
    }

    return {
      sno,
      name,
      type,
      pattern,
      batch,
      dateStr,
      _date: date,
      subjects,
      allChapters,
      isFullSyllabus: Object.values(subjects).some((arr) =>
        arr.some((ch) => U.isFullSyllabus(ch))
      ),
    };
  }

  /** Fetch + validate + normalize. Always returns a Promise<state>. */
  function load() {
    if (inflight) return inflight;
    if (state.loaded) return Promise.resolve(state);

    inflight = (async () => {
      state.loading = true;
      state.error = null;

      try {
        const res = await fetch(C.DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const raw = await res.json();
        if (!Array.isArray(raw)) throw new Error("Invalid data shape");

        const tests = raw.map(normalize);
        tests.sort((a, b) => {
          const ad = a._date ? a._date.getTime() : Infinity;
          const bd = b._date ? b._date.getTime() : Infinity;
          if (ad !== bd) return ad - bd;
          return a.sno - b.sno;
        });

        state.tests = tests;
        state.bySno = tests.reduce((acc, t) => {
          acc[t.sno] = t;
          return acc;
        }, {});
        state.order = tests.map((t) => t.sno);
        state.loaded = true;
        state.error = null;
      } catch (err) {
        state.loaded = false;
        state.error = err;
      } finally {
        state.loading = false;
        inflight = null;
      }

      return state;
    })();

    return inflight;
  }

  /** Force a fresh fetch, bypassing both the loaded flag and in-flight cache. */
  function reload() {
    state.loaded = false;
    inflight = null;
    return load();
  }

  function getState() {
    return state;
  }

  global.TP = global.TP || {};
  global.TP.data = { load, reload, getState };
})(window);