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
  font-weight: $boldWeight;
}

.query-text {
  font-size: 1.618rem;
  font-weight: $boldWeight;
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

.answer-content p {
  margin: 0 0 1rem;
}

.answer-content p:last-child {
  margin-bottom: 0;
}

.answer-content h1,
.answer-content h2,
.answer-content h3,
.answer-content h4 {
  margin: 1.4rem 0 0.5rem;
  line-height: 1.3;
  font-weight: $boldWeight;
}

.answer-content h1 { font-size: 1.382rem; }
.answer-content h2 { font-size: 1.2rem; }
.answer-content h3 { font-size: 1.05rem; }

.answer-content ul,
.answer-content ol {
  padding-left: 1.5rem;
  margin: 0.75rem 0;
}

.answer-content li {
  margin-bottom: 0.382rem;
}

.answer-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  font-size: 0.9rem;
}

.answer-content th,
.answer-content td {
  border: 1px solid var(--lightgray);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.answer-content th {
  font-weight: $boldWeight;
  color: var(--darkgray);
  background: var(--lightgray);
}

.answer-content tr:nth-child(even) td {
  background: color-mix(in srgb, var(--light) 60%, transparent);
}

.answer-content code {
  font-family: var(--codeFont, monospace);
  font-size: 0.875em;
  background: var(--lightgray);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.answer-content pre {
  background: var(--lightgray);
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
  margin: 1rem 0;
}

.answer-content pre code {
  background: none;
  padding: 0;
  font-size: 0.875rem;
}

.answer-content blockquote {
  border-left: 3px solid var(--lightgray);
  margin: 1rem 0;
  padding: 0.25rem 1rem;
  color: var(--gray);
  font-style: italic;
}

.answer-content strong { font-weight: $boldWeight; }
.answer-content em { font-style: italic; }

.answer-content hr {
  border: none;
  border-top: 1px solid var(--lightgray);
  margin: 1.2rem 0;
}

.thinking-status {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  color: var(--gray);
  font-size: 0.875rem;
  font-style: normal;
}

.thinking-message {
  transition: opacity 0.4s ease;
}

.thinking-message.fade {
  opacity: 0;
}

/* Copy Button Styles */
.copy-action-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.618rem;
}

.copy-dialogue-btn {
  display: flex;
  align-items: center;
  gap: 0.382rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--gray);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.382rem 0.618rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.copy-dialogue-btn:hover {
  color: var(--dark);
  background: var(--light);
  border-color: var(--lightgray);
}

.copy-dialogue-btn.success {
  color: var(--dark);
}
`

SynergeticsAI.afterDOMLoaded = `
(function() {

  const WORKER_URL = "https://synergetics-worker.rohanshu.workers.dev";

  // Load marked.js for proper markdown rendering
  if (!window.__markedLoaded) {
    window.__markedLoaded = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js";
      script.onload = () => {
        marked.setOptions({ breaks: true, gfm: true });
        resolve(marked);
      };
      document.head.appendChild(script);
    });
  }

  function renderMarkdown(text) {
    if (window.marked) return window.marked.parse(text);
    // fallback while marked loads
    return text
      .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")
      .replace(/\\n\\n/g, "<br><br>")
      .replace(/\\n/g, "<br>");
  }

  const PLACEHOLDER_MESSAGES = [
    "Type your question here",
  ];

  const THINKING_MESSAGES = {
    early: [
      "thinking... ",
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

function tryInit(attempts = 0) {
  const inputEl = document.getElementById("chat-input");
  if (!inputEl) {
    if (attempts < 10) setTimeout(() => tryInit(attempts + 1), 50);
    return;
  }
  if (inputEl._bound) return;
  inputEl._bound = true;

const outputEl = document.getElementById("chat-output");
const sendBtn  = document.getElementById("chat-send");

if (!outputEl || !sendBtn) return;

    inputEl.placeholder = PLACEHOLDER_MESSAGES[Math.floor(Math.random() * PLACEHOLDER_MESSAGES.length)];

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

    const MSG_INTERVAL = 8;
    let masterInterval = null;
    let pendingFade = null;

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
        if (pendingFade) return;
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
          <span class="thinking-message">\${firstMsg}</span>
        </div>
      \`;

      const msgEl = contentEl.querySelector(".thinking-message");

      masterInterval = setInterval(() => {
        seconds++;
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
          return;
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

    async function handleQuery() {
      const query = inputEl.value.trim();
      if (!query || sendBtn.disabled) return;

      inputEl.value = "";
      inputEl.style.height = baseHeight + "px";
      inputEl.style.overflowY = "hidden";
      sendBtn.disabled = true;

      // Injected copy button starts hidden (opacity 0, pointer-events none)
      outputEl.innerHTML = \`
        <div class="query-label">Question</div>
        <div class="query-text">\${query}</div>
        <div class="query-label">Answer</div>
        <div class="answer-content"></div>
        <div class="copy-action-wrapper" style="opacity: 0; pointer-events: none; transition: opacity 0.4s ease;">
          <button class="copy-dialogue-btn" aria-label="Copy Response">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Response</span>
          </button>
        </div>
      \`;

      const contentEl = outputEl.querySelector(".answer-content");
      const copyWrapper = outputEl.querySelector(".copy-action-wrapper");
      const copyBtn = outputEl.querySelector(".copy-dialogue-btn");

      startThinking(contentEl);

      let streamStarted = false;
      let content = "";

      try {
        const response = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer  = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const token = parsed.response;
              if (token) {
                if (!streamStarted) {
                  stopThinking();
                  contentEl.innerHTML = "";
                  streamStarted = true;
                }
                content += token;
                contentEl.innerHTML = renderMarkdown(content);
              }
            } catch (e) {}
          }
        }

        if (!streamStarted) {
          stopThinking();
          contentEl.textContent = "No response came through. Try sending again.";
        } else if (content) {
          // Reveal the copy button securely once the response is fully generated
          copyWrapper.style.opacity = "1";
          copyWrapper.style.pointerEvents = "auto";

          copyBtn.addEventListener("click", async () => {
            const clipboardText = \`Q: \${query}\\n\\nA: \${content}\`;
            try {
              await navigator.clipboard.writeText(clipboardText);
              
              copyBtn.innerHTML = \`
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied!</span>
              \`;
              copyBtn.classList.add("success");
              
              setTimeout(() => {
                copyBtn.innerHTML = \`
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Copy Response</span>
                \`;
                copyBtn.classList.remove("success");
              }, 2000);
            } catch (err) {
              console.error("Failed to copy", err);
            }
          });
        }

      } catch (err) {
        stopThinking();
        contentEl.textContent = "Something went wrong. Try again.";
      }

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

document.addEventListener("nav", () => {
  const inputEl = document.getElementById("chat-input");
  if (inputEl) inputEl._bound = false;
  tryInit();
});
tryInit();
})();
`

export default (() => SynergeticsAI) satisfies QuartzComponentConstructor