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

const savedRSN = localStorage.getItem("lastRSN");

if (savedRSN) {
  rsnInput.value = savedRSN;

  const store = loadStore(savedRSN);
  renderActivities(store);   // instant UI from cache

  loadLog(); // then sync in background
} else {
  rsnInput.focus();
}

// ------------------------
// INIT
// ------------------------

refreshBtn.addEventListener("click", () => {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  const store = loadStore(rsn);
  renderActivities(store); // instant cached view
  loadLog();               // then sync
});

rsnInput.addEventListener("change", () => {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  const store = loadStore(rsn);
  renderActivities(store);
  loadLog();
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

function loadStore(rsn) {
  const raw = localStorage.getItem(`history_${rsn}`);
  if (!raw) return new Map();

  try {
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
}

function saveStore(rsn, map) {
  localStorage.setItem(
    `history_${rsn}`,
    JSON.stringify([...map.entries()])
  );
}

function getEventKey(item) {
  return item.guid || `${item.pubDate}-${item.title}`;
}

async function loadLog(silent = false) {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  localStorage.setItem("lastRSN", rsn);

  let store = loadStore(rsn);

  if (!silent) {
    statusDiv.textContent = "Syncing latest activities...";
  }

  try {
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

      const batchId = Date.now(); // snapshot identifier

      data.activities.forEach((item, index) => {
        const key = getEventKey(item);

        if (!store.has(key)) {
          store.set(key, {
            ...item,
            _batchId: batchId,
            _batchOrder: index
          });

          newItemsFound = true;
        }
      });

      await new Promise(r => setTimeout(r, 300));
    }

    saveStore(rsn, store);

    renderActivities(store);

    statusDiv.textContent = silent
      ? `Auto-synced • ${new Date().toLocaleTimeString()}`
      : `Synced • ${store.size} entries • ${iterations} pass(es)`;

  } catch (err) {
    console.error(err);

    renderActivities(store);

    statusDiv.textContent =
      "Sync failed • showing cached data";
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

function renderActivities(map) {
  const activitiesDiv = document.getElementById("activities");
  activitiesDiv.innerHTML = "";

  if (!map || map.size === 0) {
    activitiesDiv.innerHTML = "<p>No history yet.</p>";
    return;
  }

  const sorted = [...map.values()].sort((a, b) => {
    const ta = new Date(a.pubDate).getTime();
    const tb = new Date(b.pubDate).getTime();

    if (ta !== tb) return tb - ta;

    if (a._batchId !== b._batchId) {
      return b._batchId - a._batchId;
    }

    return (a._batchOrder ?? 0) - (b._batchOrder ?? 0);
  });

  let currentDate = "";
  let container = null;

  for (const activity of sorted) {

    // ✅ RESTORED CATEGORY FILTER
    const category = getCategory(activity.title);

    if (!categoryVisibility[category]) {
      continue;
    }

    const dateLabel = new Date(activity.pubDate).toDateString();

    if (dateLabel !== currentDate) {
      currentDate = dateLabel;

      container = document.createElement("div");
      container.className = "day-block";

      const header = document.createElement("div");
      header.className = "date-header";
      header.textContent = dateLabel;

      const list = document.createElement("div");
      list.className = "day-list";

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

