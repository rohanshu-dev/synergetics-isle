---
title: Ask Synergetics
---

<div id="synergetics-chat">
  <div id="chat-intro">
    <p class="chat-tagline">Ask anything about Fuller's Synergetics — tensegrity, vector equilibrium, ephemeralization, the works.</p>
  </div>
  <div id="chat-messages"></div>
  <div id="chat-input-row">
    <textarea id="chat-input" placeholder="What is the vector equilibrium?" rows="1"></textarea>
    <button id="chat-send" aria-label="Send">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    </button>
  </div>
  <p id="chat-footer">Powered by Cloudflare Workers AI · GLM 4.7 Flash · <a href="https://github.com/rohanisaac/synergetics-isle" target="_blank">Synergetics-Isle</a></p>
</div>

<style>
#synergetics-chat {
  max-width: 680px;
  margin: 2rem auto 4rem;
  font-family: var(--bodyFont, "Source Sans Pro", sans-serif);
}

.chat-tagline {
  color: var(--gray, #646464);
  font-size: 0.95rem;
  margin-bottom: 1.8rem;
  line-height: 1.6;
}

#chat-messages {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  margin-bottom: 1.6rem;
  min-height: 0;
}

.msg {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  animation: fadeUp 0.2s ease;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.msg-label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gray, #646464);
}

.msg-user .msg-label { color: var(--secondary, #284b63); }

.msg-bubble {
  padding: 0.85rem 1.1rem;
  border-radius: 10px;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--darkgray, #d4d4d4);
  background: var(--highlight, rgba(143,159,169,0.15));
  border: 1px solid var(--lightgray, #393639);
}

.msg-user .msg-bubble {
  background: transparent;
  border-color: var(--secondary, #284b63);
  color: var(--dark, #ebebec);
}

.msg-assistant .msg-bubble {
  white-space: pre-wrap;
}

.msg-bubble.thinking {
  color: var(--gray, #646464);
  font-style: italic;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--secondary, #7b97aa);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

#chat-input-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
  border: 1px solid var(--lightgray, #393639);
  border-radius: 10px;
  padding: 0.5rem 0.6rem 0.5rem 0.9rem;
  background: var(--light, #161618);
  transition: border-color 0.15s;
}

#chat-input-row:focus-within {
  border-color: var(--secondary, #7b97aa);
}

#chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--dark, #ebebec);
  line-height: 1.6;
  max-height: 160px;
  overflow-y: auto;
}

#chat-input::placeholder {
  color: var(--gray, #646464);
}

#chat-send {
  background: var(--secondary, #284b63);
  border: none;
  border-radius: 7px;
  color: #fff;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, opacity 0.15s;
}

#chat-send:hover { background: var(--tertiary, #84a59d); }
#chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

#chat-footer {
  margin-top: 0.9rem;
  font-size: 0.75rem;
  color: var(--gray, #646464);
  text-align: center;
}

#chat-footer a {
  color: var(--gray, #646464);
  text-decoration: underline;
}
</style>

<script>
(function() {
  const WORKER_URL = "https://synergetics-worker.rohanshu.workers.dev";

  const messagesEl = document.getElementById("chat-messages");
  const inputEl    = document.getElementById("chat-input");
  const sendBtn    = document.getElementById("chat-send");

  function addMessage(role, text, streaming) {
    const wrap = document.createElement("div");
    wrap.className = `msg msg-${role}`;

    const label = document.createElement("div");
    label.className = "msg-label";
    label.textContent = role === "user" ? "You" : "Synergetics";

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble" + (streaming ? " thinking" : "");
    bubble.textContent = text;

    if (streaming) {
      const cursor = document.createElement("span");
      cursor.className = "cursor";
      bubble.textContent = "";
      bubble.appendChild(cursor);
      wrap._cursor = cursor;
    }

    wrap.appendChild(label);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    wrap.scrollIntoView({ behavior: "smooth", block: "end" });
    return { wrap, bubble };
  }

  async function ask(query) {
    sendBtn.disabled = true;
    addMessage("user", query);

    const { wrap, bubble } = addMessage("assistant", "", true);
    let fullText = "";

    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error(`Worker error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      bubble.className = "msg-bubble";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const token = parsed?.response ?? "";
            fullText += token;
            // Remove cursor, set text, re-add cursor
            if (wrap._cursor) wrap._cursor.remove();
            bubble.textContent = fullText;
            if (wrap._cursor) bubble.appendChild(wrap._cursor);
          } catch {}
        }
      }
    } catch (err) {
      bubble.className = "msg-bubble thinking";
      bubble.textContent = "Something went wrong. Try again in a moment.";
      console.error(err);
    } finally {
      // Remove cursor when done
      if (wrap._cursor) wrap._cursor.remove();
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener("click", () => {
    const q = inputEl.value.trim();
    if (!q) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    ask(q);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
  });
})();
</script>