/* Tiny sound kit — no audio files, all synthesised in-browser.
   Usage: import via <script src="sound.js"></script>, then call window.sfx.play("move"). */
(function () {
  const KEY = "soundOn.v1";
  let ctx = null;
  let muted = localStorage.getItem(KEY) === "off";

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // tone(freq, dur, type, gain) — single envelope-shaped tone
  function tone(freq, dur, type = "sine", peak = 0.18, attack = 0.005, release = 0.12) {
    if (muted) return;
    const ac = ensure(); if (!ac) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  // small noise burst (for losses / static)
  function noise(dur = 0.25, peak = 0.12, filterFreq = 800) {
    if (muted) return;
    const ac = ensure(); if (!ac) return;
    const t0 = ac.currentTime;
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ac.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(ac.destination);
    src.start(t0);
  }

  // Named sounds
  const sounds = {
    move:    () => tone(660, 0.06, "triangle", 0.14),
    open:    () => { tone(523, 0.08, "sine", 0.16); setTimeout(() => tone(784, 0.18, "sine", 0.18), 70); },
    correct: () => { tone(523, 0.08, "sine", 0.18); setTimeout(() => tone(659, 0.08, "sine", 0.18), 80); setTimeout(() => tone(988, 0.18, "sine", 0.2), 160); },
    wrong:   () => tone(196, 0.18, "sawtooth", 0.12),
    hint:    () => tone(880, 0.06, "sine", 0.1),
    owl:     () => { tone(294, 0.12, "triangle", 0.14); setTimeout(() => tone(220, 0.18, "triangle", 0.14), 110); },
    win:     () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, "sine", 0.2), i * 110)); },
    lose:    () => { tone(196, 0.25, "sawtooth", 0.16); noise(0.4, 0.08, 600); },
    place:   () => tone(440, 0.05, "square", 0.1),
    click:   () => tone(880, 0.03, "square", 0.08),
  };

  window.sfx = {
    play(name) { (sounds[name] || (() => {}))(); },
    setMuted(v) {
      muted = !!v;
      localStorage.setItem(KEY, muted ? "off" : "on");
    },
    isMuted() { return muted; },
  };
})();
