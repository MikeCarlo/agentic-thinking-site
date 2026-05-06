// components.jsx — shared UI primitives

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ── Router (hash-based) ─────────────────────────────────────────────── */
function useHashRoute() {
  const parse = () => {
    const h = (window.location.hash || "#/").replace(/^#/, "");
    const parts = h.split("/").filter(Boolean);
    if (parts.length === 0) return { name: "home" };
    if (parts[0] === "ep" && parts[1]) return { name: "episode", slug: parts[1], tab: parts[2] };
    if (parts[0] === "archive") return { name: "archive" };
    if (parts[0] === "about") return { name: "about" };
    if (parts[0] === "subscribe") return { name: "subscribe" };
    return { name: "home" };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
const go = (path) => { window.location.hash = path; };

/* ── Window chrome ───────────────────────────────────────────────────── */
function Win({ path, status = "active", children, bodyStyle, bodyClass = "" }) {
  return (
    <section className="win">
      <div className="win__bar">
        <span className="win__title"><b>{path}</b></span>
        {status && <span className="win__status">{status}</span>}
      </div>
      <div className={`win__body ${bodyClass}`} style={bodyStyle}>{children}</div>
    </section>
  );
}

/* ── Topnav ──────────────────────────────────────────────────────────── */
function TopNav({ route }) {
  const is = (n) => route.name === n ? "active" : "";
  return (
    <nav className="topnav">
      <div className="topnav__brand">
        <b>AGENTIC_THINKING</b>
        <span className="sep">›</span>
        <span className="topnav__path">podcast/intelligence/agents</span>
      </div>
      <div className="topnav__nav">
        <a href="#/" className={is("home")}>home</a>
        <a href="#/archive" className={is("archive")}>episodes</a>
        <a href="#/about" className={is("about")}>hosts</a>
        <a href="#/subscribe" className={is("subscribe")}>subscribe</a>
      </div>
    </nav>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */
function Foot() {
  return (
    <footer className="foot">
      <div>
        <span className="dim">© 2026</span> agentic_thinking
        <span className="muted-sep">·</span>
        <span className="dim">built in the terminal</span>
      </div>
      <div>
        <a href="#/subscribe">rss</a>
        <span className="muted-sep">·</span>
        <a href="#" onClick={(e) => e.preventDefault()}>youtube</a>
        <span className="muted-sep">·</span>
        <a href="#" onClick={(e) => e.preventDefault()}>apple</a>
        <span className="muted-sep">·</span>
        <a href="#" onClick={(e) => e.preventDefault()}>spotify</a>
        <span className="muted-sep">·</span>
        <span className="kbd-hint">press <kbd>⌘K</kbd></span>
      </div>
    </footer>
  );
}

/* ── Toast ──────────────────────────────────────────────────────────── */
function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  };
  const node = msg ? <div className="toast">{msg}</div> : null;
  return [show, node];
}

/* ── CLI Palette ─────────────────────────────────────────────────────── */
function CLIPalette({ open, onClose, onToast }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef();

  useEffect(() => {
    if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  const commands = useMemo(() => {
    return [
      { group: "cmd", k: "goto home",      h: "back to homepage",    run: () => { go("/"); onClose(); } },
      { group: "cmd", k: "goto archive",   h: "full episode index",  run: () => { go("/archive"); onClose(); } },
      { group: "cmd", k: "goto hosts",     h: "about the hosts",     run: () => { go("/about"); onClose(); } },
      { group: "cmd", k: "goto subscribe", h: "rss + newsletter",    run: () => { go("/subscribe"); onClose(); } },
      { group: "cmd", k: "latest",         h: "play newest episode", run: () => { go(`/ep/${window.EPISODES[0].slug}`); onClose(); } },
      { group: "cmd", k: "theme toggle",   h: "dark / light",        run: () => {
        const r = document.documentElement;
        r.dataset.theme = r.dataset.theme === "light" ? "dark" : "light";
        onToast(`theme → ${r.dataset.theme}`); onClose();
      } },
      { group: "cmd", k: "copy rss",    h: "/feed.xml to clipboard", run: () => {
        navigator.clipboard?.writeText("https://agentic-thinking.dev/feed.xml");
        onToast("rss url copied"); onClose();
      } },
    ];
  }, [onClose, onToast]);

  // Highlight a substring (case-insensitive) — returns array with <mark>.
  const hl = (text, Q) => {
    if (!Q) return text;
    const i = text.toLowerCase().indexOf(Q);
    if (i < 0) return text;
    return <>
      {text.slice(0, i)}
      <mark style={{background: "color-mix(in oklch, var(--accent) 35%, transparent)", color: "var(--fg)", padding: "0 2px", borderRadius: 2}}>{text.slice(i, i + Q.length)}</mark>
      {text.slice(i + Q.length)}
    </>;
  };

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase();

    // No query → show commands + all episodes.
    if (!Q) {
      const eps = window.EPISODES.map((e) => ({
        group: "episode",
        k: `ep${String(e.n).padStart(2,"0")} · ${e.title}`,
        h: e.blurb,
        run: () => { go(`/ep/${e.slug}`); onClose(); },
      }));
      return [...commands, ...eps];
    }

    // Command matches
    const cmdHits = commands
      .filter((c) => (c.k + " " + c.h).toLowerCase().includes(Q))
      .map((c) => ({ ...c, label: c.k, sub: c.h }));

    // Episode matches: title, blurb, tags, guest
    const epHits = [];
    window.EPISODES.forEach((e) => {
      const hay = (e.title + " " + e.blurb + " " + e.tags.join(" ") + " " + e.guest).toLowerCase();
      if (hay.includes(Q)) {
        epHits.push({
          group: "episode",
          label: <>ep{String(e.n).padStart(2,"0")} · {hl(e.title, Q)}</>,
          sub: hl(e.tags.join(", "), Q),
          run: () => { go(`/ep/${e.slug}`); onClose(); },
        });
      }
    });

    // Transcript matches: scan the current episode's transcript for the query
    const trHits = [];
    const latest = window.EPISODES[0];
    (window.TRANSCRIPT || []).forEach((row) => {
      if (row.text.toLowerCase().includes(Q)) {
        trHits.push({
          group: "transcript",
          label: <>ep{String(latest.n).padStart(2,"0")} @ <span style={{color: "var(--accent)"}}>{fmtClock(row.t)}</span></>,
          sub: <>{row.s === "host_a" ? "ren: " : row.s === "host_b" ? "joss: " : "guest: "}{hl(row.text, Q)}</>,
          run: () => {
            window.location.hash = `#/ep/${latest.slug}`;
            // Give the episode page a tick to mount, then dispatch seek.
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("at:seek", { detail: { t: row.t } }));
            }, 120);
            onClose();
          },
        });
      }
    });

    return [...cmdHits, ...epHits, ...trHits];
  }, [q, commands, onClose]);

  // Normalize command items to same label/sub shape for rendering
  const rows = useMemo(() => {
    return filtered.map((item) => ({
      group: item.group,
      label: item.label ?? item.k,
      sub: item.sub ?? item.h,
      run: item.run,
    }));
  }, [filtered]);

  useEffect(() => { setIdx(0); }, [q]);

  const onKey = (e) => {
    if (e.key === "Escape") { onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter")     { e.preventDefault(); rows[idx]?.run(); }
  };

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(".cli__item.active");
    el?.scrollIntoView?.({ block: "nearest" });
  }, [idx, open, rows.length]);

  if (!open) return null;

  // Group header labels
  const groupLabel = { cmd: "commands", episode: "episodes", transcript: "transcript hits" };
  let lastGroup = null;

  return (
    <div className="cli-scrim" onClick={onClose}>
      <div className="cli" onClick={(e) => e.stopPropagation()}>
        <div className="cli__prompt">
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            className="cli__input" placeholder="search episodes + transcripts, or type a command… (e.g. 'memory', 'vector store', 'goto archive')" />
          <span className="cli__hint"><kbd>↑↓</kbd><kbd>⏎</kbd><kbd>esc</kbd></span>
        </div>
        <div className="cli__list">
          {rows.length === 0 && <div className="cli__item" style={{color: "var(--fg-mute)"}}>no matches. try a different keyword, or `goto archive`.</div>}
          {rows.map((c, i) => {
            const showHeader = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <React.Fragment key={i}>
                {showHeader && (
                  <div style={{padding: "8px 12px 4px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-mute)", letterSpacing: "0.12em", textTransform: "uppercase"}}>
                    // {groupLabel[c.group] || c.group}
                  </div>
                )}
                <button className={`cli__item ${i === idx ? "active" : ""}`}
                  onMouseEnter={() => setIdx(i)} onClick={c.run}>
                  <span><span className="k">{c.label}</span></span>
                  <span className="h">{c.sub}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { useHashRoute, go, Win, TopNav, Foot, useToast, CLIPalette });
