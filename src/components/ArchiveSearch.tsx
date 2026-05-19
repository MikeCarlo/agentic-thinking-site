import { useState, useMemo } from 'react';

export interface EpisodeMeta {
  slug: string;
  title: string;
  episodeNumber: number;
  blurb: string;
  tags: string[];
  duration: string;
  guest?: string;
}

interface Props {
  episodes: EpisodeMeta[];
  base: string;
}

export default function ArchiveSearch({ episodes, base }: Props) {
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    episodes.forEach((e) => e.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [episodes]);

  const filtered = useMemo(() => {
    const Q = q.trim().toLowerCase();
    return episodes.filter((e) => {
      if (activeTags.length && !activeTags.every((t) => e.tags.includes(t))) return false;
      if (!Q) return true;
      return (e.title + ' ' + e.blurb + ' ' + e.tags.join(' ') + ' ' + (e.guest || '')).toLowerCase().includes(Q);
    });
  }, [q, activeTags, episodes]);

  const toggleTag = (t: string) => setActiveTags((a) => a.includes(t) ? a.filter((x) => x !== t) : [...a, t]);

  return (
    <>
      <div className="win">
        <div className="win__bar">
          <span className="win__title"><b>archive.query</b></span>
        </div>
        <div className="win__body">
          <div className="arch-bar">
            <input
              className="input"
              placeholder="grep -i 'memory|evals|orchestration'…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-mute)' }}>
              {filtered.length} / {episodes.length} matches
            </span>
          </div>
          <div className="tag-list">
            {allTags.map((t) => (
              <button key={t} className={`chip ${activeTags.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>
                #{t}
              </button>
            ))}
            {activeTags.length > 0 && (
              <button className="chip" style={{ borderStyle: 'dashed' }} onClick={() => setActiveTags([])}>
                clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="win">
        <div className="win__bar">
          <span className="win__title"><b>episode_index.full</b></span>
        </div>
        <div className="win__body" style={{ padding: '14px 14px' }}>
          <div className="ep-list">
            {filtered.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)' }}>
                {'>'} no matches. try fewer filters.
              </div>
            )}
            {filtered.map((ep) => (
              <a key={ep.slug} href={`${base}/episodes/${ep.slug}/`} className="ep-row">
                <span className="ep-row__n">{String(ep.episodeNumber).padStart(2, '0')}</span>
                <span>
                  <div className="ep-row__title">{ep.title}</div>
                  <div className="ep-row__meta">
                    {ep.duration}<span className="dot">·</span>
                    {ep.tags.slice(0, 3).join(', ')}
                  </div>
                </span>
                <span className="ep-row__play">play</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
