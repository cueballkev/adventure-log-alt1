const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

const KNOWN_BOSSES = [
  "nakatra","zamorak","telos","raksha","solak","kerapac",
  "nex","vorago","arch glacor","vindicta","gregorovic","kalphite king"
];

const TITLE_RULES = [
  ["skill", t => /\d+\s*xp\b/i.test(t)],
  ["skill", t => t.includes("advanced a level")],
  ["skill", t => t.includes("levelled")],
  ["skill", t => t.includes("level up")],
  ["skill", t => t.includes("experience points")],

  ["boss", t => KNOWN_BOSSES.some(b => t.includes(b))],
  ["boss", t => t.startsWith("i killed ")],
  ["boss", t => t.startsWith("i defeated ")],
  ["boss", t => t.includes("boss kill")],

  ["quest", t => t.includes("quest")],
  ["quest", t => t.startsWith("i completed ")],

  ["loot", t => t.startsWith("i found ")],
  ["loot", t => t.startsWith("i obtained ")],
  ["loot", t => t.startsWith("i received ")],
  ["loot", t => t.startsWith("i was awarded ")],
  ["loot", t => t.includes(" drop")]
];

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");
const rsnInput = document.getElementById("rsn");
const toggleBtn = document.getElementById("toggleAuto");
const settingsBtn = document.getElementById("settingsBtn");
const configPanel = document.getElementById("configPanel");

let configVisible = true;
let autoRefreshEnabled = true;
let refreshInterval = 60000;
let refreshTimer = null;

let categoryVisibility = {
  boss: true,
  skill: true,
  quest: true,
  loot: true,
  other: true
};

let lastActivities = [];

const savedRSN = localStorage.getItem("lastRSN");
if (savedRSN) {
  rsnInput.value = savedRSN;

  loadStoredHistory(); // instant display
  loadLog();           // background refresh
} else {
  rsnInput.focus();
}
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

function loadStoredHistory() {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  const history = getPlayerHistory(rsn);

  lastActivities = history;
  renderActivities();
}

// ------------------------
// INIT
// ------------------------

refreshBtn.addEventListener("click", () => {
  loadStoredHistory();
  loadLog();
});

rsnInput.addEventListener("change", () => {
  loadStoredHistory();
});

document.querySelectorAll(".toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.cat;

    categoryVisibility[cat] = !categoryVisibility[cat];

    btn.classList.toggle("off", !categoryVisibility[cat]);

    renderActivities();
  });
});

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    autoRefreshEnabled = !autoRefreshEnabled;

    toggleBtn.textContent = autoRefreshEnabled ? "Auto: ON" : "Auto: OFF";
    toggleBtn.classList.toggle("active", autoRefreshEnabled);

    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });
}

settingsBtn.addEventListener("click", () => {
  configVisible = !configVisible;

  configPanel.style.display = configVisible ? "block" : "none";

  settingsBtn.textContent = configVisible ? "⚙️" : "⚙️✓";
});

startAutoRefresh();

// ------------------------
// LOAD DATA (RSS → HISTORY)
// ------------------------

function getLastSeenGuid(history) {
  return history.length ? history[0].guid : null;
}

function getEventKey(item) {
  return item.guid || `${item.pubDate}-${item.title}`;
}

function sortHistory(history) {
  return history.sort((a, b) => {
    const ta = new Date(a.pubDate).getTime();
    const tb = new Date(b.pubDate).getTime();

    if (ta !== tb) return tb - ta;

    return getEventKey(b).localeCompare(getEventKey(a));
  });
}

async function loadLog(silent = false) {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  loadStoredHistory();

  localStorage.setItem("lastRSN", rsn);

  if (!silent) {
    statusDiv.textContent = "Syncing latest activities...";
  }

  try {
    let history = getPlayerHistory(rsn);

    // ✅ use canonical key system
    const existing = new Set(history.map(getEventKey));

    let iterations = 0;
    const MAX_ITERATIONS = 5;

    let newItemsFound = true;

    while (newItemsFound && iterations < MAX_ITERATIONS) {
      iterations++;

      if (!silent) {
        statusDiv.textContent = `Syncing... pass ${iterations}`;
      }

      const response = await fetch(
        `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
      );

      const data = await response.json();

      if (!data.activities) break;

      newItemsFound = false;

      for (const item of data.activities) {
        const key = getEventKey(item);

        if (!existing.has(key)) {
          existing.add(key);
          history.push(item);
          newItemsFound = true;
        }
      }

      // small delay between passes
      await new Promise(r => setTimeout(r, 400));
    }

    history = sortHistory(history);    
    setPlayerHistory(rsn, history);
    lastActivities = history;
    
    renderActivities();

    if (!silent) {
      statusDiv.textContent =
        `Synced • ${history.length} entries • ${iterations} pass(es)`;
    } else {
      statusDiv.textContent =
        `Auto-synced • ${new Date().toLocaleTimeString()}`;
    }

  } catch (err) {
    console.error(err);

    loadStoredHistory();

    statusDiv.textContent =
      "Sync failed • showing cached history";
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
  const history = getPlayerHistory(rsn);

  activitiesDiv.innerHTML = "";

  if (!history.length) {
    activitiesDiv.innerHTML = "<p>No history yet.</p>";
    return;
  }

  const sorted = [...history].sort((a, b) => {
    const ta = new Date(a.pubDate).getTime();
    const tb = new Date(b.pubDate).getTime();
  
    if (ta !== tb) return tb - ta;
  
    // deterministic tie-breaker
    return getEventKey(b).localeCompare(getEventKey(a));
  });

  let currentDate = "";
  let container = null;

  for (const activity of sorted) {
    const category = getCategory(activity.title);

    if (!categoryVisibility[category]) {
      continue;
    }

    const dateObj = new Date(activity.pubDate);
    const dateLabel = dateObj.toDateString();

    // NEW DATE BLOCK
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;

      container = document.createElement("div");
      container.className = "day-block";

      const header = document.createElement("div");
      header.className = "date-header collapsible";
      header.textContent = dateLabel;

      const list = document.createElement("div");
      list.className = "day-list";

      header.addEventListener("click", () => {
        list.classList.toggle("collapsed");
      });

      container.appendChild(header);
      container.appendChild(list);

      activitiesDiv.appendChild(container);
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

    container.querySelector(".day-list").appendChild(div);
  }
}

// ------------------------
// CATEGORY LOGIC
// ------------------------

function getCategory(title) {
  const t = title.trim().toLowerCase();

  for (const [category, test] of TITLE_RULES) {
    if (test(t)) {
      return category;
    }
  }

  return "other";
}

function getIcon(category) {
  switch (category) {
    case "boss": return "⚔️";
    case "skill": return "📈";
    case "quest": return "📜";
    case "loot": return "🎁";
    default: return "❓";
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

