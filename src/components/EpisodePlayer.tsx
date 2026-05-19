import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useToast } from './Toast';
import { addCampaignParams } from '../utils/campaign';

interface Chapter {
  t: number;
  label: string;
}

interface TranscriptRow {
  t: number;
  s?: string;
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
  guestLinkedIn?: string;
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
      {/* LEFT: player + optional guest card */}
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

        {episode.guest && episode.guestLinkedIn && (
          <div className="win" style={{ marginTop: 16 }}>
            <div className="win__bar">
              <span className="win__title"><b>guest.info</b></span>
            </div>
            <div className="win__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-mute)', marginBottom: 4 }}>guest</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--fg)' }}>{episode.guest}</div>
                  {episode.guestRole && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-dim)', marginTop: 3 }}>{episode.guestRole}</div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <a
                    href={addCampaignParams(episode.guestLinkedIn!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, textDecoration: 'none' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    view on linkedin
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
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
                    <button key={i} className={`tr ${i === activeTranscriptIdx ? 'active' : ''}${row.s ? '' : ' no-s'}`} onClick={() => seekTo(row.t)}>
                      <span className="t">{fmtClock(row.t)}</span>
                      {row.s && (
                        <span className="s" data-speaker={row.s}>
                          {row.s === 'host_a' ? 'mike:' : row.s === 'host_b' ? 'mathias:' : 'guest:'}
                        </span>
                      )}
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
