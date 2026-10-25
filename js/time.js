/* test-planner/js/time.js */
(function (global) {
  "use strict";

  const U = global.TP.utils;

  /* =========================================================
   *  Relative labels (existing behavior)
   * ========================================================= */
  function buildContext(tests) {
    const today = U.todayMidnight();
    const bySno = {};
    let nextTest = null;
    let activeTest = null;
    let allPast = true;

    for (const t of tests) {
      if (!t._date) continue;
      const rel = U.relativeDay(t._date, today);
      bySno[t.sno] = { rel, _date: t._date };
      if (rel.diffDays >= 0) allPast = false;
      if (rel.isToday && !activeTest) activeTest = t;
      if (rel.diffDays > 0 && !nextTest) nextTest = t;
    }

    return { today, nextTest, activeTest, allPast, bySno };
  }

  function headerLabel(today) {
    const t = today || U.todayMidnight();
    return "Today · " + U.formatDateShort(t);
  }

  function statusMessage(ctx) {
    if (!ctx) return null;
    if (ctx.activeTest) {
      return { text: `${ctx.activeTest.name} is today.`, kind: "today" };
    }
    if (ctx.nextTest) {
      const rel = ctx.bySno[ctx.nextTest.sno].rel;
      return { text: `Next: ${ctx.nextTest.name} · ${rel.label}`, kind: "next" };
    }
    if (ctx.allPast) {
      return { text: "No upcoming tests. Showing full archive.", kind: "archive" };
    }
    return null;
  }

  function relLabelFor(ctx, sno) {
    if (!ctx || !ctx.bySno[sno]) return "";
    return ctx.bySno[sno].rel.label;
  }

  /* =========================================================
   *  Live countdown — fixed-unit math (no calendar-month edge cases)
   *
   *  Counts down from NOW to the test's DATE AT 00:00 LOCAL.
   *  Target = local midnight of the test day.
   *  "Test is today" → the ticker shows time until local midnight of
   *  today (i.e. how much of today is left). That matches user
   *  expectation of "how long until the test" — the test happens
   *  during today, so once we hit 00:00 the day has arrived.
   * ========================================================= */
  function countdownParts(targetDate, now) {
    if (!targetDate) {
      return { d: 0, h: 0, m: 0, s: 0, totalMs: 0, isPast: true };
    }
    const n = now || new Date();
    const target = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0, 0, 0, 0
    );
    const diff = target.getTime() - n.getTime();
    const isPast = diff <= 0;
    const abs = Math.abs(diff);

    const totalSec = Math.floor(abs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    return { d, h, m, s, totalMs: diff, isPast };
  }

  /** "DDd HH:MM:SS" — legacy, kept for any existing callers. */
  function formatCountdown(parts) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${parts.d}d ${pad(parts.h)}:${pad(parts.m)}:${pad(parts.s)}`;
  }

  /**
   * Human-readable countdown: "149 Days • 04h • 52m • 27s"
   *
   * Rules:
   *   - Always show days (even "0 Days") so the layout doesn't jump.
   *   - Show all four units always — no collapsing — because the student
   *     is looking for the biggest number (days) first, and hiding the
   *     small ones makes it feel like a stopwatch.
   *   - Singular/plural for days only ("1 Day" vs "149 Days"); hours,
   *     minutes, seconds are always "04h" style — a 1-hour wait is rare
   *     enough that "01h" doesn't look strange.
   *   - Zero-padded hours/minutes/seconds so the width stays stable.
   */
  function formatCountdownLong(parts) {
    if (!parts || parts.isPast) {
      // Past or immediately-past: just show the terminal state.
      return "0 Days • 00h • 00m • 00s";
    }
    const pad = (n) => String(n).padStart(2, "0");
    const d = parts.d;
    const dayLabel = d === 1 ? "Day" : "Days";
    return (
      d + " " + dayLabel +
      " • " + pad(parts.h) + "h" +
      " • " + pad(parts.m) + "m" +
      " • " + pad(parts.s) + "s"
    );
  }

  /**
   * Human hint from today-midnight to target-midnight.
   * "in 24 days" / "in ~3 weeks" / "Today" / "Past"
   */
  function formatHumanHint(targetDate, today) {
    if (!targetDate) return "";
    const t = today || U.todayMidnight();
    const diff = U.daysBetween(t, targetDate);
    if (diff === 0) return "Today";
    if (diff < 0) return "Past";
    if (diff === 1) return "Tomorrow";
    if (diff < 14) return `in ${diff} days`;
    const weeks = Math.round(diff / 7);
    return weeks === 1 ? "in ~1 week" : `in ~${weeks} weeks`;
  }

  /** True if target is within the next 24 hours (for subtle emphasis). */
  function isWithinDay(targetDate, now) {
    if (!targetDate) return false;
    const n = now || new Date();
    const target = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0, 0, 0, 0
    );
    const diff = target.getTime() - n.getTime();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }

  global.TP = global.TP || {};
  global.TP.time = {
    buildContext,
    headerLabel,
    statusMessage,
    relLabelFor,
    countdownParts,
    formatCountdown,
    formatCountdownLong,
    formatHumanHint,
    isWithinDay,
  };
})(window);