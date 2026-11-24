/* LeadDesk website chat. Agencies add one line to their site:
 *   <script src="https://<leaddesk-api>/widget.js" data-leaddesk="<widget key>" async></script>
 * A chat button opens a small window. The first message asks for a name and phone or email (so the team can reach
 * the visitor); after that the AI or the team answers in the same window. Styles live in a shadow root, so the
 * agency's site and the widget can't break each other. */
(() => {
  const me = document.currentScript || document.querySelector("script[data-leaddesk]")
  const key = me && me.dataset.leaddesk
  if (!key || window.__leaddesk) return
  window.__leaddesk = true
  const api = `${new URL(me.src).origin}/widget/${encodeURIComponent(key)}`
  const store = `leaddesk:${key}`
  let visitor = localStorage.getItem(store)
  if (!visitor) {
    visitor = crypto.randomUUID()
    localStorage.setItem(store, visitor)
  }

  const host = document.createElement("div")
  const root = host.attachShadow({ mode: "open" })
  root.innerHTML = `
    <style>
      :host { all: initial; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2430 }
      * { box-sizing: border-box }
      button, input, textarea { font: inherit }
      .open { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; width: 56px; height: 56px; border: 0;
        border-radius: 50%; background: #2952e3; color: #fff; cursor: pointer; box-shadow: 0 6px 20px rgb(0 0 0 / .2) }
      .open svg { width: 26px; height: 26px }
      .panel { position: fixed; right: 20px; bottom: 88px; z-index: 2147483000; width: min(370px, calc(100vw - 32px));
        height: min(540px, calc(100vh - 120px)); display: none; flex-direction: column; background: #fff;
        border-radius: 16px; box-shadow: 0 12px 40px rgb(0 0 0 / .22); overflow: hidden }
      .panel.on { display: flex }
      header { padding: 14px 16px; background: #2952e3; color: #fff; display: flex; align-items: center; gap: 8px }
      header b { flex: 1 } header button { background: none; border: 0; color: #fff; cursor: pointer; font-size: 22px; line-height: 1 }
      .log { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #f6f7fb }
      .msg { max-width: 85%; padding: 9px 13px; border-radius: 14px; white-space: pre-wrap; overflow-wrap: anywhere }
      .you { align-self: flex-end; background: #2952e3; color: #fff; border-bottom-right-radius: 4px }
      .agency { align-self: flex-start; background: #fff; border: 1px solid #e3e6ef; border-bottom-left-radius: 4px }
      .hint { color: #5b6275; font-size: 13px; text-align: center; margin: auto 8px }
      form { border-top: 1px solid #e3e6ef; padding: 10px; display: grid; gap: 8px; background: #fff }
      input, textarea { width: 100%; border: 1px solid #cfd4e0; border-radius: 10px; padding: 8px 10px; color: inherit }
      input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid #2952e3; outline-offset: 2px }
      textarea { resize: none; height: 44px }
      .row { display: flex; gap: 8px } .row textarea { flex: 1 }
      .send { border: 0; border-radius: 10px; padding: 0 16px; background: #2952e3; color: #fff; cursor: pointer }
      .send:disabled { opacity: .6 }
      .err { color: #b42318; font-size: 13px; margin: 0 }
      [hidden] { display: none !important }
    </style>
    <div class="panel" role="dialog" aria-label="Chat with us">
      <header><b class="title">Chat with us</b><button class="close" aria-label="Close chat">&times;</button></header>
      <div class="log" aria-live="polite"><p class="hint">Ask about a property, prices or a visit. We usually reply in a minute.</p></div>
      <form>
        <div class="who" hidden>
          <input name="name" autocomplete="name" placeholder="Your name" aria-label="Your name" maxlength="100">
        </div>
        <div class="who" hidden>
          <input name="contact" autocomplete="tel" placeholder="Phone or email" aria-label="Phone or email" maxlength="200">
        </div>
        <div class="row">
          <textarea name="text" placeholder="Type your message" aria-label="Message" maxlength="1000" required></textarea>
          <button class="send" type="submit">Send</button>
        </div>
        <p class="err" role="alert" hidden></p>
      </form>
    </div>
    <button class="open" aria-label="Chat with us" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>
    </button>`
  document.body.appendChild(host)

  const $ = (s) => root.querySelector(s)
  const panel = $(".panel"), log = $(".log"), form = $("form"), err = $(".err"), openBtn = $(".open")
  let last = 0, started = false, timer = null

  const show = (m) => {
    const hint = log.querySelector(".hint")
    if (hint) hint.remove()
    const p = document.createElement("p")
    p.className = `msg ${m.from}`
    p.textContent = m.text // never innerHTML: replies are text
    log.appendChild(p)
    log.scrollTop = log.scrollHeight
  }
  const askWho = () => root.querySelectorAll(".who").forEach((el) => (el.hidden = started))

  async function poll() {
    try {
      const r = await fetch(`${api}/messages?visitor=${visitor}&after=${last}`)
      if (!r.ok) return
      const d = await r.json()
      started = d.started
      askWho()
      for (const m of d.messages) {
        if (m.id <= last) continue // two checks can overlap (timer and send); show each message once
        last = m.id
        show(m)
      }
    } catch {} // offline: try again on the next tick
  }

  function toggle(on) {
    panel.classList.toggle("on", on)
    openBtn.setAttribute("aria-expanded", String(on))
    clearInterval(timer)
    if (on) {
      log.scrollTop = log.scrollHeight // a returning visitor's chat was filled while hidden; open at the latest message
      poll()
      timer = setInterval(poll, 3000)
      $("textarea").focus()
    }
  }
  openBtn.onclick = () => toggle(!panel.classList.contains("on"))
  $(".close").onclick = () => toggle(false)
  fetch(api).then((r) => r.json()).then((d) => d.agency && ($(".title").textContent = d.agency)).catch(() => {})

  form.onsubmit = async (e) => {
    e.preventDefault()
    const f = new FormData(form)
    const body = { visitor, text: String(f.get("text")).trim() }
    if (!started) Object.assign(body, { name: String(f.get("name")).trim(), contact: String(f.get("contact")).trim() })
    if (!body.text) return
    const btn = $(".send")
    btn.disabled = true
    err.hidden = true
    try {
      const r = await fetch(`${api}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        err.textContent = typeof d.detail === "string" ? d.detail : "Please add your name, and a phone number or email."
        err.hidden = false
        return
      }
      form.text.value = ""
      await poll()
    } catch {
      err.textContent = "Couldn't send. Check your connection and try again."
      err.hidden = false
    } finally {
      btn.disabled = false
    }
  }
  form.text.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      form.requestSubmit()
    }
  }
  poll() // a returning visitor sees their chat; a new one gets the name and contact fields
})()
