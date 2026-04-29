import { QuartzComponent, QuartzComponentConstructor } from "./types"

const WORKER_URL = "https://synergetics-github-api-helper.rohanshu.workers.dev/trends"

const TrendsManifest: QuartzComponent = () => {
  return (
    <div id="trends-manifest-container">
      <h2 class="trends-title">Trends Manifest</h2>
      <p class="trends-subtitle">Ship's log — what's moving on Synergetics Isle.</p>
      <div id="trends-content">
        <p class="trends-loading">Fetching from the bridge…</p>
      </div>
    </div>
  )
}

TrendsManifest.css = `
.trends-manifest,
#trends-manifest-container {
  max-width: 680px;
  margin: 2rem auto;
  font-family: var(--bodyFont);
}

.trends-title {
  font-family: var(--headerFont);
  font-size: 1.5rem;
  color: var(--dark);
  margin-bottom: 0.25rem;
}

.trends-subtitle {
  color: var(--gray);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.trends-section {
  margin-bottom: 2rem;
}

.trends-section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.trends-section-header h3 {
  font-family: var(--headerFont);
  font-size: 1rem;
  color: var(--darkgray);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.trends-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.trends-status-dot.in-progress {
  background: var(--secondary);
  box-shadow: 0 0 6px var(--secondary);
}

.trends-status-dot.done {
  background: var(--tertiary);
}

.trends-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-left: 1px solid var(--lightgray);
}

.trends-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.5rem 0 0.5rem 1rem;
  border-bottom: 1px solid var(--lightgray);
}

.trends-item:last-child {
  border-bottom: none;
}

.trends-item a {
  color: var(--dark);
  text-decoration: none;
  font-size: 0.95rem;
  line-height: 1.4;
}

.trends-item a:hover {
  color: var(--secondary);
}

.trends-time {
  color: var(--gray);
  font-size: 0.8rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.trends-loading,
.trends-error {
  color: var(--gray);
  font-size: 0.9rem;
  font-style: italic;
}

.trends-error {
  color: var(--secondary);
}
`

TrendsManifest.afterDOMLoaded = `
(function() {
  const WORKER_URL = "https://synergetics-github-api-helper.rohanshu.workers.dev/trends";

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + "d ago";
    const months = Math.floor(days / 30);
    if (months === 1) return "1mo ago";
    if (months < 12) return months + "mo ago";
    return Math.floor(months / 12) + "y ago";
  }

  function renderTrends(data) {
    const container = document.getElementById("trends-content");
    if (!container) return;

    const inProgress = data["In Progress"] || [];
    const doneAll = data["Done"] || [];
    const done = doneAll
      .sort(function(a, b) { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); })
      .slice(0, 7);

    var html = "";

    if (inProgress.length > 0) {
      html += '<section class="trends-section">';
      html += '<div class="trends-section-header">';
      html += '<span class="trends-status-dot in-progress"></span>';
      html += '<h3>In Progress</h3>';
      html += '</div>';
      html += '<ul class="trends-list">';
      inProgress.forEach(function(item) {
        html += '<li class="trends-item">';
        html += '<a href="' + item.url + '" target="_blank" rel="noopener noreferrer">' + item.title + '</a>';
        html += '<span class="trends-time">' + timeAgo(item.updatedAt) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
      html += '</section>';
    }

    if (done.length > 0) {
      html += '<section class="trends-section">';
      html += '<div class="trends-section-header">';
      html += '<span class="trends-status-dot done"></span>';
      html += '<h3>Recently Done</h3>';
      html += '</div>';
      html += '<ul class="trends-list">';
      done.forEach(function(item) {
        html += '<li class="trends-item">';
        html += '<a href="' + item.url + '" target="_blank" rel="noopener noreferrer">' + item.title + '</a>';
        html += '<span class="trends-time">' + timeAgo(item.updatedAt) + '</span>';
        html += '</li>';
      });
      html += '</ul>';
      html += '</section>';
    }

    container.innerHTML = html;
  }

  function showError(msg) {
    var container = document.getElementById("trends-content");
    if (container) {
      container.innerHTML = '<p class="trends-error">' + msg + '</p>';
    }
  }

  function tryInit(attempts) {
    attempts = attempts || 0;
    var container = document.getElementById("trends-content");
    if (!container) {
      if (attempts < 10) setTimeout(function() { tryInit(attempts + 1); }, 50);
      return;
    }
    if (container._loaded) return;
    container._loaded = true;

    fetch(WORKER_URL)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) renderTrends(data.trends);
        else showError("Worker returned an error.");
      })
      .catch(function() {
        showError("Could not reach trends worker.");
      });
  }

  document.addEventListener("nav", function() {
    var container = document.getElementById("trends-content");
    if (container) container._loaded = false;
    tryInit();
  });
  tryInit();
})();
`

export default (() => TrendsManifest) satisfies QuartzComponentConstructor