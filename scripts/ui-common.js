(function(){
  function escapeHtml(str){
    return (str ?? "").toString()
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function hashHue(str){
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  function pastelForCategory(category){
    const c = (category || "other").trim() || "other";
    const hue = hashHue(c);
    return {
      bg: `hsl(${hue} 75% 92%)`,
      border: `hsl(${hue} 55% 80%)`,
      text: `hsl(${hue} 35% 28%)`
    };
  }

  function statusBadge(status){
    const s = (status || "").trim();
    let cls = "status-public";
    if (s === "非公開") cls = "status-private";
    if (s === "準備中") cls = "status-wip";
    return `<span class="badge ${cls}"><span class="dot"></span>${escapeHtml(s || "-")}</span>`;
  }

  function getStartHour(timeText){
    const start = (timeText || "").split("-")[0]?.trim() || "";
    const [hour] = start.split(":");
    const n = Number(hour);
    return Number.isFinite(n) ? n : null;
  }

  function iconPathForTime(timeText){
    const hour = getStartHour(timeText);
    if (hour === null) return "";
    if (hour >= 6 && hour < 16) return "./images/icons/icon-sunrise-slot.svg";
    if (hour >= 16 && hour < 30) return "./images/icons/icon-night-slot.svg";
    return "";
  }

  function slotThemeClass(timeText){
    const hour = getStartHour(timeText);
    if (hour === null) return "nightSlot";
    if (hour >= 6 && hour < 16) return "daySlot";
    return "nightSlot";
  }

  function normalize(str){
    return (str ?? "").toString().toLowerCase();
  }

  window.NaokiUI = {
    escapeHtml,
    pastelForCategory,
    statusBadge,
    iconPathForTime,
    slotThemeClass,
    normalize,
  };
})();
