// tweaks.jsx — Tweaks panel + edit-mode protocol

function TweaksPanel({ tweaks, setTweaks, onClose }) {
  const update = (key, val) => {
    const next = { ...tweaks, [key]: val };
    setTweaks(next);
    window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { [key]: val } }, "*");
  };

  const Seg = ({ k, options }) => (
    <div className="tweak">
      <label>{k}</label>
      <div className="tweak__seg">
        {options.map((o) => (
          <button key={o} className={tweaks[k] === o ? "on" : ""} onClick={() => update(k, o)}>{o}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="tweaks">
      <div className="tweaks__head">
        <span>[ tweaks ]</span>
        <button onClick={onClose} title="close">×</button>
      </div>
      <div className="tweaks__body">
        <Seg k="hero"     options={["pixel", "editorial"]} />
        <Seg k="accent"   options={["green", "cyan", "magenta", "amber"]} />
        <Seg k="tone"     options={["cool", "warm", "mono"]} />
        <Seg k="font"     options={["mono", "mixed", "editorial"]} />
        <Seg k="density"  options={["comfy", "dense"]} />
        <Seg k="theme"    options={["dark", "light"]} />
        <Seg k="scanlines" options={["on", "off"]} />
      </div>
    </div>
  );
}

function applyTweaksToDom(t) {
  const r = document.documentElement;
  r.dataset.hero = t.hero;
  r.dataset.accent = t.accent;
  r.dataset.tone = t.tone;
  r.dataset.font = t.font;
  r.dataset.density = t.density;
  r.dataset.theme = t.theme;
  r.dataset.scanlines = t.scanlines;
}

window.TweaksPanel = TweaksPanel;
window.applyTweaksToDom = applyTweaksToDom;
