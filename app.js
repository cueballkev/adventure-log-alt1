const WORKER_URL =
  "https://divine-snow-39fc.kevtrix15.workers.dev/";

const refreshBtn = document.getElementById("refreshBtn");
const activitiesDiv = document.getElementById("activities");
const statusDiv = document.getElementById("status");

refreshBtn.addEventListener("click", loadLog);

let seenGuids = new Set(
  JSON.parse(localStorage.getItem("seenGuids") || "[]")
);

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

    renderActivities(data.activities);

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

function renderActivities(activities) {
  activitiesDiv.innerHTML = "";

  if (!activities || activities.length === 0) {
    activitiesDiv.innerHTML = "<p>No activity found.</p>";
    return;
  }

  // newest first
  const sorted = [...activities].sort(
    (a, b) => new Date(b.pubDate) - new Date(a.pubDate)
  );

  let currentDate = "";

  for (const activity of sorted) {
    const dateObj = new Date(activity.pubDate);

    const dateLabel = dateObj.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    });

    // date header grouping
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
      <div class="title">
        ${getIcon(activity.title)} ${escapeHtml(activity.title)}
      </div>
      <div class="desc">${escapeHtml(activity.description || "")}</div>
    `;

    activitiesDiv.appendChild(div);
  }
}

function getIcon(title) {
  const t = title.toLowerCase();

  if (t.includes("killed") || t.includes("defeated")) return "⚔️";
  if (t.includes("level")) return "📈";
  if (t.includes("quest")) return "📜";
  if (t.includes("achievement")) return "🏆";
  if (t.includes("obtained") || t.includes("received")) return "🎁";

  return "•";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// auto-load on open
loadLog();
