/* test-planner/js/reminder-modal.js
 *
 * Reminder preview dialog. Opens from:
 *   - main app drawer's calendar button
 *   - calendar page's "Remind" hover button
 *   - calendar page's "Set reminder" day-panel button
 *
 * Flow: student sees what will be created, can edit the note and pick
 * a reminder offset, then downloads the .ics.
 *
 * Constraints:
 *   - Title fixed (test name + batch). Not editable.
 *   - Note max 200 chars. Sanitized: HTML tags stripped, whitespace
 *     trimmed, newlines preserved.
 *   - Only one modal at a time; focus-trapped; Esc/click-outside close.
 */
(function (global) {
  "use strict";

  const C = global.TP.config;

  const REMINDER_OPTIONS = [
    { value: "morning", label: "Morning of (9:00 AM)" },
    { value: "1d",      label: "1 day before (9:00 AM)" },
    { value: "3d",      label: "3 days before (9:00 AM)" },
    { value: "1w",      label: "1 week before (9:00 AM)" },
  ];

  const NOTE_MAX = 200;

  let activeTest = null;
  let selectedOffset = "1d";
  let lastFocused = null;
  let open = false;

  // ---------- public API ----------
  function openReminderPreview(test) {
    if (!test) return;

    activeTest = test;
    selectedOffset = "1d";
    lastFocused = document.activeElement;

    const modal = document.getElementById("reminder-modal");
    const scrim = document.getElementById("reminder-scrim");
    if (!modal || !scrim) {
      console.warn("[Speedesk] reminder modal markup not present");
      return;
    }

    // Populate read-only test line
    const testLine = document.getElementById("reminder-test-line");
    testLine.textContent =
      test.name + " · " +
      (test.dateStr || "").replace(/^[A-Za-z]+,\s*/, "");

    // Reset note field
    const note = document.getElementById("reminder-note");
    note.value = "";
    updateNoteCounter();

    // Render offset buttons
    renderOffsets();

    // Show modal
    scrim.hidden = false;
    modal.hidden = false;
    void modal.offsetWidth;
    scrim.classList.add("is-open");
    modal.classList.add("is-open");

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey, true);

    setTimeout(() => note.focus(), 80);
    open = true;
  }

  function close() {
    if (!open) return;
    open = false;

    const modal = document.getElementById("reminder-modal");
    const scrim = document.getElementById("reminder-scrim");
    if (modal) modal.classList.remove("is-open");
    if (scrim) scrim.classList.remove("is-open");

    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey, true);

    setTimeout(() => {
      if (!open) {
        if (modal) modal.hidden = true;
        if (scrim) scrim.hidden = true;
      }
    }, 220);

    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
    activeTest = null;
  }

  function confirm() {
    if (!activeTest) return;

    if (!global.TP || !global.TP.calendar || typeof global.TP.calendar.buildICS !== "function") {
      console.error("[Speedesk] calendar.js not loaded — cannot build .ics");
      showSnackbar("Couldn't create the reminder. Try reloading the page.");
      return;
    }

    const rawNote = document.getElementById("reminder-note").value;
    const note = sanitizeNote(rawNote);

    try {
      const ics = global.TP.calendar.buildICS({
        test: activeTest,
        batch: C.BATCH_NAME,
        note: note,
        reminderOffset: selectedOffset,
      });
      const filename = global.TP.calendar.buildFilename(activeTest) + ".ics";
      global.TP.calendar.downloadICS(ics, filename);
      close();
    } catch (err) {
      console.error("[Speedesk] reminder build failed:", err);
      showSnackbar("Couldn't create the reminder file.");
    }
  }

  // ---------- internals ----------
  function renderOffsets() {
    const wrap = document.getElementById("reminder-offsets");
    wrap.innerHTML = "";
    for (const opt of REMINDER_OPTIONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "reminder-offset-btn";
      if (opt.value === selectedOffset) btn.classList.add("is-active");
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.addEventListener("click", () => {
        selectedOffset = opt.value;
        for (const b of wrap.querySelectorAll(".reminder-offset-btn")) {
          b.classList.toggle("is-active", b.dataset.value === selectedOffset);
        }
      });
      wrap.appendChild(btn);
    }
  }

  function updateNoteCounter() {
    const note = document.getElementById("reminder-note");
    const counter = document.getElementById("reminder-counter");
    if (!note || !counter) return;
    const sanitized = sanitizeNote(note.value);
    counter.textContent = sanitized.length + " / " + NOTE_MAX;
    counter.classList.toggle("is-over", sanitized.length > NOTE_MAX);
  }

  /**
   * Sanitize the note field:
   *  - strip any < or > characters (defense against accidental HTML paste)
   *  - strip control characters except \n
   *  - collapse 3+ consecutive newlines to 2
   *  - trim leading/trailing whitespace
   *  - cap at NOTE_MAX
   * The .ics field itself will additionally be escaped for \\ ; , and
   * newlines by calendar.js's fold() function.
   */
  function sanitizeNote(raw) {
    if (!raw) return "";
    let s = String(raw);
    s = s.replace(/[<>]/g, "");
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    s = s.replace(/\n{3,}/g, "\n\n");
    s = s.replace(/[ \t]+/g, " ");
    s = s.trim();
    if (s.length > NOTE_MAX) s = s.slice(0, NOTE_MAX);
    return s;
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      const modal = document.getElementById("reminder-modal");
      const focusables = modal.querySelectorAll(
        'button, textarea, input, [tabindex]:not([tabindex="-1"])'
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

  function showSnackbar(message) {
    const bar = document.getElementById("snackbar");
    if (!bar) return;
    const text = document.getElementById("snackbar-text");
    if (text) text.textContent = message;
    bar.hidden = false;
    void bar.offsetWidth;
    bar.classList.add("is-open");
    setTimeout(() => bar.classList.remove("is-open"), 4000);
  }

  // ---------- wire-up (called once per page) ----------
  function init() {
    const modal = document.getElementById("reminder-modal");
    const scrim = document.getElementById("reminder-scrim");
    if (!modal || !scrim) return;

    document.getElementById("reminder-cancel").addEventListener("click", close);
    document.getElementById("reminder-confirm").addEventListener("click", confirm);
    scrim.addEventListener("click", close);

    // Optional close-X in the modal header — only wired if present
    const closeX = document.getElementById("reminder-cancel-x");
    if (closeX) closeX.addEventListener("click", close);

    const note = document.getElementById("reminder-note");
    note.addEventListener("input", updateNoteCounter);
    note.addEventListener("paste", () => {
      setTimeout(() => {
        const sanitized = sanitizeNote(note.value);
        if (sanitized.length !== note.value.length) {
          note.value = sanitized;
        }
        updateNoteCounter();
      }, 0);
    });
  }

  global.TP = global.TP || {};
  global.TP.reminderModal = {
    init,
    open: openReminderPreview,
    close,
  };
})(window);