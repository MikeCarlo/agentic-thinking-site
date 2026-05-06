// episode.jsx — the episode detail page (player + chapters + transcript)

function EpisodePage({ slug }) {
  const ep = window.EPISODES.find((e) => e.slug === slug) || window.EPISODES[0];
  const [tab, setTab] = useState("transcript");
  const [t, setT] = useState(0);           // playback time (seconds) — simulated
  const [playing, setPlaying] = useState(false);
  const [seekKey, setSeekKey] = useState(0); // forces iframe src refresh on seek
  const playerRef = useRef();
  const transcriptRef = useRef();
  const [showToast, toastNode] = useToast();

  // Simulated playhead ticks for transcript/chapter highlighting.
  // (YouTube's iframe API would need injecting; for a prototype we simulate.)
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [playing]);

  const chapters = window.CHAPTERS;
  const transcript = window.TRANSCRIPT;

  const activeChapter = useMemo(() => {
    let a = 0;
    chapters.forEach((c, i) => { if (t >= c.t) a = i; });
    return a;
  }, [t, chapters]);

  const activeTranscriptIdx = useMemo(() => {
    let a = 0;
    transcript.forEach((c, i) => { if (t >= c.t) a = i; });
    return a;
  }, [t, transcript]);

  const seekTo = (sec) => {
    setT(sec);
    setPlaying(true);
    setSeekKey((k) => k + 1);  // reload iframe with new start param
    showToast(`seek → ${fmtClock(sec)}`);
  };

  // Listen for cross-component seek events (e.g. from the CLI palette)
  useEffect(() => {
    const on = (e) => {
      if (e.detail && typeof e.detail.t === "number") seekTo(e.detail.t);
    };
    window.addEventListener("at:seek", on);
    return () => window.removeEventListener("at:seek", on);
  }, []);

  // Auto-scroll transcript to active row
  useEffect(() => {
    if (tab !== "transcript") return;
    const el = transcriptRef.current?.querySelector(".tr.active");
    if (el) {
      const container = transcriptRef.current;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      if (eRect.top < cRect.top + 40 || eRect.bottom > cRect.bottom - 40) {
        container.scrollTo({ top: el.offsetTop - container.offsetTop - 120, behavior: "smooth" });
      }
    }
  }, [activeTranscriptIdx, tab]);

  const nextEp = window.EPISODES[window.EPISODES.findIndex((e) => e.slug === ep.slug) - 1];
  const prevEp = window.EPISODES[window.EPISODES.findIndex((e) => e.slug === ep.slug) + 1];

  return (
    <>
      <div style={{marginBottom: 14, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-mute)"}}>
        <a href="#/archive" style={{color: "var(--accent-2)"}}>← episode_index</a>
        <span className="muted-sep">·</span>
        <span>$ cat episodes/ep{String(ep.n).padStart(2,"0")}_{ep.slug.replaceAll("-","_")}.mdx</span>
      </div>

      <div className="ep-head">
        <div className="ep-head__n">{String(ep.n).padStart(2,"0")}</div>
        <div>
          <div className="ep-head__meta">
            {fmtDate(ep.date)}  ·  {ep.duration} min  ·  guest: <span style={{color: "var(--accent)"}}>{ep.guest}</span>
            {ep.guestRole && <> · <span style={{color: "var(--fg-dim)"}}>{ep.guestRole}</span></>}
          </div>
          <h1 className="ep-head__title">{ep.title}</h1>
          <p className="ep-head__blurb">{ep.blurb}</p>
          <div style={{display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap"}}>
            {ep.tags.map((tg) => <span key={tg} className="chip">#{tg}</span>)}
          </div>
        </div>
      </div>

      <div className="ep-body">
        {/* LEFT: player */}
        <div>
          <Win path={`player.stream`}>
            <div className="player" ref={playerRef}>
              <iframe
                key={seekKey}
                src={`https://www.youtube.com/embed/${ep.yt}?rel=0&modestbranding=1${t > 0 ? `&start=${Math.floor(t)}` : ""}${playing ? "&autoplay=1" : ""}`}
                title={ep.title}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="player-toolbar">
              <button className="btn" style={{padding: "6px 10px", fontSize: 11}} onClick={() => setPlaying((p) => !p)}>
                {playing ? "⏸ pause" : "▶ play"}
              </button>
              <span>t = <span className="time">{fmtClock(t)}</span> / {ep.duration}</span>
              <span className="muted-sep">·</span>
              <span>chapter: <span style={{color: "var(--fg-dim)"}}>{chapters[activeChapter].label}</span></span>
              <span style={{marginLeft: "auto"}}>
                <span className="kbd-hint">click transcript to jump →</span>
              </span>
            </div>
          </Win>

          <div style={{height: 16}} />

          <Win path="episode_nav">
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14}}>
              <div style={{opacity: prevEp ? 1 : 0.4, pointerEvents: prevEp ? "auto" : "none"}}>
                <div style={{fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)", marginBottom: 6}}>← previous</div>
                {prevEp ? (
                  <a href={`#/ep/${prevEp.slug}`} style={{color: "var(--fg)"}}>
                    <div style={{fontWeight: 500}}>EP{String(prevEp.n).padStart(2,"0")} · {prevEp.title}</div>
                  </a>
                ) : <div style={{color: "var(--fg-mute)"}}>— first episode —</div>}
              </div>
              <div style={{textAlign: "right", opacity: nextEp ? 1 : 0.4, pointerEvents: nextEp ? "auto" : "none"}}>
                <div style={{fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)", marginBottom: 6}}>next →</div>
                {nextEp ? (
                  <a href={`#/ep/${nextEp.slug}`} style={{color: "var(--fg)"}}>
                    <div style={{fontWeight: 500}}>EP{String(nextEp.n).padStart(2,"0")} · {nextEp.title}</div>
                  </a>
                ) : <div style={{color: "var(--fg-mute)"}}>— latest —</div>}
              </div>
            </div>
          </Win>
        </div>

        {/* RIGHT: chapters + transcript tabs */}
        <div>
          <Win path="show_notes.mdx">
            <div className="tabs">
              <button className={tab === "chapters" ? "active" : ""} onClick={() => setTab("chapters")}>chapters</button>
              <button className={tab === "transcript" ? "active" : ""} onClick={() => setTab("transcript")}>transcript</button>
              <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>notes</button>
            </div>

            {tab === "chapters" && (
              <div className="chapters">
                {chapters.map((c, i) => (
                  <button key={i} className={`ch ${i === activeChapter ? "active" : ""}`} onClick={() => seekTo(c.t)}>
                    <span className="t">{fmtClock(c.t)}</span>
                    <span>{c.label}</span>
                    <span style={{color: "var(--fg-mute)", fontSize: 10}}>jump →</span>
                  </button>
                ))}
              </div>
            )}

            {tab === "transcript" && (
              <>
                <div style={{fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-mute)", marginBottom: 6}}>
                  click any line to jump to that moment in the video
                </div>
                <div className="transcript" ref={transcriptRef}>
                  {transcript.map((row, i) => (
                    <button key={i} className={`tr ${i === activeTranscriptIdx ? "active" : ""}`} onClick={() => seekTo(row.t)}>
                      <span className="t">{fmtClock(row.t)}</span>
                      <span className="s" data-speaker={row.s}>
                        {row.s === "host_a" ? "ren:" : row.s === "host_b" ? "joss:" : "guest:"}
                      </span>
                      <span className="text">{row.text}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "notes" && (
              <div style={{fontSize: 13.5, lineHeight: 1.65, color: "var(--fg-dim)"}}>
                <h3 style={{fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", margin: "4px 0 10px", letterSpacing: "0.08em", textTransform: "uppercase"}}>## summary</h3>
                <p>{ep.blurb}</p>

                <h3 style={{fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", margin: "18px 0 10px", letterSpacing: "0.08em", textTransform: "uppercase"}}>## key takeaways</h3>
                <ul style={{paddingLeft: 18, listStyle: "none"}}>
                  <li>▸ Most "memory" questions are answered by a structured, append-only log — not a vector store.</li>
                  <li>▸ Vector stores are a cache, not a brain. Forget aggressively; TTLs matter.</li>
                  <li>▸ Keep episodic and semantic memory in different stores; they serve different queries.</li>
                  <li>▸ Structured scratchpads beat free-text notes-to-self during a run.</li>
                  <li>▸ Evaluate memory changes by replaying a week of traffic — not by eyeballing.</li>
                </ul>

                <h3 style={{fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent)", margin: "18px 0 10px", letterSpacing: "0.08em", textTransform: "uppercase"}}>## links</h3>
                <ul style={{paddingLeft: 18, listStyle: "none", fontFamily: "var(--font-mono)", fontSize: 12}}>
                  <li>▸ <a style={{color: "var(--accent-2)"}} href="#" onClick={(e) => e.preventDefault()}>post: "vector stores are a cache, not a brain"</a></li>
                  <li>▸ <a style={{color: "var(--accent-2)"}} href="#" onClick={(e) => e.preventDefault()}>repo: memory_harness/</a></li>
                  <li>▸ <a style={{color: "var(--accent-2)"}} href="#" onClick={(e) => e.preventDefault()}>paper: episodic retrieval, Bandura-style</a></li>
                </ul>
              </div>
            )}
          </Win>
        </div>
      </div>

      {toastNode}
    </>
  );
}

window.EpisodePage = EpisodePage;
