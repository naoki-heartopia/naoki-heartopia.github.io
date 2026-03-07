(function(){
  const { escapeHtml, pastelForCategory, statusBadge } = window.NaokiUI;

  function parseScheduleStart(dateText, timeText){
    const date = (dateText || "").trim();
    if (!date) return null;
    const start = (timeText || "").split("-")[0]?.trim() || "00:00";
    const normalized = /^\d{1,2}:\d{2}$/.test(start) ? start : "00:00";
    const dt = new Date(`${date}T${normalized}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatScheduleDate(dt){
    const y = dt.getFullYear();
    const m = `${dt.getMonth() + 1}`.padStart(2, "0");
    const d = `${dt.getDate()}`.padStart(2, "0");
    const h = `${dt.getHours()}`.padStart(2, "0");
    const mi = `${dt.getMinutes()}`.padStart(2, "0");
    return `${y}/${m}/${d} ${h}:${mi}`;
  }

  async function main(){
    const detailRoot = document.getElementById("detailRoot");
    const recordId = Number(new URLSearchParams(window.location.search).get("record"));
    if (!Number.isInteger(recordId) || recordId <= 0){
      detailRoot.innerHTML = `<p class="muted">レコードIDが指定されていません。</p>`;
      return;
    }

    const [songsRes, scheduleRes] = await Promise.all([
      fetch("./records.json"),
      fetch("./records-schedule.json")
    ]);
    if (!songsRes.ok || !scheduleRes.ok){
      detailRoot.innerHTML = `<p class="muted">データの読み込みに失敗しました。</p>`;
      return;
    }

    const songs = await songsRes.json();
    const scheduleItems = await scheduleRes.json();
    const song = (Array.isArray(songs) ? songs : []).find(s => Number(s.no) === recordId);

    if (!song){
      detailRoot.innerHTML = `<p class="muted">対象のレコードが見つかりません。</p>`;
      return;
    }

    const next = (Array.isArray(scheduleItems) ? scheduleItems : [])
      .filter(item => Number(item.record_id) === recordId)
      .map(item => parseScheduleStart(item.date, item.time))
      .filter(Boolean)
      .sort((a,b) => a.getTime() - b.getTime());
    const nextLabel = next.length ? formatScheduleDate(next[0]) : "公開日時未定";

    const categoryHtml = song.category
      ? (() => {
          const p = pastelForCategory(song.category);
          return `<span class="chip" style="background:${p.bg};border-color:${p.border};color:${p.text}">${escapeHtml(song.category)}</span>`;
        })()
      : `<span class="chip">分類なし</span>`;

    detailRoot.innerHTML = `
      <div class="detailPanel">
        <div><img class="detailImage" src="./${escapeHtml(song.image_file || "images/records/record-label-default.svg")}" alt="${escapeHtml(song.jp || song.title || "レコード")}" /></div>
        <div>
          <h1>${escapeHtml(song.jp || song.title || "-")}</h1>
          <div class="muted">${escapeHtml(song.title || "-")}</div>
          <div class="meta">${statusBadge(song.status)}${categoryHtml}</div>
          <p class="desc">${escapeHtml(song.description || "説明はありません。")}</p>
          <div class="schedule"><strong>次回の公開予定日時:</strong> ${escapeHtml(nextLabel)}</div>
        </div>
      </div>
    `;
  }

  main().catch(() => {
    const detailRoot = document.getElementById("detailRoot");
    detailRoot.innerHTML = `<p class="muted">予期せぬエラーが発生しました。</p>`;
  });
})();
