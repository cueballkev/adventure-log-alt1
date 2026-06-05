const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");
const rsnInput = document.getElementById("rsn");

let currentFilter = "all";
let autoRefreshEnabled = true;
let refreshInterval = 60000;
let refreshTimer = null;

let lastActivities = [];

// ------------------------
// STORAGE (per player)
// ------------------------

function loadHistoryStore() {
  return JSON.parse(localStorage.getItem("historyByPlayer") || "{}");
}

function saveHistoryStore(store) {
  localStorage.setItem("historyByPlayer", JSON.stringify(store));
}

function getPlayerHistory(rsn) {
  const store = loadHistoryStore();
  return store[rsn] || [];
}

function setPlayerHistory(rsn, activities) {
  const store = loadHistoryStore();
  store[rsn] = activities;
  saveHistoryStore(store);
}

// ------------------------
// INIT
// ------------------------

refreshBtn.addEventListener("click", loadLog);

document.querySelectorAll(".filters button")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;

      document.querySelectorAll(".filters button")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      renderActivities();
    });
  });

const toggleBtn = document.getElementById("toggleAuto");

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    autoRefreshEnabled = !autoRefreshEnabled;

    toggleBtn.textContent =
      autoRefreshEnabled ? "Auto: ON" : "Auto: OFF";

    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });
}

// auto-start
loadLog();
startAutoRefresh();

// ------------------------
// LOAD DATA (RSS → HISTORY)
// ------------------------

async function loadLog(silent = false) {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  if (!silent) statusDiv.textContent = "Loading...";

  try {
    const response = await fetch(
      `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
    );

    const data = await response.json();

    if (!data.activities) {
      if (!silent) statusDiv.textContent = "No data returned";
      return;
    }

    // merge into history
    let history = getPlayerHistory(rsn);

    const existing = new Set(history.map(x => x.guid));

    for (const item of data.activities) {
      if (!existing.has(item.guid)) {
        history.push(item);
      }
    }

    setPlayerHistory(rsn, history);

    lastActivities = history;

    renderActivities();

    if (!silent) {
      statusDiv.textContent =
        `${history.length} saved | ${data.activities.length} fetched`;
    } else {
      statusDiv.textContent =
        `Auto-updated • ${new Date().toLocaleTimeString()}`;
    }

  } catch (err) {
    console.error(err);
    if (!silent) statusDiv.textContent = "Failed to load feed";
  }
}

// ------------------------
// AUTO REFRESH
// ------------------------

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    if (!autoRefreshEnabled) return;

    const rsn = rsnInput.value.trim();
    if (!rsn) return;

    loadLog(true);
  }, refreshInterval);
}

// ------------------------
// RENDER UI (ONLY UI WORK HERE)
// ------------------------

function renderActivities() {
  const rsn = rsnInput.value.trim();

  if (!rsn) {
    activitiesDiv.innerHTML = "<p>Enter a player name.</p>";
    return;
  }

  const history = getPlayerHistory(rsn);

  if (!history || history.length === 0) {
    activitiesDiv.innerHTML = "<p>No history yet. Click Refresh.</p>";
    return;
  }

  activitiesDiv.innerHTML = "";

  const sorted = [...history].sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );

  let currentDate = "";

  for (const activity of sorted) {
    const category = getCategory(activity.title);

    if (currentFilter && currentFilter !== "all" && category !== currentFilter) {
      continue;
    }

    const dateObj = new Date(activity.pubDate);
    const dateLabel = dateObj.toDateString();

    if (dateLabel !== currentDate) {
      currentDate = dateLabel;

      const header = document.createElement("div");
      header.className = "date-header";
      header.textContent = dateLabel;

      activitiesDiv.appendChild(header);
    }

    const div = document.createElement("div");
    div.className = "activity";

    div.innerHTML = `
      <div class="activity-top">
        <span class="icon">${getIcon(category)}</span>
        <span class="title">${escapeHtml(activity.title)}</span>
      </div>
      <div class="meta">
        <span class="category">${category.toUpperCase()}</span>
      </div>
      <div class="desc">${escapeHtml(activity.description || "")}</div>
    `;

    activitiesDiv.appendChild(div);
  }
}

// ------------------------
// CATEGORY LOGIC
// ------------------------

function getCategory(title) {
  const t = title.toLowerCase();

  if (t.includes("killed") || t.includes("defeated")) return "boss";
  if (t.includes("level") || t.includes("advanced")) return "skill";
  if (t.includes("quest")) return "quest";

  if (
    t.includes("obtained") ||
    t.includes("received") ||
    t.includes("dropped") ||
    t.includes("loot")
  ) return "loot";

  return "other";
}

function getIcon(category) {
  switch (category) {
    case "boss": return "⚔️";
    case "skill": return "📈";
    case "quest": return "📜";
    case "loot": return "🎁";
    default: return "•";
  }
}

// ------------------------
// UTIL
// ------------------------

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
