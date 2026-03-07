(function(){
  const { escapeHtml, pastelForCategory, statusBadge, iconPathForTime, slotThemeClass, normalize } = window.NaokiUI;

  let songs = [];
  let scheduleItems = [];

  async function loadSongs() {
    const response = await fetch("./records.json");
    if (!response.ok) throw new Error(`曲データの読み込みに失敗しました: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadSchedule() {
    const response = await fetch("./records-schedule.json");
    if (!response.ok) throw new Error(`スケジュールデータの読み込みに失敗しました: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  const els = {
    q: document.getElementById("q"),
    category: document.getElementById("category"),
    status: document.getElementById("status"),
    onlyPublic: document.getElementById("onlyPublic"),
    tbody: document.getElementById("tbody"),
    stats: document.getElementById("stats"),
    mobileList: document.getElementById("mobileList"),
    calendar: document.getElementById("calendar"),
    ths: Array.from(document.querySelectorAll("thead th[data-key]")),
  };

  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];

  function slotUrl(date, time){
    const params = new URLSearchParams({ date, time });
    return `./slot-detail.html?${params.toString()}`;
  }

  function renderCalendar(){
    if (!scheduleItems.length){
      els.calendar.innerHTML = `<div class="calendarEmpty">スケジュールがありません。</div>`;
      return;
    }

    const songMap = new Map(songs.map(s => [Number(s.no), s]));
    const groupedByDate = new Map();
    for (const item of scheduleItems){
      const date = (item.date || "").trim();
      if (!date) continue;
      if (!groupedByDate.has(date)) groupedByDate.set(date, []);
      groupedByDate.get(date).push(item);
    }

    for (const entries of groupedByDate.values()){
      entries.sort((a,b)=> (a.time || "").localeCompare((b.time || ""), "ja"));
    }

    const dates = [...groupedByDate.keys()].sort((a,b)=>a.localeCompare(b));
    const monthKeys = [...new Set(dates.map(date => date.slice(0, 7)))];
    const monthParts = [];

    for (const monthKey of monthKeys){
      const [yearText, monthText] = monthKey.split("-");
      const year = Number(yearText);
      const month = Number(monthText);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);

      const startDate = new Date(monthStart);
      startDate.setDate(monthStart.getDate() - monthStart.getDay());
      const endDate = new Date(monthEnd);
      endDate.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

      const gridParts = weekLabels.map(label => `<div class="calendarLabel">${label}</div>`);
      const current = new Date(startDate);
      while (current <= endDate){
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, "0");
        const d = String(current.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        const entries = groupedByDate.get(iso) || [];
        const outside = current.getMonth() !== (month - 1);

        gridParts.push(`
          <div class="calendarDay ${outside ? "outside" : ""}">
            <div class="calendarDate">${current.getDate()}</div>
            <div class="calendarItems">
              ${entries.length
                ? (() => {
                    const groupedByTime = new Map();
                    for (const entry of entries){
                      const timeKey = (entry.time || "-").trim() || "-";
                      if (!groupedByTime.has(timeKey)) groupedByTime.set(timeKey, []);
                      groupedByTime.get(timeKey).push(entry);
                    }
                    return [...groupedByTime.entries()]
                      .sort((a,b)=>a[0].localeCompare(b[0], "ja"))
                      .map(([time, slotEntries]) => {
                        const songsHtml = slotEntries.map(entry => {
                          const song = songMap.get(Number(entry.record_id));
                          const title = song ? (song.jp || song.title || `ID:${entry.record_id}`) : `ID:${entry.record_id}`;
                          return `<li>${escapeHtml(title)}</li>`;
                        }).join("");
                        const iconPath = iconPathForTime(time);
                        const slotClass = slotThemeClass(time);
                        const icon = iconPath ? `<div class="calendarSlotHead"><img class="calendarIcon" src="${iconPath}" alt="" aria-hidden="true"></div>` : "";
                        return `<a class="calendarItem ${slotClass}" href="${slotUrl(iso, time)}">${icon}<ul class="calendarSongList">${songsHtml}</ul></a>`;
                      })
                      .join("");
                  })()
                : `<div class="calendarEmpty">-</div>`}
            </div>
          </div>
        `);

        current.setDate(current.getDate() + 1);
      }

      monthParts.push(`
        <section class="calendarMonth">
          <div class="calendarMonthHeading">${year}年${month}月</div>
          <div class="calendarGrid">${gridParts.join("")}</div>
        </section>
      `);
    }

    els.calendar.innerHTML = monthParts.join("");
  }

  function buildCategoryOptions(){
    const categories = [...new Set(songs.map(s => (s.category || "").trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,"ja"));
    for (const c of categories){
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      els.category.appendChild(opt);
    }
  }

  let sortKey = "category";
  let sortDir = "asc";

  function applyFilters(){
    const q = normalize(els.q.value).trim();
    const cat = (els.category.value || "").trim();
    const st = (els.status.value || "").trim();
    const onlyPub = els.onlyPublic.checked;

    let rows = songs.slice();

    if (onlyPub) rows = rows.filter(s => (s.status || "").trim() === "公開");
    if (cat) rows = rows.filter(s => (s.category || "").trim() === cat);
    if (st) rows = rows.filter(s => (s.status || "").trim() === st);

    if (q){
      rows = rows.filter(s => normalize(`${s.title} ${s.jp} ${s.category} ${s.status}`).includes(q));
    }

    rows.sort((a,b)=>{
      const av = (a[sortKey] ?? "").toString();
      const bv = (b[sortKey] ?? "").toString();
      const cmp = av.localeCompare(bv, "ja", { numeric:true, sensitivity:"base" });
      return sortDir === "asc" ? cmp : -cmp;
    });

    render(rows);
    renderSortIndicators();
  }

  function render(rows){
    els.tbody.innerHTML = rows.map(s => `
      <tr class="recordLink" data-record-id="${Number(s.no)}">
        <td>${statusBadge(s.status)}</td>
        <td class="col-title">${escapeHtml(s.title || "-")}</td>
        <td>${escapeHtml(s.jp || "-")}</td>
        <td>${
          s.category
            ? (() => {
                const p = pastelForCategory(s.category);
                return `<span class="chip" style="background:${p.bg};border-color:${p.border};color:${p.text}">${escapeHtml(s.category)}</span>`;
              })()
            : `<span class="muted">-</span>`
        }</td>
      </tr>
    `).join("");

    els.mobileList.innerHTML = rows.map(s => {
      const categoryHtml = s.category
        ? (() => {
            const p = pastelForCategory(s.category);
            return `<span class="chip" style="background:${p.bg};border-color:${p.border};color:${p.text}">${escapeHtml(s.category)}</span>`;
          })()
        : `<span class="muted">-</span>`;

      return `<article class="mobileRecordCard recordLink" data-record-id="${Number(s.no)}">
        <div class="mobileCardRow">
          <div class="mobileTitleGroup">
            <div class="mobileTitleMuted">${escapeHtml(s.title || "-")}</div>
            <div class="mobileJpMain">${escapeHtml(s.jp || "-")}</div>
          </div>
          <div class="mobileMetaRow">
            ${categoryHtml}
            ${statusBadge(s.status)}
          </div>
        </div>
      </article>`;
    }).join("");

    bindRecordLinks();
  }

  function bindRecordLinks(){
    const links = Array.from(document.querySelectorAll(".recordLink[data-record-id]"));
    links.forEach(el => {
      el.addEventListener("click", () => {
        const recordId = Number(el.getAttribute("data-record-id"));
        if (!Number.isInteger(recordId)) return;
        window.location.href = `./detail.html?record=${recordId}`;
      });
    });
  }

  function renderSortIndicators(){
    for (const th of els.ths){
      const key = th.dataset.key;
      const el = document.getElementById(`sort-${key}`);
      if (el) el.textContent = "";
    }
  }

  els.q.addEventListener("input", applyFilters);
  els.category.addEventListener("change", applyFilters);
  els.status.addEventListener("change", applyFilters);
  els.onlyPublic.addEventListener("change", applyFilters);

  els.ths.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (sortKey === key) sortDir = (sortDir === "asc" ? "desc" : "asc");
      else { sortKey = key; sortDir = "asc"; }
      applyFilters();
    });
  });

  (async () => {
    try {
      songs = await loadSongs();
      scheduleItems = await loadSchedule();
      buildCategoryOptions();
      renderCalendar();
      applyFilters();
    } catch (error) {
      console.error(error);
      els.tbody.innerHTML = `<tr><td colspan="4" class="muted">曲データの読み込みに失敗しました。</td></tr>`;
      els.stats.innerHTML = `<span class="chip"><span class="dot bad"></span> 読み込みエラー</span>`;
    }
  })();
})();
