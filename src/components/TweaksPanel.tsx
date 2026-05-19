import { useState, useEffect } from 'react';

interface TweakState {
  accent: string;
  tone: string;
  density: string;
}

const DEFAULT_TWEAKS: TweakState = {
  accent: 'green',
  tone: 'cool',
  density: 'comfy',
};

function applyTweaksToDom(t: TweakState) {
  const r = document.documentElement;
  r.dataset.accent = t.accent;
  r.dataset.tone = t.tone;
  r.dataset.density = t.density;
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
      if (!stored) return DEFAULT_TWEAKS;
      const parsed = JSON.parse(stored);
      // Only restore keys still in TweakState
      return {
        accent: parsed.accent ?? DEFAULT_TWEAKS.accent,
        tone: parsed.tone ?? DEFAULT_TWEAKS.tone,
        density: parsed.density ?? DEFAULT_TWEAKS.density,
      };
    } catch {
      return DEFAULT_TWEAKS;
    }
  });

  useEffect(() => {
    applyTweaksToDom(tweaks);
    try { localStorage.setItem('at_tweaks', JSON.stringify(tweaks)); } catch {}
  }, [tweaks]);

  // Allow CLIPalette (or any other caller) to open this panel via custom event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('at:tweaks:open', handler);
    return () => window.removeEventListener('at:tweaks:open', handler);
  }, []);

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
        <Seg k="accent" options={['green', 'cyan', 'magenta', 'amber']} tweaks={tweaks} update={update} />
        <Seg k="tone" options={['cool', 'warm', 'mono']} tweaks={tweaks} update={update} />
        <Seg k="density" options={['comfy', 'dense']} tweaks={tweaks} update={update} />
      </div>
    </div>
  );
}
