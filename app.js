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

  for (const activity of activities) {

    const div = document.createElement("div");
    div.className = "activity";

    div.innerHTML = `
      <div><strong>${escapeHtml(activity.title)}</strong></div>
      <div>${escapeHtml(activity.description)}</div>
      <div class="date">${activity.pubDate}</div>
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