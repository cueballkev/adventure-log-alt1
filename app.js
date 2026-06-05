const WORKER_URL = "https://divine-snow-39fc.kevtrix15.workers.dev/";

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");

let currentFilter = "all";
let lastActivities = [];

let seenGuids = new Set(
  JSON.parse(localStorage.getItem("seenGuids") || "[]")
);

// --------------------
// EVENTS
// --------------------

refreshBtn.addEventListener("click", loadLog);

document.querySelectorAll(".filters button")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;

      document.querySelectorAll(".filters button")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");

      renderActivities(lastActivities);
    });
  });

// auto-load
loadLog();

// --------------------
// LOAD RSS DATA
// --------------------

async function loadLog() {
  const rsn = document.getElementById("rsn").value.trim();
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

    lastActivities = data.activities;

    renderActivities(lastActivities);

    // detect new items
    const newItems = data.activities.filter(
      a => !seenGuids.has(a.guid)
    );

    for (const item of newItems) {
      seenGuids.add(item.guid);
    }

    localStorage.setItem(
      "seenGuids",
      JSON.stringify([...seenGuids])
    );

    statusDiv.textContent =
      `${data.activities.length} loaded | ${newItems.length} new`;

  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Failed to load activity feed";
  }
}

// --------------------
// RENDER UI
// --------------------

function renderActivities(activities) {
  activitiesDiv.innerHTML = "";

  if (!activities || activities.length === 0) {
    activitiesDiv.innerHTML = "<p>No activity found.</p>";
    return;
  }

  const sorted = [...activities].sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );

  let currentDate = "";

  for (const activity of sorted) {
    const category = getCategory(activity.title);

    // filter logic
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

    // date grouping
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;

      const header = document.createElement("div");
      header.className = "date-header";
      header.textContent = dateLabel;

      activitiesDiv.appendChild(header);
    }

    const isNew = !seenGuids.has(activity.guid);

    const div = document.createElement("div");
    div.className = "activity" + (isNew ? " new" : "");

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

// --------------------
// CATEGORY SYSTEM
// --------------------

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

// --------------------
// UTIL
// --------------------

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
