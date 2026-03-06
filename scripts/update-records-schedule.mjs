#!/usr/bin/env node
import fs from "node:fs";

const RECORDS_FILE = "./records.json";
const SCHEDULE_FILE = "./records-schedule.json";
const DAYS_TO_PREPARE = 30;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function toJstToday() {
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

function resolveRecordOrder(records, oldSchedule) {
  const candidateRecordIds = records
    .filter((r) => r?.status === "公開" || r?.status === "非公開")
    .map((r) => r.no)
    .filter((no) => Number.isInteger(no));

  const sortedByRecent = [...oldSchedule]
    .filter((row) => row?.date && row?.time && Number.isInteger(row?.record_id))
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return timeSortValue(b.time) - timeSortValue(a.time);
    });

  const used = new Set();
  for (const row of sortedByRecent) {
    if (candidateRecordIds.includes(row.record_id)) {
      used.add(row.record_id);
    }
  }

  const remaining = candidateRecordIds.filter((id) => !used.has(id));
  if (remaining.length > 0) {
    return [...remaining, ...candidateRecordIds];
  }
  return candidateRecordIds;
}

function buildSchedule(slots, recordOrder) {
  if (recordOrder.length === 0) return [];
  return slots.map((slot, idx) => ({
    item_no: idx + 1,
    date: slot.date,
    time: slot.time,
    record_id: recordOrder[idx % recordOrder.length],
  }));
}

function main() {
  const records = readJson(RECORDS_FILE, []);
  const oldSchedule = readJson(SCHEDULE_FILE, []);

  const baseUtcMs = toJstToday();
  const slots = buildSlots(baseUtcMs);
  const order = resolveRecordOrder(records, oldSchedule);
  const newSchedule = buildSchedule(slots, order);

  fs.writeFileSync(SCHEDULE_FILE, `${JSON.stringify(newSchedule, null, 2)}\n`, "utf8");
  console.log(`Updated ${SCHEDULE_FILE} with ${newSchedule.length} rows.`);
}

main();
