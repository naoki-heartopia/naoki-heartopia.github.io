(function(){
  const { escapeHtml, pastelForCategory, statusBadge, iconPathForTime, slotThemeClass } = window.NaokiUI;

  function slotLabel(date, time){
    const dt = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return `${date} ${time}`;
    const week = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    return `${y}-${m}-${d} (${week}) ${time}`;
  }

  function recordCard(record){
    const categoryHtml = record.category
      ? (() => {
          const p = pastelForCategory(record.category);
          return `<span class="chip" style="background:${p.bg};border-color:${p.border};color:${p.text}">${escapeHtml(record.category)}</span>`;
        })()
      : `<span class="chip">分類なし</span>`;

    return `<article class="slotRecordCard" data-record-id="${Number(record.no)}">
      <img class="slotRecordImage" src="./${escapeHtml(record.image_file || "images/records/record-label-default.svg")}" alt="${escapeHtml(record.jp || record.title || "レコード")}" />
      <div class="slotRecordBody">
        <div class="slotRecordSub">${escapeHtml(record.title || "-")}</div>
        <div class="slotRecordTitle">${escapeHtml(record.jp || "-")}</div>
        <div class="slotRecordMeta">${statusBadge(record.status)}${categoryHtml}</div>
      </div>
    </article>`;
  }

  async function main(){
    const root = document.getElementById("slotDetailRoot");
    const params = new URLSearchParams(window.location.search);
    const date = (params.get("date") || "").trim();
    const time = (params.get("time") || "").trim();

    if (!date || !time){
      root.innerHTML = `<p class="muted">部の情報が不足しています。</p>`;
      return;
    }

    const [songsRes, scheduleRes] = await Promise.all([
      fetch("./records.json"),
      fetch("./records-schedule.json")
    ]);
    if (!songsRes.ok || !scheduleRes.ok){
      root.innerHTML = `<p class="muted">データの読み込みに失敗しました。</p>`;
      return;
    }

    const songs = await songsRes.json();
    const scheduleItems = await scheduleRes.json();

    const songMap = new Map((Array.isArray(songs) ? songs : []).map(s => [Number(s.no), s]));
    const matched = (Array.isArray(scheduleItems) ? scheduleItems : [])
      .filter(item => (item.date || "").trim() === date && (item.time || "").trim() === time)
      .sort((a,b) => Number(a.item_no) - Number(b.item_no));

    const records = matched
      .map(item => songMap.get(Number(item.record_id)))
      .filter(Boolean);

    const iconPath = iconPathForTime(time);
    const slotClass = slotThemeClass(time);
    const iconHtml = iconPath ? `<img class="calendarIcon" src="${iconPath}" alt="" aria-hidden="true">` : "";

    root.innerHTML = `
      <section class="slotHeader ${slotClass}">
        <div class="slotHeaderRow">${iconHtml}<h1>${escapeHtml(slotLabel(date, time))}</h1></div>
      </section>
      <section class="slotRecordsSection">
        <h2>レコード</h2>
        ${records.length ? `<div class="slotRecords">${records.map(recordCard).join("")}</div>` : `<p class="muted">この部に割り当てられたレコードはありません。</p>`}
      </section>
    `;

    const cards = Array.from(document.querySelectorAll(".slotRecordCard[data-record-id]"));
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const id = Number(card.getAttribute("data-record-id"));
        if (!Number.isInteger(id)) return;
        window.location.href = `./detail.html?record=${id}`;
      });
    });
  }

  main().catch(() => {
    const root = document.getElementById("slotDetailRoot");
    root.innerHTML = `<p class="muted">予期せぬエラーが発生しました。</p>`;
  });
})();
