/* test-planner/js/utils.js */
(function (global) {
  "use strict";

  const FULL_CHAPTER_SUFFIX = "(Complete Chapter)";
  const FULL_SYLLABUS_MARKER = "Full Syllabus";

  /** Escape user/content string for safe HTML insertion. */
  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Escape a string for use inside a RegExp. */
  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Parse a human date like "Sunday, July 19, 2026" into a local-midnight Date.
   * Returns null on failure. Uses local time (not UTC) so "today" matches
   * the student's device clock.
   */
  function parseDate(str) {
    if (!str) return null;
    // Strip leading weekday name and comma, keep the rest.
    const cleaned = String(str).replace(/^[A-Za-z]+,\s*/, "").trim();
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /** Format Date as "Sun, 19 Jul 2026". */
  function formatDateShort(d) {
    if (!d) return "";
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const mo = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ][d.getMonth()];
    return `${wd}, ${d.getDate()} ${mo} ${d.getFullYear()}`;
  }

  /** Format Date as "Sunday, 19 July 2026" (full weekday, full month). */
  function formatDateLong(d) {
    if (!d) return "";
    const wd = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday",
    ][d.getDay()];
    const mo = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][d.getMonth()];
    return `${wd}, ${d.getDate()} ${mo} ${d.getFullYear()}`;
  }

  /** Midnight today on the student's device. */
  function todayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /** Whole-day difference between two local-midnight Dates (b - a). */
  function daysBetween(a, b) {
    const MS = 24 * 60 * 60 * 1000;
    return Math.round((b.getTime() - a.getTime()) / MS);
  }

  /**
   * Relative day label from device-today perspective.
   * Returns { label, isToday, isPast, diffDays }
   *   diffDays 0    → "Today"
   *   diffDays 1    → "Tomorrow"
   *   diffDays 2-6  → "in N days"
   *   diffDays 7+   → "in N weeks"
   *   diffDays < 0  → "N days ago" / "N weeks ago"
   */
  function relativeDay(date, today) {
    const t = today || todayMidnight();
    const diff = daysBetween(t, date);
    const isToday = diff === 0;
    const isPast = diff < 0;
    const abs = Math.abs(diff);

    let label;
    if (isToday) {
      label = "Today";
    } else if (diff === 1) {
      label = "Tomorrow";
    } else if (diff === -1) {
      label = "Yesterday";
    } else if (abs < 7) {
      label = isPast ? `${abs} days ago` : `in ${abs} days`;
    } else {
      const weeks = Math.round(abs / 7);
      const w = weeks === 1 ? "week" : "weeks";
      label = isPast ? `${weeks} ${w} ago` : `in ${weeks} ${w}`;
    }
    return { label, isToday, isPast, diffDays: diff };
  }

  /** True if a chapter string is a "Full Syllabus" placeholder. */
  function isFullSyllabus(chapter) {
    return typeof chapter === "string" &&
      chapter.toLowerCase().startsWith(FULL_SYLLABUS_MARKER.toLowerCase());
  }

  /** Strip trailing "(Complete Chapter)" and trim. */
  function cleanChapter(chapter) {
    if (typeof chapter !== "string") return "";
    return chapter.replace(FULL_CHAPTER_SUFFIX, "").replace(/\s+/g, " ").trim();
  }

  /** True if a chapter string ends with "(Complete Chapter)". */
  function isFullChapter(chapter) {
    return typeof chapter === "string" &&
      chapter.indexOf(FULL_CHAPTER_SUFFIX) !== -1;
  }

  /** Debounce a function. */
  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  /** Case-insensitive, whitespace-trimmed query tokenizer. */
  function tokenize(q) {
    return String(q || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Wrap matching substrings of `text` in <mark> for the given tokens.
   * Returns escaped HTML safe to insert via innerHTML.
   */
  function highlight(text, tokens) {
    const safe = escapeHTML(text);
    if (!tokens || tokens.length === 0) return safe;
    const pattern = tokens.map(escapeRegExp).join("|");
    if (!pattern) return safe;
    const re = new RegExp("(" + pattern + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }

  global.TP = global.TP || {};
  global.TP.utils = {
    escapeHTML,
    escapeRegExp,
    parseDate,
    formatDateShort,
    formatDateLong,
    todayMidnight,
    daysBetween,
    relativeDay,
    isFullSyllabus,
    cleanChapter,
    isFullChapter,
    debounce,
    tokenize,
    highlight,
  };
})(window);