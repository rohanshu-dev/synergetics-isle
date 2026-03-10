import { QuartzComponent, QuartzComponentConstructor } from "./types"

const SynergeticsAI: QuartzComponent = () => {
  return (
    <div id="synergetics-container">
      <div id="chat-input-container">
        <textarea
          id="chat-input"
          rows={1}
          aria-label="Ask a question"
        ></textarea>
        <button id="chat-send" aria-label="Send">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12L3 2L3 22L21 12Z" />
          </svg>
        </button>
      </div>
      <div id="chat-output" aria-live="polite"></div>
    </div>
  )
}

SynergeticsAI.css = `
#synergetics-container {
  max-width: 618px;
  margin: 2.618rem auto;
  padding: 0 1rem;
}

#chat-input-container {
  display: flex;
  align-items: flex-end;
  gap: 0.618rem;
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  padding: 0.5rem 0.618rem;
  box-sizing: border-box;
  min-height: calc(2.618rem + 1rem);
}

#chat-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 0.5rem 0.382rem;
  font-family: inherit;
  font-size: 1rem;
  resize: none;
  height: 2.618rem;
  max-height: 10rem;
  color: var(--dark);
  line-height: 1.618;
  overflow: hidden;
  box-sizing: border-box;
  display: block;
  margin: 0;
}

#chat-input::placeholder {
  color: var(--gray);
  opacity: 0.7;
  transition: opacity 0.4s ease;
}

#chat-send {
  background: transparent;
  color: var(--dark);
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.618rem;
  height: 1.618rem;
  flex-shrink: 0;
  margin-bottom: 0.382rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

#chat-send:hover { opacity: 1; }
#chat-send:disabled { opacity: 0.3; cursor: not-allowed; }

#chat-output {
  margin-top: 1.618rem;
}

.query-label {
  font-size: 0.618rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gray);
  margin-bottom: 0.382rem;
  font-weight: 600;
}

.query-text {
  font-size: 1.618rem;
  font-weight: 600;
  margin-bottom: 1.618rem;
  line-height: 1.382;
}

.answer-content {
  font-size: 1rem;
  line-height: 1.618;
  padding: 1.618rem;
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-radius: 4px;
}

.thinking-status {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  color: var(--gray);
  font-size: 0.875rem;
  font-style: italic;
}

.thinking-timer {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
  font-size: 0.75rem;
}

.thinking-message {
  transition: opacity 0.4s ease;
}

.thinking-message.fade {
  opacity: 0;
}
`

SynergeticsAI.afterDOMLoaded = `
(function() {
  if (!document.getElementById("synergetics-container")) return;
  const WORKER_URL = "https://synergetics-worker.rohanshu.workers.dev";

  const PLACEHOLDER_MESSAGES = [
    "Type your question here",
    "Let us pray I don't hallucinate today"
  ];

  // Tiered thinking messages by time phase
  const THINKING_MESSAGES = {
    early: [
      "triangulating an answer...",
      "consulting the geometry of thought...",
      "cross-referencing 1468 pages so you don't have to...",
      "on it...",
    ],
    mid: [
      "Fuller never rushed either...",
      "thinking in systems...",
      "finding the lowest-energy path to an answer...",
      "doing more with less processing...",
      "ephemeralization in progress...",
    ],
    late: [
      "this one requires a geodesic moment...",
      "still here, still thinking...",
      "some questions take time — this seems to be one...",
      "the geometry is unusually complex here...",
      "patience — Fuller wrote 1468 pages for a reason...",
    ],
    stall: [
      "I might be stuck. You could try again.",
      "something feels off on my end...",
      "I may have lost the thread. Consider refreshing.",
    ],
  };

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getPhase(seconds) {
    if (seconds >= 30) return "stall";
    if (seconds >= 20) return "late";
    if (seconds >= 8)  return "mid";
    return "early";
  }

  function init() {
    const outputEl = document.getElementById("chat-output");
    const inputEl = document.getElementById("chat-input");
    const sendBtn = document.getElementById("chat-send");

    if (!outputEl || !inputEl || !sendBtn || sendBtn._bound) return;
    sendBtn._bound = true;

    // --- Placeholder: pick once per page load, never rotates ---
    inputEl.placeholder = PLACEHOLDER_MESSAGES[Math.floor(Math.random() * PLACEHOLDER_MESSAGES.length)];

    // --- Textarea resize ---
    const baseHeight = parseFloat(getComputedStyle(inputEl).height);

    inputEl.addEventListener("input", function() {
      this.style.height = baseHeight + "px";
      this.style.overflowY = "hidden";
      const scrollH = this.scrollHeight;
      const maxHeight = parseFloat(getComputedStyle(this).maxHeight) || 160;
      if (scrollH > baseHeight) {
        this.style.height = Math.min(scrollH, maxHeight) + "px";
        this.style.overflowY = scrollH > maxHeight ? "auto" : "hidden";
      }
    });

    // --- Thinking state ---
    // Single 1s master interval drives timer + message rotation.
    // Message rotates every MSG_INTERVAL seconds. Phase transitions
    // always trigger an immediate crossfade, never interrupt mid-fade.
    const MSG_INTERVAL = 8; // seconds between message changes
    let masterInterval = null;
    let pendingFade = null; // tracks in-flight fade timeout

    function startThinking(contentEl) {
      let seconds = 0;
      let currentPhase = "early";
      let lastMsg = "";
      let secondsSinceRotation = 0;
      let phaseJustChanged = false;

      function pickMessage(phase) {
        const pool = THINKING_MESSAGES[phase];
        let msg = randomFrom(pool);
        if (pool.length > 1) {
          while (msg === lastMsg) msg = randomFrom(pool);
        }
        lastMsg = msg;
        return msg;
      }

      function crossfadeTo(msg) {
        if (pendingFade) return; // don't interrupt an in-flight fade
        msgEl.classList.add("fade");
        pendingFade = setTimeout(() => {
          msgEl.textContent = msg;
          msgEl.classList.remove("fade");
          pendingFade = null;
        }, 400);
      }

      const firstMsg = pickMessage("early");
      contentEl.innerHTML = \`
        <div class="thinking-status">
          <span class="thinking-timer">0s</span>
          <span class="thinking-message">\${firstMsg}</span>
        </div>
      \`;

      const timerEl = contentEl.querySelector(".thinking-timer");
      const msgEl = contentEl.querySelector(".thinking-message");

      masterInterval = setInterval(() => {
        seconds++;
        timerEl.textContent = seconds + "s";
        secondsSinceRotation++;

        const newPhase = getPhase(seconds);
        if (newPhase !== currentPhase) {
          currentPhase = newPhase;
          secondsSinceRotation = 0;
          phaseJustChanged = true;
          crossfadeTo(pickMessage(currentPhase));
          return;
        }

        if (phaseJustChanged) {
          phaseJustChanged = false;
          return; // skip rotation tick right after a phase change
        }

        if (secondsSinceRotation >= MSG_INTERVAL) {
          secondsSinceRotation = 0;
          crossfadeTo(pickMessage(currentPhase));
        }
      }, 1000);
    }

    function stopThinking() {
      clearInterval(masterInterval);
      masterInterval = null;
      if (pendingFade) {
        clearTimeout(pendingFade);
        pendingFade = null;
      }
    }

    // --- Query handler ---
    async function handleQuery() {
      const query = inputEl.value.trim();
      if (!query || sendBtn.disabled) return;

      inputEl.value = "";
      inputEl.style.height = baseHeight + "px";
      inputEl.style.overflowY = "hidden";
      sendBtn.disabled = true;

      outputEl.innerHTML = \`
        <div class="query-label">Question</div>
        <div class="query-text">\${query}</div>
        <div class="query-label">Answer</div>
        <div class="answer-content"></div>
      \`;

      const contentEl = outputEl.querySelector(".answer-content");
      startThinking(contentEl);

      let streamStarted = false;

      try {
        const response = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunks = decoder.decode(value).split("\\n");
          for (const chunk of chunks) {
            if (!chunk.startsWith("data: ")) continue;
            const data = chunk.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices[0].delta.content;
              if (token) {
                if (!streamStarted) {
                  stopThinking();
                  contentEl.innerHTML = "";
                  streamStarted = true;
                }
                content += token;
                contentEl.innerHTML = content.replace(/\\n\\n/g, "<br><br>");
              }
            } catch (e) {}
          }
        }

        // Stream ended cleanly but never sent a token — treat as stall
        if (!streamStarted) {
          stopThinking();
          contentEl.textContent = "No response came through. Try sending again.";
        }

      } catch (err) {
        stopThinking();
        contentEl.textContent = "Something went wrong. Try again.";
      }

      // Always re-enable input when done
      sendBtn.disabled = false;
      inputEl.focus();
    }

    sendBtn.addEventListener("click", handleQuery);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleQuery();
      }
    });
  }

  document.addEventListener("nav", init);
  init();
})();
`

export default (() => SynergeticsAI) satisfies QuartzComponentConstructor