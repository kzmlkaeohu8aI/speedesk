/* test-planner/js/config.js */
(function (global) {
  "use strict";

  const DATA_URL = "./test-planner-pw-26-27.json";

  const APP_NAME = "Speedesk";
  const BATCH_NAME = "Yakeen NEET 2.0 2027";
  const BATCH_SHORT = "Yakeen NEET 2.0 · 2027";

  const TICK_MS = 1000;

  // Theme persistence
  const THEME_STORAGE_KEY = "speedesk-theme";
  const THEMES = ["light", "dark", "system"];
  const DEFAULT_THEME = "system";

  const SUBJECTS = [
    { key: "Physics", label: "Physics" },
    { key: "Physics (Saleem Sir)", label: "Physics (Saleem Sir)" },
    { key: "Chemistry", label: "Chemistry" },
    { key: "Botany", label: "Botany" },
    { key: "Zoology", label: "Zoology" },
  ];

  const SUBJECT_ORDER = SUBJECTS.map((s) => s.key);

  const SUBJECT_LABEL = SUBJECTS.reduce((acc, s) => {
    acc[s.key] = s.label;
    return acc;
  }, {});

  const SUBJECT_CLASS = {
    "Physics": "chip--subject-physics",
    "Physics (Saleem Sir)": "chip--subject-physics-saleem",
    "Chemistry": "chip--subject-chemistry",
    "Botany": "chip--subject-botany",
    "Zoology": "chip--subject-zoology",
  };

  function tileKeyFor(test) {
    const t = (test.type || "").toLowerCase();
    if (t === "part test") return "part";
    if (t === "full test") return "full";
    if (t === "rank booster test") return "rbt";
    if ((test.name || "").toUpperCase().startsWith("AITS")) return "aits";
    return "none";
  }

  const FULL_CHAPTER_SUFFIX = "(Complete Chapter)";
  const FULL_SYLLABUS_MARKER = "Full Syllabus";

  const Z = {
    dropdown: 100,
    sticky: 200,
    overlay: 900,
    drawer: 1000,
    snackbar: 1100,
  };

  const STRINGS = {
    appName: APP_NAME,
    batchName: BATCH_NAME,
    batchShort: BATCH_SHORT,
    title: "Test Planner",
    searchPlaceholder: "Search test or chapter…",
    emptyNoMatch: "No tests match.",
    emptyUpcoming: "No upcoming tests.",
    clearFilters: "Clear filters",
    loadError: "Couldn't load the test list.",
    retry: "Retry",
    filterAll: "All",
    noChapters: "No chapters listed.",
    scopeUpcoming: "Upcoming",
    scopeAll: "All",
    scopeLabel: "Show",
    countdownLabel: "Time left",
    countdownPast: "Past",
    pastLabel: "Past",
    openNextAria: "Open next test details",
    heroEyebrow: "Coming up",
    statNextLabel: "Next test",
    statTimeLabel: "Time left",
    statDoneLabel: "Done",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    themeSystem: "System theme",
  };

  global.TP = global.TP || {};
  global.TP.config = {
    DATA_URL,
    APP_NAME,
    BATCH_NAME,
    BATCH_SHORT,
    TICK_MS,
    THEME_STORAGE_KEY,
    THEMES,
    DEFAULT_THEME,
    SUBJECTS,
    SUBJECT_ORDER,
    SUBJECT_LABEL,
    SUBJECT_CLASS,
    tileKeyFor,
    FULL_CHAPTER_SUFFIX,
    FULL_SYLLABUS_MARKER,
    Z,
    STRINGS,
  };
})(window);