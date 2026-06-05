const WORKER_URL =
  "https://divine-snow-39fc.kevtrix15.workers.dev/";

const refreshBtn =
  document.getElementById("refreshBtn");

const activitiesDiv =
  document.getElementById("activities");

const statusDiv =
  document.getElementById("status");

refreshBtn.addEventListener("click", loadLog);

async function loadLog() {
  const rsn =
    document.getElementById("rsn").value.trim();

  if (!rsn) return;

  statusDiv.textContent = "Loading...";

  try {
    const response = await fetch(
      `${WORKER_URL}/?rsn=${encodeURIComponent(rsn)}`
    );

    const data = await response.json();

    renderActivities(data.activities);

    statusDiv.textContent =
      `${data.activities.length} activities loaded`;
  }
  catch (err) {
    console.error(err);

    statusDiv.textContent =
      "Failed to load activity feed";
  }
}

function renderActivities(activities) {
  activitiesDiv.innerHTML = "";

  if (!activities || activities.length === 0) {
    activitiesDiv.innerHTML = "<p>No activity found.</p>";
    return;
  }

  // sort newest first
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

    // new day header
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
      <div class="title">${escapeHtml(activity.title)}</div>
      <div class="desc">${escapeHtml(activity.description || "")}</div>
    `;

    activitiesDiv.appendChild(div);
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

loadLog();
