/* test-planner/js/filters.js */
(function (global) {
  "use strict";

  const C = global.TP.config;
  const U = global.TP.utils;

  /**
   * Filter state. Subject filter removed — every test has every subject,
   * so it was a no-op. Simpler is honest.
   */
  const defaults = () => ({
    query: "",
    type: "all",
    scope: "upcoming",
  });

  const state = defaults();

  function set(patch) {
    Object.assign(state, patch);
    return state;
  }
  function reset() {
    Object.assign(state, defaults());
    return state;
  }
  function isDefault() {
    const d = defaults();
    return (
      state.query === d.query &&
      state.type === d.type &&
      state.scope === d.scope
    );
  }

  /** Distinct Test Type values, sorted. */
  function typeOptions(tests) {
    const set = new Set();
    for (const t of tests) if (t.type) set.add(t.type);
    return Array.from(set).sort();
  }

  /**
   * Apply filters. Returns { grouped } via groupResults below.
   * Order: scope → type → query (name or any chapter).
   */
  function apply(tests, timeCtx) {
    const tokens = U.tokenize(state.query);
    const today = timeCtx ? timeCtx.today : U.todayMidnight();

    let pool = tests;

    if (state.scope === "upcoming") {
      pool = pool.filter((t) => {
        if (!t._date) return false;
        const rel = U.relativeDay(t._date, today);
        return rel.diffDays >= 0;
      });
    }

    if (state.type !== "all") {
      pool = pool.filter((t) => t.type === state.type);
    }

    if (tokens.length === 0) {
      return pool.map((test) => ({ test }));
    }

    const results = [];
    for (const test of pool) {
      const nameLc = test.name.toLowerCase();
      const nameMatch = tokens.every((tok) => nameLc.includes(tok));

      const matched = [];
      for (const entry of test.allChapters) {
        const chLc = entry.chapter.toLowerCase();
        if (tokens.every((tok) => chLc.includes(tok))) matched.push(entry);
      }

      if (!nameMatch && matched.length === 0) continue;

      results.push({
        test,
        matchedChapters: matched.length ? matched : null,
        nameMatch,
      });
    }
    return results;
  }

  function groupResults(results, tokens) {
    if (!tokens || tokens.length === 0) {
      return {
        grouped: false,
        all: results.map((r) => r.test),
        byName: [],
        byChapter: [],
      };
    }
    const byName = [];
    const byChapter = [];
    for (const r of results) {
      if (r.nameMatch) byName.push(r);
      else byChapter.push(r);
    }
    return { grouped: true, all: [], byName, byChapter };
  }

  function typeLabel() {
    return state.type === "all" ? C.STRINGS.filterAll : state.type;
  }

  global.TP = global.TP || {};
  global.TP.filters = {
    state,
    set,
    reset,
    isDefault,
    typeOptions,
    apply,
    groupResults,
    typeLabel,
  };
})(window);