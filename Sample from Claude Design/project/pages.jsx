// pages.jsx — page-level views (home, archive, about, subscribe, episode)

const { EPISODES, HOSTS, CHAPTERS, TRANSCRIPT } = window;

/* ── shared helpers ──────────────────────────────────────────────────── */
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }).toLowerCase();
};
const totalMins = () => Math.round(
  EPISODES.reduce((s, e) => {
    const [m, sec] = e.duration.split(":").map(Number);
    return s + (e.duration.split(":").length === 3
      ? (m * 60 + sec)
      : m + (sec || 0) / 60);
  }, 0)
);
const fmtClock = (s) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`
           : `${m}:${String(ss).padStart(2,"0")}`;
};

/* ── EpisodeRow ──────────────────────────────────────────────────────── */
function EpisodeRow({ ep }) {
  return (
    <button className="ep-row" onClick={() => go(`/ep/${ep.slug}`)}>
      <span className="ep-row__n">{String(ep.n).padStart(2,"0")}</span>
      <span>
        <div className="ep-row__title">{ep.title}</div>
        <div className="ep-row__meta">
          {ep.duration} min<span className="dot">·</span>
          {ep.tags.slice(0, 3).join(", ")}
        </div>
      </span>
      <span className="ep-row__play">play</span>
    </button>
  );
}

/* ── HomePage ────────────────────────────────────────────────────────── */
function HomePage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [showToast, toastNode] = useToast();

  const topEpisodes = EPISODES.slice(0, 4);

  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg({ kind: "err", text: "> err: invalid email. expected ^\\S+@\\S+\\.\\S+$" }); return; }
    setMsg({ kind: "ok", text: `> subscribed: ${email} → newsletter_queue(weekly)` });
    setEmail("");
  };

  const copyRss = () => {
    navigator.clipboard?.writeText("https://agentic-thinking.dev/feed.xml");
    showToast("rss url copied to clipboard");
  };

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="win hero__title-win">
          <div className="win__bar">
            <span className="win__title"><b>hero.render</b></span>
            <span className="win__status">active</span>
          </div>
          <div className="hero__title-body">
            <div>
              <div className="kicker">CLI · S2 · EP 20 live</div>
              <div className="hero__logo">
                <span>AGENTIC</span>
                <span>THINK<em>ING</em></span>
              </div>
            </div>
            <div className="hero__cta-row">
              <button className="btn btn--primary" onClick={() => go(`/ep/${EPISODES[0].slug}`)}>listen_to_latest()</button>
              <button className="btn" onClick={() => go("/archive")}>browse_episode_index</button>
            </div>
          </div>
        </div>

        <Win path="shell.about">
          <div className="hero__info-body" style={{padding: 0}}>
            <h1 className="hero__title">agentic_thinking</h1>
            <p className="hero__desc">
              CLI-native conversations on agent systems — orchestration, memory, evals, and the unglamorous infra of running LLMs in anger.
            </p>
            <div className="hero__meta">
              <span>$ status <b>streaming</b></span>
              <span className="muted-sep">|</span>
              <span>weekly</span>
              <span className="muted-sep">|</span>
              <span>long-form interviews</span>
            </div>
          </div>
        </Win>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stats__label">// now routing signal through the stack</div>
        <div className="stat"><div className="stat__k">episodes shipped</div><div className="stat__v">0{EPISODES.length}</div></div>
        <div className="stat"><div className="stat__k">avg runtime</div><div className="stat__v">48m</div></div>
        <div className="stat"><div className="stat__k">topic coverage</div><div className="stat__v">LLMs++</div></div>
      </div>

      {/* EPISODE QUEUE + INDEX */}
      <div className="two-col">
        <Win path="episode_queue.sh">
          <div className="queue">
            <div className="queue__line">$ fetch latest --topic orchestration</div>
            {topEpisodes.map((e, i) => (
              <div key={e.slug} className="queue__line">
                &rarr; Episode <b>{String(e.n).padStart(2,"0")}</b>: <em>{e.title}</em>
              </div>
            ))}
            <div className="queue__line">$ subscribe --channel youtube,spotify,apple</div>
            <div className="queue__line queue__cursor">$ </div>
          </div>
        </Win>

        <Win path="episode_index.log">
          <div className="ep-list">
            {topEpisodes.map((ep) => <EpisodeRow key={ep.slug} ep={ep} />)}
          </div>
          <div style={{marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)"}}>
            <span style={{color: "var(--accent)"}}>+</span> archive available as transcript, code notes, and operator playbooks &nbsp;·&nbsp;
            <a href="#/archive" style={{color: "var(--accent)"}}>see_all_{EPISODES.length}_episodes →</a>
          </div>
        </Win>
      </div>

      {/* SUBSCRIBE + LISTENER STATS */}
      <div className="sub-grid" style={{marginBottom: 22}}>
        <Win path="subscribe.prompt">
          <h2 className="h2">Keep the terminal open.</h2>
          <p style={{color: "var(--fg-dim)", maxWidth: "42ch"}}>
            Get new episodes, field notes, and CLI experiments in your inbox.
          </p>
          <form className="sub-form" onSubmit={submit}>
            <input className="input" type="email" placeholder="email@operator.dev"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn--primary" type="submit">subscribe()</button>
          </form>
          <div className={`sub__msg ${msg.kind}`}>{msg.text || "\u00A0"}</div>

          <div className="rss-row">
            <span>rss://</span>
            <code>agentic-thinking.dev/feed.xml</code>
            <button className="btn btn--ghost" onClick={copyRss} style={{padding: "4px 10px", fontSize: 11}}>copy</button>
          </div>
        </Win>

        <Win path="listener.stats">
          <ul className="ls-rows" style={{padding: 0, margin: 0}}>
            <li>weekly drop: <b>Tuesdays 07:00 UTC</b></li>
            <li>formats: audio, transcript, show notes</li>
            <li>audience: builders, architects, pms</li>
            <li>rss: <b>/feed.xml</b></li>
          </ul>
        </Win>
      </div>

      {/* HOSTS TEASER */}
      <Win path="hosts.md">
        <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22, alignItems: "start"}} className="hosts-teaser">
          <div>
            <h2 className="h2">Hosted by practitioners, builders, and operators working where AI meets delivery.</h2>
            <p style={{color: "var(--fg-dim)", maxWidth: "52ch"}}>
              The voice is practical: fewer buzzwords, more system diagrams, failure stories, and real implementation tradeoffs.
            </p>
          </div>
          <div style={{display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap"}}>
            <button className="chip chip--accent" onClick={() => go("/about")} style={{cursor: "pointer", padding: "10px 16px", fontSize: 12}}>[HOST_A]</button>
            <button className="chip chip--accent" onClick={() => go("/about")} style={{cursor: "pointer", padding: "10px 16px", fontSize: 12}}>[HOST_B]</button>
          </div>
        </div>
      </Win>

      {toastNode}
    </>
  );
}

/* ── ArchivePage ────────────────────────────────────────────────────── */
function ArchivePage() {
  const qFromHash = new URL(window.location.href.replace("#", "?hashq=")).searchParams;
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState([]);

  useEffect(() => {
    // crude url-param preload
    const m = window.location.hash.match(/\?q=([^&]+)/);
    if (m) setQ(decodeURIComponent(m[1]));
  }, []);

  const allTags = useMemo(() => {
    const s = new Set();
    EPISODES.forEach((e) => e.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, []);

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase();
    return EPISODES.filter((e) => {
      if (activeTags.length && !activeTags.every((t) => e.tags.includes(t))) return false;
      if (!Q) return true;
      return (e.title + " " + e.blurb + " " + e.tags.join(" ") + " " + e.guest).toLowerCase().includes(Q);
    });
  }, [q, activeTags]);

  const toggleTag = (t) => setActiveTags((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]);

  return (
    <>
      <div style={{marginBottom: 22}}>
        <div className="kicker">$ ls -la episodes/</div>
        <h1 className="h1">Episode index</h1>
        <p style={{color: "var(--fg-dim)", marginTop: 10, maxWidth: "60ch"}}>
          Every episode, searchable. Filter by topic. Click to watch.
        </p>
      </div>

      <Win path="archive.query">
        <div className="arch-bar">
          <input className="input" placeholder="grep -i 'memory|evals|orchestration'…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <span style={{fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)"}}>
            {filtered.length} / {EPISODES.length} matches
          </span>
        </div>
        <div className="tag-list">
          {allTags.map((t) => (
            <button key={t} className={`chip ${activeTags.includes(t) ? "on" : ""}`} onClick={() => toggleTag(t)}>
              #{t}
            </button>
          ))}
          {activeTags.length > 0 && (
            <button className="chip" style={{borderStyle: "dashed"}} onClick={() => setActiveTags([])}>clear</button>
          )}
        </div>
      </Win>

      <div style={{height: 14}} />

      <Win path="episode_index.full">
        <div className="ep-list">
          {filtered.length === 0 && (
            <div style={{padding: 30, textAlign: "center", color: "var(--fg-mute)", fontFamily: "var(--font-mono)"}}>
              {">"} no matches. try fewer filters.
            </div>
          )}
          {filtered.map((ep) => <EpisodeRow key={ep.slug} ep={ep} />)}
        </div>
      </Win>
    </>
  );
}

/* ── AboutPage ──────────────────────────────────────────────────────── */
function AboutPage() {
  return (
    <>
      <div style={{marginBottom: 22}}>
        <div className="kicker">$ cat hosts.md</div>
        <h1 className="h1">Hosts</h1>
      </div>
      <Win path="show_manifesto.txt">
        <p style={{fontSize: 15, color: "var(--fg-dim)", maxWidth: "62ch", lineHeight: 1.6}}>
          Agentic Thinking is a working engineer's podcast about building with LLMs in production.
          We talk to the people actually on call: the ones who chose the database, sized the context window,
          caught the runaway loop at 2am. No market forecasts. No vibes. Just architecture, tradeoffs, and failure stories.
        </p>
        <div style={{marginTop: 20, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-mute)"}}>
          <div>▸ no vendor pitches. no hot takes on AGI. no funnels.</div>
          <div>▸ show notes are full transcripts with timestamps.</div>
          <div>▸ every guest has shipped the thing they're talking about.</div>
        </div>
      </Win>
      <div style={{height: 16}} />
      <Win path="hosts/">
        <div className="hosts">
          {Object.values(HOSTS).map((h) => (
            <div key={h.handle} className="host-card">
              <span className="host-card__tag">[{h.handle}]</span>
              <div className="host-card__name">{h.name}</div>
              <div className="host-card__role">{h.role}</div>
              <div className="host-card__bio">{h.bio}</div>
              <div style={{marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 11}}>
                {h.links.map((l, i) => (
                  <div key={i} style={{color: "var(--fg-mute)"}}>
                    ▸ <a href={l.href} style={{color: "var(--accent-2)"}} onClick={(e) => e.preventDefault()}>{l.label}</a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Win>
    </>
  );
}

/* ── SubscribePage ──────────────────────────────────────────────────── */
function SubscribePage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });
  const [showToast, toastNode] = useToast();

  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setMsg({ kind: "err", text: "> err: invalid email. expected ^\\S+@\\S+\\.\\S+$" }); return; }
    setMsg({ kind: "ok", text: `> subscribed: ${email} → newsletter_queue(weekly)` });
    setEmail("");
  };

  const copyRss = () => {
    navigator.clipboard?.writeText("https://agentic-thinking.dev/feed.xml");
    showToast("rss url copied");
  };

  return (
    <>
      <div style={{marginBottom: 22}}>
        <div className="kicker">$ curl -o feed subscribe/</div>
        <h1 className="h1">Subscribe</h1>
        <p style={{color: "var(--fg-dim)", marginTop: 10, maxWidth: "60ch"}}>
          Pick your pipe. We publish everywhere a reasonable person listens.
        </p>
      </div>

      <div className="sub-grid">
        <Win path="subscribe.newsletter">
          <h2 className="h2">Weekly newsletter</h2>
          <p style={{color: "var(--fg-dim)", maxWidth: "42ch"}}>
            One email per week. New episode + the show notes we wish someone had written for us.
          </p>
          <form className="sub-form" onSubmit={submit}>
            <input className="input" type="email" placeholder="email@operator.dev"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn--primary" type="submit">subscribe()</button>
          </form>
          <div className={`sub__msg ${msg.kind}`}>{msg.text || "\u00A0"}</div>
        </Win>

        <Win path="subscribe.feed">
          <h2 className="h2">RSS + podcasts</h2>
          <ul className="ls-rows" style={{padding: 0}}>
            <li><b>Apple Podcasts</b> — <span className="dim">/at-apple</span></li>
            <li><b>Spotify</b> — <span className="dim">/at-spotify</span></li>
            <li><b>YouTube</b> — <span className="dim">/@agentic-thinking</span></li>
            <li><b>Overcast / Pocket Casts / Castro</b> — paste the rss url</li>
          </ul>
          <div className="rss-row">
            <span>rss://</span>
            <code>agentic-thinking.dev/feed.xml</code>
            <button className="btn btn--ghost" onClick={copyRss} style={{padding: "4px 10px", fontSize: 11}}>copy</button>
          </div>
        </Win>
      </div>

      {toastNode}
    </>
  );
}

Object.assign(window, { HomePage, ArchivePage, AboutPage, SubscribePage, fmtClock, fmtDate });
