import { PHONE_TRACKS, game } from './config.js';

export class HorrorAudio {
  constructor() {
    this.ready = false;
    this.lastStepTime = 0;

    this.jumpscareBuffer = null;
    this.jumpscareEl = new Audio('./jumpscare.mp3');
    this.jumpscareEl.preload = 'auto';
    this.jumpscareEl.volume = 1.0;

    this.jingleBuffer = null;
    this.jingleSource = null;
    this.jingleEl = new Audio('./jingle.mp3');
    this.jingleEl.preload = 'auto';
    this.jingleEl.volume = 0.95;

    this.phoneEl = new Audio();
    this.phoneEl.preload = 'auto';
    this.phoneEl.volume = 0.95;
    this.phoneEl.addEventListener('ended', () => {
      game.phoneActive = false;
      document.getElementById('phone-box').classList.remove('active');
    });
    this.phoneEl.addEventListener('error', () => {
      game.phoneActive = false;
      document.getElementById('phone-box').classList.remove('active');
    });
  }

  async preloadCustomMP3s() {
    const decodeAsset = async (url) => {
      try {
        if (Tone.context && Tone.context.rawContext) {
          const resp = await fetch(url);
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            return await Tone.context.rawContext.decodeAudioData(arr);
          }
        }
      } catch {}
      return null;
    };

    if (!this.jumpscareBuffer) this.jumpscareBuffer = await decodeAsset('./jumpscare.mp3');
    if (!this.jingleBuffer) this.jingleBuffer = await decodeAsset('./jingle.mp3');

    try { this.jumpscareEl.load(); } catch {}
    try { this.jingleEl.load(); } catch {}
  }

  async init() {
    if (this.ready) {
      if (Tone.context.state !== 'running') await Tone.start().catch(() => {});
      return;
    }
    try {
      await Tone.start();
      this.comp = new Tone.Compressor(-18, 4).toDestination();
      this.limiter = new Tone.Limiter(-1.5).connect(this.comp);
      this.reverb = new Tone.Reverb({ decay: 3.2, wet: 0.35 }).connect(this.limiter);
      this.master = new Tone.Gain(0.88).connect(this.reverb);

      this.ambienceHum = new Tone.Oscillator(58, 'sawtooth');
      const humF = new Tone.Filter(130, 'lowpass');
      const humG = new Tone.Gain(0.035).connect(this.limiter);
      this.ambienceHum.chain(humF, humG);
      this.ambienceHum.start();

      this.ambienceNoise = new Tone.Noise('brown');
      const ambF = new Tone.Filter(195, 'lowpass');
      const ambG = new Tone.Gain(0.075).connect(this.limiter);
      this.ambienceNoise.chain(ambF, ambG);
      this.ambienceNoise.start();

      this.dreadOsc = new Tone.Oscillator(41, 'triangle');
      this.dreadGain = new Tone.Gain(0.0).connect(this.limiter);
      this.dreadOsc.connect(this.dreadGain);
      this.dreadOsc.start();

      const fanN = new Tone.Noise('pink');
      const fanF = new Tone.Filter(510, 'bandpass');
      this.fanGain = new Tone.Gain(0.0);
      this.fanLfo = new Tone.LFO(19, 0.015, 0.045).start();
      this.fanLfo.connect(this.fanGain.gain);
      fanN.chain(fanF, this.fanGain, this.limiter);
      fanN.start();

      this.lightBuzzOsc = new Tone.Oscillator(118, 'sawtooth');
      const lF = new Tone.Filter(520, 'bandpass');
      this.lightBuzzGain = new Tone.Gain(0.0).connect(this.limiter);
      this.lightBuzzOsc.chain(lF, this.lightBuzzGain);
      this.lightBuzzOsc.start();

      this.ready = true;
      this.preloadCustomMP3s();
    } catch (err) {
      console.warn('Audio init fallback:', err);
    }
  }

  preparePhoneTrack(nightNum) {
    this.stopPhoneCall();
    const url = PHONE_TRACKS[nightNum];
    if (!url) return;
    try {
      this.phoneEl.src = url;
      this.phoneEl.currentTime = 0;
      this.phoneEl.load();
    } catch {}
  }

  startPhoneCall(nightNum) {
    const url = PHONE_TRACKS[nightNum];
    if (!url || game.phoneMuted) return;
    try {
      if (!this.phoneEl.src.endsWith(url.replace('./', ''))) {
        this.phoneEl.src = url;
      }
      this.phoneEl.currentTime = 0;
      game.phoneActive = true;
      game.phoneElapsed = 0;
      const p = this.phoneEl.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          game.phoneActive = false;
          document.getElementById('phone-box').classList.remove('active');
        });
      }
    } catch {
      game.phoneActive = false;
    }
  }

  pausePhoneCall() {
    try {
      if (game.phoneActive && !this.phoneEl.paused) {
        this.phoneEl.pause();
      }
    } catch {}
  }

  resumePhoneCall() {
    try {
      if (game.phoneActive && !game.phoneMuted && this.phoneEl.paused && !this.phoneEl.ended) {
        this.phoneEl.play().catch(() => {});
      }
    } catch {}
  }

  stopPhoneCall() {
    try {
      this.phoneEl.pause();
      this.phoneEl.currentTime = 0;
    } catch {}
    game.phoneActive = false;
    document.getElementById('phone-box').classList.remove('active');
  }

  getPhoneTime() {
    try {
      return this.phoneEl.currentTime || game.phoneElapsed || 0;
    } catch {
      return game.phoneElapsed || 0;
    }
  }

  playAudioLure() {
    this.stopAudioLure();
    if (this.jingleBuffer && Tone.context && Tone.context.rawContext) {
      try {
        const ctx = Tone.context.rawContext;
        const src = ctx.createBufferSource();
        src.buffer = this.jingleBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.95;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
        this.jingleSource = src;
        src.onended = () => { if (this.jingleSource === src) this.jingleSource = null; };
        return;
      } catch {}
    }

    try {
      this.jingleEl.currentTime = 0;
      const p = this.jingleEl.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => this.playSynthLureFallback());
      }
      return;
    } catch {}

    this.playSynthLureFallback();
  }

  stopAudioLure() {
    try {
      if (this.jingleSource) {
        this.jingleSource.stop();
        this.jingleSource = null;
      }
    } catch {}
    try {
      this.jingleEl.pause();
      this.jingleEl.currentTime = 0;
    } catch {}
  }

  playSynthLureFallback() {
    if (!this.ready) return;
    try {
      const vib = new Tone.Vibrato(5, 0.25).connect(this.master);
      const chime = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.32, sustain: 0.05, release: 0.35 } }).connect(vib);
      chime.volume.value = -10;
      const notes = ['G4', 'B4', 'D5', 'B4', 'G4'];
      const now = Tone.now();
      notes.forEach((n, idx) => chime.triggerAttackRelease(n, '16n', now + idx * 0.13));
      setTimeout(() => { chime.dispose(); vib.dispose(); }, 1400);
    } catch {}
  }

  setDreadLevel(level) {
    if (!this.ready || !this.dreadGain) return;
    try { this.dreadGain.gain.rampTo(Math.max(0, level * 0.11), 0.35); } catch {}
  }

  setFanActive(active) {
    if (!this.ready || !this.fanGain) return;
    try {
      if (active) { this.fanLfo.min = 0.015; this.fanLfo.max = 0.045; }
      else { this.fanLfo.min = 0; this.fanLfo.max = 0; this.fanGain.gain.rampTo(0, 0.18); }
    } catch {}
  }

  setLightBuzz(active) {
    if (!this.ready || !this.lightBuzzGain) return;
    try { this.lightBuzzGain.gain.rampTo(active ? 0.06 : 0, 0.04); } catch {}
  }

  playDoorSlam(closing = true) {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const mem = new Tone.MembraneSynth({ pitchDecay: 0.09, octaves: 4.5, envelope: { attack: 0.003, decay: 0.36, sustain: 0 } }).connect(this.master);
      mem.volume.value = -5; mem.triggerAttackRelease(closing ? 'B0' : 'E1', '8n', now);
      const clang = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 } });
      const bp = new Tone.Filter(closing ? 600 : 950, 'bandpass').connect(this.master);
      clang.connect(bp); clang.volume.value = -9; clang.triggerAttackRelease('16n', now);
      setTimeout(() => { mem.dispose(); clang.dispose(); bp.dispose(); }, 650);
    } catch {}
  }

  playDoorBang(pan = 0) {
    if (!this.ready) return;
    try {
      const panner = new Tone.Panner(pan).connect(this.master);
      const bang = new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 5, envelope: { attack: 0.002, decay: 0.4, sustain: 0 } }).connect(panner);
      bang.volume.value = -4; bang.triggerAttackRelease('C1', '8n');
      const metal = new Tone.MetalSynth({ frequency: 190, envelope: { attack: 0.002, decay: 0.25, release: 0.1 }, harmonicity: 3.4, modulationIndex: 18 }).connect(panner);
      metal.volume.value = -10; metal.triggerAttackRelease('16n');
      setTimeout(() => { bang.dispose(); metal.dispose(); panner.dispose(); }, 700);
    } catch {}
  }

  playVentSlam() {
    if (!this.ready) return;
    try {
      const metal = new Tone.MetalSynth({ frequency: 270, envelope: { attack: 0.002, decay: 0.24, release: 0.1 }, harmonicity: 5.1, modulationIndex: 22, resonance: 1800 }).connect(this.master);
      metal.volume.value = -9; metal.triggerAttackRelease('16n');
      setTimeout(() => metal.dispose(), 500);
    } catch {}
  }

  playBiteCrunch() {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const slam = new Tone.MembraneSynth({ pitchDecay: 0.07, octaves: 5.5, envelope: { attack: 0.001, decay: 0.28, sustain: 0 } }).connect(this.limiter);
      slam.volume.value = -2; slam.triggerAttackRelease('C1', '8n', now);
      const snap = new Tone.MetalSynth({ frequency: 340, envelope: { attack: 0.001, decay: 0.16, release: 0.05 }, harmonicity: 4.8, modulationIndex: 28, resonance: 2400 }).connect(this.limiter);
      snap.volume.value = -4; snap.triggerAttackRelease('32n', now);
      const crunchNoise = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0 } }).connect(this.limiter);
      crunchNoise.volume.value = -4; crunchNoise.triggerAttackRelease('16n', now);
      setTimeout(() => { slam.dispose(); snap.dispose(); crunchNoise.dispose(); }, 600);
    } catch {}
  }

  playServoTwitch(pan = 0) {
    if (!this.ready) return;
    try {
      const panner = new Tone.Panner(pan).connect(this.master);
      const fm = new Tone.FMSynth({ harmonicity: 6.2, modulationIndex: 22, envelope: { attack: 0.005, decay: 0.12, sustain: 0 } }).connect(panner);
      fm.volume.value = -21;
      fm.triggerAttackRelease('G3', '32n');
      setTimeout(() => { fm.dispose(); panner.dispose(); }, 300);
    } catch {}
  }

  playClick(freq = 920) {
    if (!this.ready) return;
    try {
      const s = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(this.limiter);
      s.volume.value = -14; s.triggerAttackRelease(freq, '32n');
      setTimeout(() => s.dispose(), 150);
    } catch {}
  }

  playCamStatic(duration = 0.16, gainDb = -14) {
    if (!this.ready) return;
    try {
      const n = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: duration, sustain: 0 } });
      const f = new Tone.Filter(2400, 'bandpass').connect(this.limiter);
      n.connect(f); n.volume.value = gainDb; n.triggerAttackRelease(duration);
      setTimeout(() => { n.dispose(); f.dispose(); }, (duration + 0.2) * 1000);
    } catch {}
  }

  playFootstep(pan = 0, heavy = true) {
    if (!this.ready) return;
    const t = performance.now();
    if (t - this.lastStepTime < 220) return;
    this.lastStepTime = t;
    try {
      const panner = new Tone.Panner(pan).connect(this.master);
      const thud = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: heavy ? 3.8 : 2.3, envelope: { attack: 0.005, decay: 0.24, sustain: 0 } }).connect(panner);
      thud.volume.value = heavy ? -8 : -12; thud.triggerAttackRelease(heavy ? 'D1' : 'A1', '16n');
      const creak = new Tone.FMSynth({ harmonicity: 4.1, modulationIndex: 16, envelope: { attack: 0.01, decay: 0.15, sustain: 0 } }).connect(panner);
      creak.volume.value = -20; creak.triggerAttackRelease(heavy ? 'B2' : 'F#3', '32n');
      setTimeout(() => { thud.dispose(); creak.dispose(); panner.dispose(); }, 600);
    } catch {}
  }

  playFredbearLaugh() {
    if (!this.ready) return;
    try {
      const panner = new Tone.Panner(-0.55).connect(this.master);
      const lp = new Tone.Filter(480, 'lowpass').connect(panner);
      const s = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.18, sustain: 0.05, release: 0.15 } }).connect(lp);
      s.volume.value = -13;
      const now = Tone.now();
      ['G2', 'F2', 'E2', 'D2'].forEach((n, i) => s.triggerAttackRelease(n, '16n', now + i * 0.21));
      setTimeout(() => { s.dispose(); lp.dispose(); panner.dispose(); }, 1200);
    } catch {}
  }

  playRaspyBreath(pan = 0) {
    if (!this.ready) return;
    try {
      const panner = new Tone.Panner(pan).connect(this.master);
      const bp = new Tone.Filter(720, 'bandpass').connect(panner);
      bp.Q.value = 5.5;
      const n = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.18, decay: 0.55, sustain: 0.08, release: 0.35 } }).connect(bp);
      n.volume.value = -15; n.triggerAttackRelease(0.65);
      setTimeout(() => { n.dispose(); bp.dispose(); panner.dispose(); }, 1200);
    } catch {}
  }

  playVentScrape() {
    if (!this.ready) return;
    try {
      const panner = new Tone.Panner((Math.random() - 0.5) * 0.35).connect(this.master);
      const filter = new Tone.Filter(1550, 'bandpass', -12).connect(panner);
      filter.Q.value = 7;
      const scrape = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.03, decay: 0.38, sustain: 0.05, release: 0.18 } }).connect(filter);
      scrape.volume.value = -9; scrape.triggerAttackRelease(0.35);
      setTimeout(() => { scrape.dispose(); filter.dispose(); panner.dispose(); }, 900);
    } catch {}
  }

  playSpottedSting() {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const brass = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.008, decay: 0.72, sustain: 0.1, release: 0.45 } });
      const lp = new Tone.Filter(1350, 'lowpass').connect(this.master);
      brass.connect(lp); brass.volume.value = -7;
      brass.triggerAttackRelease(['C2', 'C#2', 'F#2', 'G3'], '4n', now);
      setTimeout(() => { brass.dispose(); lp.dispose(); }, 1400);
    } catch {}
  }

  playFlashBulb() {
    if (!this.ready) return;
    try {
      const osc = new Tone.Oscillator(1700, 'sine');
      const gain = new Tone.Gain(0.08).connect(this.limiter);
      osc.connect(gain); osc.frequency.exponentialRampTo(240, 0.18);
      osc.start(); gain.gain.exponentialRampTo(0.001, 0.2);
      setTimeout(() => { osc.stop(); osc.dispose(); gain.dispose(); }, 250);
    } catch {}
  }

  playPlushBoop() {
    if (!this.ready) return;
    try {
      const osc = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.12, sustain: 0 } }).connect(this.limiter);
      osc.volume.value = -8; osc.triggerAttackRelease('A5', '16n');
      setTimeout(() => osc.dispose(), 220);
    } catch {}
  }

  playHeartbeat(rate = 1) {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const hb = new Tone.MembraneSynth({ pitchDecay: 0.06, octaves: 2, envelope: { attack: 0.008, decay: 0.14, sustain: 0 } }).connect(this.limiter);
      hb.volume.value = -9;
      hb.triggerAttackRelease('C1', '16n', now);
      hb.triggerAttackRelease('B0', '16n', now + 0.16 / Math.max(0.8, rate));
      setTimeout(() => hb.dispose(), 500);
    } catch {}
  }

  playMusicBoxStep(step) {
    if (!this.ready) return;
    const melody = ['E4', 'G4', 'F#4', 'D4', 'E4', 'B3', 'C4', 'D4', 'E4', 'G4', 'A4', 'F#4'];
    try {
      const mb = new Tone.FMSynth({ harmonicity: 4, modulationIndex: 2.5, envelope: { attack: 0.002, decay: 0.58, sustain: 0 } }).connect(this.master);
      mb.detune.value = (Math.random() - 0.5) * 48; mb.volume.value = -8;
      mb.triggerAttackRelease(melody[step % melody.length], '8n');
      setTimeout(() => mb.dispose(), 850);
    } catch {}
  }

  playPhoneBeep() {
    if (!this.ready) return;
    try {
      const bp = new Tone.Filter(1200, 'bandpass').connect(this.limiter);
      const osc = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.09, sustain: 0 } }).connect(bp);
      osc.volume.value = -16; osc.triggerAttackRelease('880', '16n');
      setTimeout(() => { osc.dispose(); bp.dispose(); }, 250);
    } catch {}
  }

  playJumpscare() {
    if (this.jumpscareBuffer && Tone.context && Tone.context.rawContext) {
      try {
        const ctx = Tone.context.rawContext;
        const src = ctx.createBufferSource();
        src.buffer = this.jumpscareBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
        return;
      } catch {}
    }
    try {
      this.jumpscareEl.currentTime = 0;
      const p = this.jumpscareEl.play();
      if (p && typeof p.catch === 'function') p.catch(() => this.playSynthJumpscareFallback());
      return;
    } catch {}
    this.playSynthJumpscareFallback();
  }

  playSynthJumpscareFallback() {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const dist = new Tone.Distortion(0.88).connect(this.limiter);
      [175, 251, 398, 665, 920].forEach((freq, i) => {
        const osc = new Tone.Oscillator(freq, i % 2 === 0 ? 'sawtooth' : 'square');
        const g = new Tone.Gain(0.13).connect(dist);
        osc.connect(g);
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.5, now + 0.1);
        osc.frequency.linearRampToValueAtTime(freq * 0.78, now + 1.2);
        osc.start(now); osc.stop(now + 1.3);
        setTimeout(() => { osc.dispose(); g.dispose(); }, 1500);
      });
      const shriekNoise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.004, decay: 1.2, sustain: 0 } }).connect(dist);
      shriekNoise.volume.value = -2; shriekNoise.triggerAttackRelease(1.2, now);
      setTimeout(() => { shriekNoise.dispose(); dist.dispose(); }, 1700);
    } catch {}
  }

  play6AMChime() {
    if (!this.ready) return;
    try {
      const now = Tone.now();
      const bell = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 1.4, sustain: 0.1, release: 0.8 } }).connect(this.master);
      bell.volume.value = -6;
      ['C5', 'E5', 'G5', 'C6'].forEach((n, idx) => bell.triggerAttackRelease(n, '2n', now + idx * 0.36));
      setTimeout(() => bell.dispose(), 3000);
    } catch {}
  }
}

export const audio = new HorrorAudio();
