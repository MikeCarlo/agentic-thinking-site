import { useState, useEffect } from 'react';

interface TweakState {
  hero: string;
  accent: string;
  tone: string;
  font: string;
  density: string;
  theme: string;
  scanlines: string;
}

const DEFAULT_TWEAKS: TweakState = {
  hero: 'pixel',
  accent: 'green',
  tone: 'cool',
  font: 'mono',
  density: 'comfy',
  theme: 'dark',
  scanlines: 'on',
};

function applyTweaksToDom(t: TweakState) {
  const r = document.documentElement;
  r.dataset.hero = t.hero;
  r.dataset.accent = t.accent;
  r.dataset.tone = t.tone;
  r.dataset.font = t.font;
  r.dataset.density = t.density;
  r.dataset.theme = t.theme;
  r.dataset.scanlines = t.scanlines;
}

function Seg({ k, options, tweaks, update }: {
  k: keyof TweakState;
  options: string[];
  tweaks: TweakState;
  update: (key: keyof TweakState, val: string) => void;
}) {
  return (
    <div className="tweak">
      <label>{k}</label>
      <div className="tweak__seg">
        {options.map((o) => (
          <button key={o} className={tweaks[k] === o ? 'on' : ''} onClick={() => update(k, o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const [tweaks, setTweaks] = useState<TweakState>(() => {
    if (typeof window === 'undefined') return DEFAULT_TWEAKS;
    try {
      const stored = localStorage.getItem('at_tweaks');
      return stored ? { ...DEFAULT_TWEAKS, ...JSON.parse(stored) } : DEFAULT_TWEAKS;
    } catch {
      return DEFAULT_TWEAKS;
    }
  });

  useEffect(() => {
    applyTweaksToDom(tweaks);
    try { localStorage.setItem('at_tweaks', JSON.stringify(tweaks)); } catch {}
  }, [tweaks]);

  const update = (key: keyof TweakState, val: string) => {
    setTweaks((prev) => ({ ...prev, [key]: val }));
  };

  if (!open) {
    return (
      <button className="tweaks-fab" onClick={() => setOpen(true)}>
        [ tweaks ]
      </button>
    );
  }

  return (
    <div className="tweaks">
      <div className="tweaks__head">
        <span>[ tweaks ]</span>
        <button onClick={() => setOpen(false)} title="close">×</button>
      </div>
      <div className="tweaks__body">
        <Seg k="hero" options={['pixel', 'editorial']} tweaks={tweaks} update={update} />
        <Seg k="accent" options={['green', 'cyan', 'magenta', 'amber']} tweaks={tweaks} update={update} />
        <Seg k="tone" options={['cool', 'warm', 'mono']} tweaks={tweaks} update={update} />
        <Seg k="font" options={['mono', 'mixed', 'editorial']} tweaks={tweaks} update={update} />
        <Seg k="density" options={['comfy', 'dense']} tweaks={tweaks} update={update} />
        <Seg k="theme" options={['dark', 'light']} tweaks={tweaks} update={update} />
        <Seg k="scanlines" options={['on', 'off']} tweaks={tweaks} update={update} />
      </div>
    </div>
  );
}
