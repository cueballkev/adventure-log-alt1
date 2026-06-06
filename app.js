const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

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

const PAGE_SIZE = 5;
let visibleCount = PAGE_SIZE;
const collapsedDates = new Set();

let categoryVisibility = {
  boss: true,
  skill: true,
  quest: true,
  loot: true,
  other: true
};

// ------------------------
// DATE PARSING
// ------------------------

function parseActivityDate(value) {

  if (!value) {
    return new Date(0);
  }

  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  };

  const match = value.match(
    /^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2})$/
  );

  if (match) {
    const [, day, month, year, hour, minute] = match;

    return new Date(
      Number(year),
      months[month],
      Number(day),
      Number(hour),
      Number(minute)
    );
  }

  return new Date(value);
}

function formatActivityTime(activityDate) {
  return parseActivityDate(activityDate)
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
}

function getDateKey(activityDate) {
  return parseActivityDate(activityDate)
    .toDateString();
}

// ------------------------
// STORAGE
// ------------------------

function loadStore(rsn) {
  const raw = localStorage.getItem(`history_${rsn}`);

  if (!raw) {
    return new Map();
  }

  try {
    const map = new Map(JSON.parse(raw));

    // Old RSS cache detected
    if ([...map.values()].some(x => x.pubDate)) {
      localStorage.removeItem(`history_${rsn}`);
      return new Map();
    }

    return map;
  }
  catch {
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

// ------------------------
// INIT
// ------------------------

const savedRSN = localStorage.getItem("lastRSN");

if (savedRSN) {
  rsnInput.value = savedRSN;

  const store = loadStore(savedRSN);
  renderActivities(store);

  loadLog();
} else {
  rsnInput.focus();
}

refreshBtn.addEventListener("click", () => {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;
  
  const store = loadStore(rsn);
  renderActivities(store);
  loadLog();
});

rsnInput.addEventListener("change", () => {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  visibleCount = PAGE_SIZE;
  
  const store = loadStore(rsn);  
  renderActivities(store);  
  loadLog();
});

document.querySelectorAll(".toggle").forEach(btn => {
  btn.addEventListener("click", () => {

    const cat = btn.dataset.cat;

    categoryVisibility[cat] =
      !categoryVisibility[cat];

    btn.classList.toggle(
      "off",
      !categoryVisibility[cat]
    );

    renderActivities(
      loadStore(rsnInput.value.trim())
    );
  });
});

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {

    autoRefreshEnabled = !autoRefreshEnabled;

    toggleBtn.textContent =
      autoRefreshEnabled
        ? "Auto: ON"
        : "Auto: OFF";

    toggleBtn.classList.toggle(
      "active",
      autoRefreshEnabled
    );

    if (autoRefreshEnabled) {
      startAutoRefresh();
    }
    else {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  });
}

settingsBtn.addEventListener("click", () => {

  configVisible = !configVisible;

  configPanel.style.display =
    configVisible
      ? "block"
      : "none";

  settingsBtn.textContent =
    configVisible
      ? "⚙️"
      : "⚙️✓";
});

startAutoRefresh();

// ------------------------
// LOAD DATA
// ------------------------

async function loadLog(silent = false) {

  const rsn = rsnInput.value.trim();

  if (!rsn) {
    return;
  }

  localStorage.setItem("lastRSN", rsn);

  const store = loadStore(rsn);

  if (!silent) {
    statusDiv.textContent =
      "Syncing latest activities...";
  }

  try {

    const response = await fetch(
      `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
    );

    const data = await response.json();

    if (data.activities) {

      data.activities.forEach(item => {

        const key = getEventKey(item);

        if (!store.has(key)) {
          store.set(key, item);
        }
      });
    }

    saveStore(rsn, store);

    renderActivities(store);

    statusDiv.textContent =
      silent
        ? `Auto-synced • ${new Date().toLocaleTimeString()}`
        : `Synced • ${store.size} entries`;

  }
  catch (err) {

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

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(() => {

    if (!autoRefreshEnabled) {
      return;
    }

    const rsn = rsnInput.value.trim();

    if (!rsn) {
      return;
    }

    loadLog(true);

  }, refreshInterval);
}

// ------------------------
// RENDER
// ------------------------

function renderActivities(map) {

  activitiesDiv.innerHTML = "";

  if (!map || map.size === 0) {
    activitiesDiv.innerHTML = "<p>No history yet.</p>";
    return;
  }

  const sorted = [...map.values()]
    .sort((a, b) =>
      parseActivityDate(b.activityDate).getTime() -
      parseActivityDate(a.activityDate).getTime()
    );

  const visibleActivities =
    sorted.slice(0, visibleCount);

  let currentDate = "";
  let container = null;

  for (const activity of visibleActivities) {

    const category =
      getCategory(activity.title);

    if (!categoryVisibility[category]) {
      continue;
    }

    const dateLabel =
      getDateKey(activity.activityDate);

    if (dateLabel !== currentDate) {

      currentDate = dateLabel;

      container = document.createElement("div");
      container.className = "day-block";

      const header =
        document.createElement("div");

      header.className =
        "date-header collapsible";

      const collapsed =
        collapsedDates.has(dateLabel);

      header.textContent =
        `${collapsed ? "▶" : "▼"} ${dateLabel}`;

      const list =
        document.createElement("div");

      list.className =
        collapsed
          ? "day-list collapsed"
          : "day-list";

      header.addEventListener("click", () => {

        if (collapsedDates.has(dateLabel)) {
          collapsedDates.delete(dateLabel);
        } else {
          collapsedDates.add(dateLabel);
        }

        renderActivities(map);
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
        ${formatActivityTime(activity.activityDate)}
      </div>

      <div class="desc">
        ${escapeHtml(activity.description || "")}
      </div>
    `;

    container
      .querySelector(".day-list")
      .appendChild(div);
  }

  if (sorted.length > visibleCount) {

    const btn =
      document.createElement("button");

    btn.textContent =
      `Show More`;

    btn.style.width = "100%";
    btn.style.marginTop = "10px";

    btn.addEventListener("click", () => {

      visibleCount += PAGE_SIZE;

      renderActivities(map);
    });

    activitiesDiv.appendChild(btn);
  }
}

// ------------------------
// CATEGORY LOGIC
// ------------------------

function getCategory(title) {

  const t =
    title.trim().toLowerCase();

  for (const [category, test] of TITLE_RULES) {

    if (test(t)) {
      return category;
    }
  }

  return "other";
}

function getIcon(category) {

  switch (category) {

    case "boss":
      return "⚔️";

    case "skill":
      return "📈";

    case "quest":
      return "📜";

    case "loot":
      return "🎁";

    default:
      return "❓";
  }
}

// ------------------------
// UTIL
// ------------------------

function escapeHtml(text) {

  const div =
    document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}