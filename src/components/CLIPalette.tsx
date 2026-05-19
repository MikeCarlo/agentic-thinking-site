import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface EpisodeMeta {
  slug: string;
  title: string;
  episodeNumber: number;
  blurb: string;
  tags: string[];
  duration: string;
  guest?: string;
  youtubeId: string;
  transcript?: { t: number; s: string; text: string }[];
}

interface Props {
  episodes: EpisodeMeta[];
  base: string;
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

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'color-mix(in oklch, var(--accent) 35%, transparent)', color: 'var(--fg)', padding: '0 2px', borderRadius: 2 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function CLIPalette({ episodes, base }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut — capture phase so we beat the browser's Ctrl+K (address bar search)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const navigate = useCallback((path: string) => {
    window.location.href = `${base}${path}`;
  }, [base]);

  const commands = useMemo(() => [
    { group: 'cmd', k: 'goto home', h: 'back to homepage', run: () => { navigate('/'); setOpen(false); } },
    { group: 'cmd', k: 'goto episodes', h: 'full episode index', run: () => { navigate('/episodes/'); setOpen(false); } },
    { group: 'cmd', k: 'goto hosts', h: 'about the hosts', run: () => { navigate('/about/'); setOpen(false); } },
    { group: 'cmd', k: 'goto subscribe', h: 'rss + newsletter', run: () => { navigate('/subscribe/'); setOpen(false); } },
    { group: 'cmd', k: 'latest', h: 'play newest episode', run: () => {
      const latest = episodes[0];
      if (latest) navigate(`/episodes/${latest.slug}/`);
      setOpen(false);
    }},
    { group: 'cmd', k: 'open tweaks', h: 'accent · tone · density', run: () => {
      window.dispatchEvent(new CustomEvent('at:tweaks:open'));
      setOpen(false);
    }},
    { group: 'cmd', k: 'copy rss', h: '/feed.xml to clipboard', run: () => {
      navigator.clipboard?.writeText('https://mikecarlo.github.io/agentic-thinking-site/feed.xml');
      setOpen(false);
    }},
  ], [episodes, navigate]);

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase();

    if (!Q) {
      const eps = episodes.map((e) => ({
        group: 'episode',
        label: `ep${String(e.episodeNumber).padStart(2, '0')} · ${e.title}`,
        sub: e.blurb,
        run: () => { navigate(`/episodes/${e.slug}/`); setOpen(false); },
      }));
      return [
        ...commands.map((c) => ({ group: c.group, label: c.k, sub: c.h, run: c.run })),
        ...eps,
      ];
    }

    // Command matches
    const cmdHits = commands
      .filter((c) => (c.k + ' ' + c.h).toLowerCase().includes(Q))
      .map((c) => ({ group: 'cmd', label: c.k, sub: c.h, run: c.run }));

    // Episode matches
    const epHits: { group: string; label: React.ReactNode; sub: React.ReactNode; run: () => void }[] = [];
    episodes.forEach((e) => {
      const hay = (e.title + ' ' + e.blurb + ' ' + e.tags.join(' ') + ' ' + (e.guest || '')).toLowerCase();
      if (hay.includes(Q)) {
        epHits.push({
          group: 'episode',
          label: <>ep{String(e.episodeNumber).padStart(2, '0')} · {highlight(e.title, Q)}</>,
          sub: highlight(e.tags.join(', '), Q),
          run: () => { navigate(`/episodes/${e.slug}/`); setOpen(false); },
        });
      }
    });

    // Transcript matches
    const trHits: { group: string; label: React.ReactNode; sub: React.ReactNode; run: () => void }[] = [];
    episodes.forEach((ep) => {
      (ep.transcript || []).forEach((row) => {
        if (row.text.toLowerCase().includes(Q)) {
          trHits.push({
            group: 'transcript',
            label: <>ep{String(ep.episodeNumber).padStart(2, '0')} @ <span style={{ color: 'var(--accent)' }}>{fmtClock(row.t)}</span></>,
            sub: <>{row.s === 'host_a' ? 'mike: ' : row.s === 'host_b' ? 'mathias: ' : 'guest: '}{highlight(row.text, Q)}</>,
            run: () => {
              // Store seek target before navigating — sessionStorage survives
              // the full page reload so EpisodePlayer can read it in onReady.
              sessionStorage.setItem('at_pending_seek', JSON.stringify({ t: row.t }));
              navigate(`/episodes/${ep.slug}/`);
              setOpen(false);
            },
          });
        }
      });
    });

    return [...cmdHits, ...epHits, ...trHits.slice(0, 10)];
  }, [q, commands, episodes, navigate]);

  useEffect(() => { setIdx(0); }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.run(); }
  };

  useEffect(() => {
    if (!open) return;
    const el = document.querySelector('.cli__item.active');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [idx, open, filtered.length]);

  if (!open) return null;

  const groupLabel: Record<string, string> = { cmd: 'commands', episode: 'episodes', transcript: 'transcript hits' };
  let lastGroup = '';

  return (
    <div className="cli-scrim" onClick={() => setOpen(false)}>
      <div className="cli" onClick={(e) => e.stopPropagation()}>
        <div className="cli__prompt">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            className="cli__input"
            placeholder="search episodes + transcripts, or type a command…"
          />
          <span className="cli__hint"><kbd>↑↓</kbd><kbd>⏎</kbd><kbd>esc</kbd></span>
        </div>
        <div className="cli__list">
          {filtered.length === 0 && (
            <div className="cli__item" style={{ color: 'var(--fg-mute)' }}>
              no matches. try a different keyword.
            </div>
          )}
          {filtered.map((c, i) => {
            const showHeader = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={i}>
                {showHeader && (
                  <div style={{ padding: '8px 12px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    // {groupLabel[c.group] || c.group}
                  </div>
                )}
                <button
                  className={`cli__item ${i === idx ? 'active' : ''}`}
                  onMouseEnter={() => setIdx(i)}
                  onClick={c.run}
                >
                  <span><span className="k">{c.label}</span></span>
                  <span className="h">{c.sub}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
