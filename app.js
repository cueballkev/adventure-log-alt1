const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");
const rsnInput = document.getElementById("rsn");

let currentFilter = "all";

// ------------------------
// STORAGE HELPERS
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
// EVENTS
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

// auto load
loadLog();

// ------------------------
// LOAD RSS + MERGE HISTORY
// ------------------------

async function loadLog() {
  const rsn = rsnInput.value.trim();
  if (!rsn) return;

  statusDiv.textContent = "Loading...";

  try {
    const response = await fetch(
      `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
    );

    const data = await response.json();

    if (!data.activities) {
      statusDiv.textContent = "No data returned";
      return;
    }

    // load existing history
    let history = getPlayerHistory(rsn);

    // merge new activities (avoid duplicates by GUID)
    const existingGuids = new Set(history.map(x => x.guid));

    for (const item of data.activities) {
      if (!existingGuids.has(item.guid)) {
        history.push(item);
      }
    }

    // save back per player
    setPlayerHistory(rsn, history);

    statusDiv.textContent =
      `${history.length} total saved (${data.activities.length} latest fetched)`;

    renderActivities();

  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Failed to load activity feed";
  }
}

// ------------------------
// RENDER (from history)
// ------------------------

function renderActivities() {
  const rsn = rsnInput.value.trim();
  const history = getPlayerHistory(rsn);

  activitiesDiv.innerHTML = "";

  if (!history.length) {
    activitiesDiv.innerHTML = "<p>No history yet.</p>";
    return;
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );

  let currentDate = "";

  for (const activity of sorted) {
    const category = getCategory(activity.title);

    if (currentFilter !== "all" && category !== currentFilter) {
      continue;
    }

    const dateObj = new Date(activity.pubDate);

    const dateLabel = dateObj.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });

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
// CATEGORY SYSTEM
// ------------------------

function getCategory(title) {
  const t = title.toLowerCase();

  if (t.includes("killed") || t.includes("defeated"))
    return "boss";

  if (t.includes("level") || t.includes("advanced"))
    return "skill";

  if (t.includes("quest"))
    return "quest";

  if (
    t.includes("obtained") ||
    t.includes("received") ||
    t.includes("dropped") ||
    t.includes("loot")
  )
    return "loot";

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
