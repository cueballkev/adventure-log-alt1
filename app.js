const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

/*************************************************
 * BOSSES + RULES
 *************************************************/

const KNOWN_BOSSES = [
  "nakatra", "zamorak", "telos", "raksha", "solak", "kerapac",
  "nex", "vorago", "arch glacor", "vindicta", "gregorovic", "kalphite king"
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

/*************************************************
 * DOM
 *************************************************/

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");
const rsnInput = document.getElementById("rsn");
const toggleBtn = document.getElementById("toggleAuto");
const settingsBtn = document.getElementById("settingsBtn");
const configPanel = document.getElementById("configPanel");

/*************************************************
 * STATE
 *************************************************/

let autoRefreshEnabled = true;
let refreshInterval = 60000;
let refreshTimer = null;
let configVisible = true; 

let visibleCount = 5;
const PAGE_SIZE = 5;

let collapsedDates = new Set();

let categoryVisibility = {
  boss: true,
  skill: true,
  quest: true,
  loot: true,
  other: true
};

/*************************************************
 * STORE HELPERS
 *************************************************/

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
  return `${item.activityDate}|${item.title}`;
}

/*************************************************
 * DATE HELPERS
 *************************************************/

function parseActivityDate(value) {
  if (!value) return new Date(0);

  const months = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };

  const match = value.match(/^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2})$/);

  if (match) {
    const [, d, m, y, h, min] = match;
    return new Date(+y, months[m], +d, +h, +min);
  }

  return new Date(value);
}

function getDateKey(date) {
  return parseActivityDate(date).toDateString();
}

function formatActivityTime(date) {
  return parseActivityDate(date)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/*************************************************
 * CATEGORY
 *************************************************/

function getCategory(title) {
  const t = title.trim().toLowerCase();

  for (const [cat, test] of TITLE_RULES) {
    if (test(t)) return cat;
  }

  return "other";
}

function getIcon(cat) {
  switch (cat) {
    case "boss": return "⚔️";
    case "skill": return "📈";
    case "quest": return "📜";
    case "loot": return "🎁";
    default: return "❓";
  }
}

/*************************************************
 * UTIL
 *************************************************/

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/*************************************************
 * CORE LOGIC
 *************************************************/

function sortActivities(map) {
  return [...map.values()]
    .sort((a, b) =>
      parseActivityDate(b.activityDate) -
      parseActivityDate(a.activityDate)
    );
}

function groupByDate(activities) {
  const groups = new Map();

  for (const a of activities) {
    const key = getDateKey(a.activityDate);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(a);
  }

  return groups;
}

function getVisible(map) {
  return sortActivities(map).slice(0, visibleCount);
}

/*************************************************
 * RENDER
 *************************************************/

function renderActivities(map) {

  activitiesDiv.innerHTML = "";

  const visible = getVisible(map);
  const grouped = groupByDate(visible);

  if (!grouped.size) {
    activitiesDiv.innerHTML = "<p>No history yet.</p>";
    return;
  }

  for (const [dateLabel, activities] of grouped.entries()) {

    const isCollapsed = collapsedDates.has(dateLabel);

    const block = document.createElement("div");
    block.className = "day-block";

    const header = document.createElement("div");
    header.className = "date-header collapsible";
    header.textContent = `${isCollapsed ? "▶" : "▼"} ${dateLabel}`;

    const list = document.createElement("div");
    list.className = isCollapsed ? "day-list collapsed" : "day-list";

    header.onclick = () => {
      if (collapsedDates.has(dateLabel)) {
        collapsedDates.delete(dateLabel);
      } else {
        collapsedDates.add(dateLabel);
      }
      renderActivities(map);
    };

    for (const a of activities) {

      const cat = getCategory(a.title);

      if (!categoryVisibility[cat]) continue;

      const div = document.createElement("div");
      div.className = "activity";

      div.innerHTML = `
        <div class="activity-top">
          <span class="icon">${getIcon(cat)}</span>
          <span class="title">${escapeHtml(a.title)}</span>
        </div>
        <div class="meta">
          ${formatActivityTime(a.activityDate)}
        </div>
        <div class="desc">
          ${escapeHtml(a.description || "")}
        </div>
      `;

      list.appendChild(div);
    }

    block.appendChild(header);
    block.appendChild(list);

    activitiesDiv.appendChild(block);
  }

  renderLoadMore(map);
}

/*************************************************
 * LOAD MORE
 *************************************************/

function renderLoadMore(map) {

  const existing = document.querySelector(".load-more-btn");
  if (existing) existing.remove();

  const total = [...map.values()].length;

  if (total <= visibleCount) return;

  const btn = document.createElement("button");
  btn.className = "load-more-btn";
  btn.textContent = "Show More";

  btn.onclick = () => {
    visibleCount += PAGE_SIZE;
    renderActivities(map);
  };

  activitiesDiv.appendChild(btn);
}

/*************************************************
 * SYNC
 *************************************************/

function syncActivities(map, incoming) {

  let added = 0;

  for (const item of incoming) {

    const key = getEventKey(item);

    if (!map.has(key)) {
      map.set(key, item);
      added++;
    }
  }

  if (added > 0) {

    // 🔥 expand visible window so new items appear
    visibleCount += added;

    renderActivities(map);
  }
}

/*************************************************
 * LOAD LOG
 *************************************************/

async function loadLog(silent = false) {

  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  const store = loadStore(rsn);

  if (!silent) {
    statusDiv.textContent = "Syncing...";
  }

  try {

    const res = await fetch(
      `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
    );

    const data = await res.json();

    if (data.activities) {

      for (const item of data.activities) {
        const key = getEventKey(item);
        if (!store.has(key)) {
          store.set(key, item);
        }
      }
    }

    saveStore(rsn, store);

    renderActivities(store);

    statusDiv.textContent =
      silent
        ? "Auto-synced"
        : `Synced • ${store.size}`;

  } catch (e) {

    renderActivities(store);

    statusDiv.textContent = "Sync failed";
  }
}

/*************************************************
 * AUTO REFRESH
 *************************************************/

function startAutoRefresh() {

  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {

    if (!autoRefreshEnabled) return;

    const rsn = rsnInput.value.trim();
    if (!rsn) return;

    loadLog(true);

  }, refreshInterval);
}

/*************************************************
 * INIT
 *************************************************/

const savedRSN = localStorage.getItem("lastRSN");

if (savedRSN) {

  rsnInput.value = savedRSN;

  const store = loadStore(savedRSN);

  renderActivities(store);
  loadLog();

} else {
  rsnInput.focus();
}

startAutoRefresh();

function bindUIControls() {

  /*********************************
   * CATEGORY TOGGLES
   *********************************/
  document.querySelectorAll(".toggle").forEach(btn => {

    const cat = btn.dataset.cat;
    if (!cat) return;

    btn.onclick = () => {

      categoryVisibility[cat] = !categoryVisibility[cat];

      btn.classList.toggle("off", !categoryVisibility[cat]);

      const rsn = rsnInput.value.trim();
      if (rsn) {
        renderActivities(loadStore(rsn));
      }
    };
  });

  /*********************************
   * REFRESH BUTTON
   *********************************/
  if (refreshBtn) {
    refreshBtn.onclick = () => {

      const rsn = rsnInput.value.trim();
      if (!rsn) return;

      renderActivities(loadStore(rsn));
      loadLog();
    };
  }

  /*********************************
   * AUTO TOGGLE
   *********************************/
  if (toggleBtn) {
    toggleBtn.onclick = () => {

      autoRefreshEnabled = !autoRefreshEnabled;

      toggleBtn.textContent =
        autoRefreshEnabled ? "Auto: ON" : "Auto: OFF";

      toggleBtn.classList.toggle("active", autoRefreshEnabled);

      if (autoRefreshEnabled) {
        startAutoRefresh();
      } else {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };
  }

  /*********************************
   * SETTINGS COG
   *********************************/
  if (settingsBtn) {
    settingsBtn.onclick = () => {

      configVisible = !configVisible;

      configPanel.style.display =
        configVisible ? "block" : "none";

      settingsBtn.textContent =
        configVisible ? "⚙️" : "⚙️✓";
    };
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindUIControls);
} else {
  bindUIControls();
}

const simulateBtn = document.getElementById("simulateBtn");

if (simulateBtn) {
	

function simulateNewActivity() {

  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  const store = loadStore(rsn);

  const fakeItem = {
    id: "sim_" + Date.now(),
    title: "I defeated Arch Glacor (simulated)",
    description: "Injected test entry",
    activityDate: new Date().toISOString()
  };

  store.set(getEventKey(fakeItem), fakeItem);
  saveStore(rsn, store);

  // 🔥 important: expand view
  visibleCount += 1;

  renderActivities(store);

  statusDiv.textContent = "Simulated activity added";
}
	
  simulateBtn.onclick = simulateNewActivity;
}
