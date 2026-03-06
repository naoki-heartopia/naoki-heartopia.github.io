#!/usr/bin/env node
import fs from "node:fs";

const RECORDS_FILE = "./records.json";
const SCHEDULE_FILE = "./records-schedule.json";
const HISTORY_FILE = "./records-schedule-history.json";
const DAYS_TO_PREPARE = 30;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function toJstTodayUtcMs() {
  const now = new Date();
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();
  return Date.UTC(y, m, d);
}

function formatYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildSlots(baseUtcMs) {
  const slots = [];
  for (let i = 0; i < DAYS_TO_PREPARE; i += 1) {
    const date = new Date(baseUtcMs + i * DAY_MS);
    const ymd = formatYmd(date);
    const day = date.getUTCDay();
    const isHoliday = day === 0 || day === 6;

    if (isHoliday) {
      slots.push({ date: ymd, time: "11:00-15:00" });
      slots.push({ date: ymd, time: "18:00-22:00" });
    } else {
      slots.push({ date: ymd, time: "20:00-24:00" });
    }
  }
  return slots;
}

function timeSortValue(timeRange) {
  const end = (timeRange?.split("-")[1] || "00:00").trim();
  const [h, m] = end.split(":").map(Number);
  return h * 60 + m;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return timeSortValue(a.time) - timeSortValue(b.time);
  });
}

function normalizeRows(rows) {
  return rows
    .filter((row) => row?.date && row?.time && Number.isInteger(row?.record_id))
    .map((row) => ({
      date: row.date,
      time: row.time,
      record_id: row.record_id,
    }));
}

function withItemNo(rows) {
  return rows.map((row, idx) => ({
    item_no: idx + 1,
    date: row.date,
    time: row.time,
    record_id: row.record_id,
  }));
}

function resolveRecordOrder(records, referenceRows) {
  const candidateRecordIds = records
    .filter((r) => r?.status === "公開" || r?.status === "非公開")
    .map((r) => r.no)
    .filter((no) => Number.isInteger(no));

  const sortedByRecent = [...referenceRows]
    .filter((row) => row?.date && row?.time && Number.isInteger(row?.record_id))
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return timeSortValue(b.time) - timeSortValue(a.time);
    });

  const used = new Set();
  const candidateSet = new Set(candidateRecordIds);
  for (const row of sortedByRecent) {
    if (candidateSet.has(row.record_id)) {
      used.add(row.record_id);
    }
  }

  const remaining = candidateRecordIds.filter((id) => !used.has(id));
  if (remaining.length > 0) {
    return [...remaining, ...candidateRecordIds];
  }
  return candidateRecordIds;
}

function movePastRowsToHistory(oldSchedule, oldHistory, processingDate) {
  const pastRows = oldSchedule.filter((row) => row?.date && row.date < processingDate);
  const combined = normalizeRows([...oldHistory, ...pastRows]);

  const deduped = [];
  const seen = new Set();
  for (const row of combined) {
    const key = `${row.date}|${row.time}|${row.record_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return withItemNo(sortRows(deduped));
}

function buildMergedSchedule(oldSchedule, slots, recordOrder, processingDate) {
  const existingFutureRows = normalizeRows(
    oldSchedule.filter((row) => row?.date && row.date >= processingDate),
  );

  const existingBySlot = new Map();
  for (const row of existingFutureRows) {
    const key = `${row.date}|${row.time}`;
    if (!existingBySlot.has(key)) {
      existingBySlot.set(key, row);
    }
  }

  const missingRows = [];
  let assignIndex = 0;
  for (const slot of slots) {
    const key = `${slot.date}|${slot.time}`;
    if (existingBySlot.has(key)) continue;

    if (recordOrder.length === 0) break;
    missingRows.push({
      date: slot.date,
      time: slot.time,
      record_id: recordOrder[assignIndex % recordOrder.length],
    });
    assignIndex += 1;
  }

  const mergedRows = sortRows([...existingFutureRows, ...missingRows]);
  return withItemNo(mergedRows);
}

function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main() {
  const records = readJson(RECORDS_FILE, []);
  const oldSchedule = readJson(SCHEDULE_FILE, []);
  const oldHistory = readJson(HISTORY_FILE, []);

  const baseUtcMs = toJstTodayUtcMs();
  const processingDate = formatYmd(new Date(baseUtcMs));
  const slots = buildSlots(baseUtcMs);
  const newHistory = movePastRowsToHistory(oldSchedule, oldHistory, processingDate);

  const referenceRows = [...normalizeRows(oldSchedule), ...normalizeRows(newHistory)];
  const order = resolveRecordOrder(records, referenceRows);
  const newSchedule = buildMergedSchedule(oldSchedule, slots, order, processingDate);

  writeJson(SCHEDULE_FILE, newSchedule);
  writeJson(HISTORY_FILE, newHistory);

  console.log(`Updated ${SCHEDULE_FILE} with ${newSchedule.length} rows.`);
  console.log(`Updated ${HISTORY_FILE} with ${newHistory.length} rows.`);
}

main();
