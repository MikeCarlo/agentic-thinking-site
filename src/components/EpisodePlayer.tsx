import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToast } from './Toast';

interface Chapter {
  t: number;
  label: string;
}

interface TranscriptRow {
  t: number;
  s: string;
  text: string;
}

export interface EpisodeData {
  title: string;
  episodeNumber: number;
  youtubeId: string;
  duration: string;
  blurb: string;
  tags: string[];
  guest?: string;
  guestRole?: string;
  chapters: Chapter[];
  transcript: TranscriptRow[];
}

interface Props {
  episode: EpisodeData;
  showNotes?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function fmtClock(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
}

export default function EpisodePlayer({ episode, showNotes }: Props) {
  const [tab, setTab] = useState<'chapters' | 'transcript' | 'notes'>('transcript');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notesHtml, setNotesHtml] = useState(showNotes || '');
  const [showToast, toastNode] = useToast();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const { chapters, transcript } = episode;

  // Read server-rendered show notes from the hidden DOM element on mount.
  // Astro renders <div id="show-notes-content"> server-side (SSG), so the
  // content is always present in the DOM by the time React hydrates.
  useEffect(() => {
    if (!showNotes) {
      const el = document.getElementById('show-notes-content');
      if (el?.innerHTML?.trim()) setNotesHtml(el.innerHTML);
    }
  }, []);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function createPlayer() {
    if (!containerRef.current) return;
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId: episode.youtubeId,
      playerVars: {
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
      },
      events: {
        onReady: () => {
          // If we arrived here from a CLIPalette transcript search, seek + play
          const raw = sessionStorage.getItem('at_pending_seek');
          if (raw) {
            try {
              const { t: seekT } = JSON.parse(raw);
              sessionStorage.removeItem('at_pending_seek');
              playerRef.current.seekTo(seekT, true);
              playerRef.current.playVideo();
              setT(seekT);
              setPlaying(true);
            } catch {
              sessionStorage.removeItem('at_pending_seek');
            }
          }
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
            startPolling();
          } else {
            setPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        },
      },
    });
  }

  function startPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setT(Math.floor(playerRef.current.getCurrentTime()));
      }
    }, 500);
  }

  const seekTo = useCallback((sec: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(sec, true);
      playerRef.current.playVideo();
    }
    setT(sec);
    setPlaying(true);
    showToast(`seek → ${fmtClock(sec)}`);
  }, [showToast]);

  // Listen for cross-component seek events (from CLIPalette)
  useEffect(() => {
    const on = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.t === 'number') seekTo(detail.t);
    };
    window.addEventListener('at:seek', on);
    return () => window.removeEventListener('at:seek', on);
  }, [seekTo]);

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

  // Auto-scroll transcript
  useEffect(() => {
    if (tab !== 'transcript') return;
    const el = transcriptRef.current?.querySelector('.tr.active') as HTMLElement;
    if (el && transcriptRef.current) {
      const container = transcriptRef.current;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      if (eRect.top < cRect.top + 40 || eRect.bottom > cRect.bottom - 40) {
        container.scrollTo({ top: el.offsetTop - container.offsetTop - 120, behavior: 'smooth' });
      }
    }
  }, [activeTranscriptIdx, tab]);

  return (
    <div className="ep-body">
      {/* LEFT: player */}
      <div>
        <div className="win">
          <div className="win__bar">
            <span className="win__title"><b>player.stream</b></span>
            <span className="win__status">active</span>
          </div>
          <div className="win__body" style={{ padding: 0 }}>
            <div className="player">
              <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            </div>
            <div className="player-toolbar">
              <button
                className="btn"
                style={{ padding: '6px 10px', fontSize: 11 }}
                onClick={() => {
                  if (playing) playerRef.current?.pauseVideo();
                  else playerRef.current?.playVideo();
                }}
              >
                {playing ? '⏸ pause' : '▶ play'}
              </button>
              <span>t = <span className="time">{fmtClock(t)}</span> / {episode.duration}</span>
              <span className="muted-sep">·</span>
              <span>chapter: <span style={{ color: 'var(--fg-dim)' }}>{chapters[activeChapter]?.label || '—'}</span></span>
              <span style={{ marginLeft: 'auto' }}>
                <span className="kbd-hint">click transcript to jump →</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: chapters + transcript tabs */}
      <div>
        <div className="win">
          <div className="win__bar">
            <span className="win__title"><b>show_notes.mdx</b></span>
          </div>
          <div className="win__body">
            <div className="tabs">
              <button className={tab === 'chapters' ? 'active' : ''} onClick={() => setTab('chapters')}>chapters</button>
              <button className={tab === 'transcript' ? 'active' : ''} onClick={() => setTab('transcript')}>transcript</button>
              <button className={tab === 'notes' ? 'active' : ''} onClick={() => setTab('notes')}>notes</button>
            </div>

            {tab === 'chapters' && (
              <div className="chapters">
                {chapters.map((c, i) => (
                  <button key={i} className={`ch ${i === activeChapter ? 'active' : ''}`} onClick={() => seekTo(c.t)}>
                    <span className="t">{fmtClock(c.t)}</span>
                    <span>{c.label}</span>
                    <span style={{ color: 'var(--fg-mute)', fontSize: 10 }}>jump →</span>
                  </button>
                ))}
                {chapters.length === 0 && (
                  <div style={{ color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    No chapters available for this episode.
                  </div>
                )}
              </div>
            )}

            {tab === 'transcript' && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-mute)', marginBottom: 6 }}>
                  click any line to jump to that moment in the video
                </div>
                <div className="transcript" ref={transcriptRef}>
                  {transcript.map((row, i) => (
                    <button key={i} className={`tr ${i === activeTranscriptIdx ? 'active' : ''}`} onClick={() => seekTo(row.t)}>
                      <span className="t">{fmtClock(row.t)}</span>
                      <span className="s" data-speaker={row.s}>
                        {row.s === 'host_a' ? 'mike:' : row.s === 'host_b' ? 'mathias:' : 'guest:'}
                      </span>
                      <span className="text">{row.text}</span>
                    </button>
                  ))}
                  {transcript.length === 0 && (
                    <div style={{ color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      No transcript available for this episode.
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'notes' && (
              <div
                className="ep-notes"
                dangerouslySetInnerHTML={{ __html: notesHtml || '<p style="color:var(--fg-mute);font-family:var(--font-mono);font-size:12px">no show notes available.</p>' }}
              />
            )}
          </div>
        </div>
      </div>

      {toastNode}
    </div>
  );
}
