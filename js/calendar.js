/* test-planner/js/calendar.js */
(function (global) {
  "use strict";

  function buildICS(opts) {
    const test = opts.test;
    const batch = opts.batch || "";
    const note = opts.note ? String(opts.note) : "";
    const reminderOffset = opts.reminderOffset || "1d";

    const start = new Date(
      test._date.getFullYear(),
      test._date.getMonth(),
      test._date.getDate(),
      9, 0, 0, 0
    );
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const dtstamp = utcStamp(new Date());
    const dtstart = utcStamp(start);
    const dtend = utcStamp(end);

    const summary = (test.name || "Test") + (batch ? " · " + batch : "");

    const descriptionParts = [];
    if (test.type) descriptionParts.push(test.type);
    if (test.pattern && test.pattern !== test.type) descriptionParts.push(test.pattern);
    if (test.dateStr) descriptionParts.push(test.dateStr);
    if (note) {
      descriptionParts.push("");
      descriptionParts.push(note);
    }
    const description = descriptionParts.join(" · ").replace(/· ·/g, "·");

    const trigger = reminderTrigger(reminderOffset);

    const uid = sanitizeUID(test.name) + "-" + start.getTime() + "@speedesk.local";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Speedesk//Test Planner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + dtstamp,
      "DTSTART:" + dtstart,
      "DTEND:" + dtend,
      "SUMMARY:" + fold(summary),
      "DESCRIPTION:" + fold(description),
      "BEGIN:VALARM",
      "TRIGGER:" + trigger,
      "ACTION:DISPLAY",
      "DESCRIPTION:" + fold("Reminder: " + test.name),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return lines.join("\r\n") + "\r\n";
  }

  function reminderTrigger(offset) {
    switch (offset) {
      case "morning": return "PT0M";
      case "3d":      return "-P3D";
      case "1w":      return "-P7D";
      case "1d":
      default:        return "-P1D";
    }
  }

  function utcStamp(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  }

  function sanitizeUID(name) {
    return String(name || "test")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function fold(str) {
    let escaped = String(str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n");

    if (escaped.length <= 75) return escaped;

    let out = "";
    let i = 0;
    while (i < escaped.length) {
      const chunk = escaped.slice(i, i + 75);
      out += (i === 0 ? "" : "\r\n ") + chunk;
      i += 75;
    }
    return out;
  }

  function downloadICS(icsString, filename) {
    const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "speedesk-reminder.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function buildFilename(test) {
    const dateStr = test._date ? formatDateShortLocal(test._date) : "";
    const name = String(test.name || "Test").trim();
    return dateStr ? name + " — " + dateStr : name;
  }

  function formatDateShortLocal(d) {
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return `${wd}, ${d.getDate()} ${mo} ${d.getFullYear()}`;
  }

  function downloadForTest(test, batchName) {
    const ics = buildICS({ test, batch: batchName });
    downloadICS(ics, buildFilename(test) + ".ics");
  }

  global.TP = global.TP || {};
  global.TP.calendar = {
    buildICS,
    downloadICS,
    downloadForTest,
    buildFilename,
  };
})(window);