/**
 * 魔法サウンド
 *  - キラキラ音・パーッ!の爆発音は Web Audio API でその場で合成
 *  - BGM は audio/bgm.mp3 をループ再生
 * ブラウザの自動再生制限があるため、最初のクリック/タップ/キー操作で
 * unlock() が呼ばれてから音が出る。
 */
class MagicSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.unlocked = false;

    this.bgm = new Audio("audio/bgm.mp3");
    this.bgm.loop = true;
    this.bgm.volume = 0.35;

    // キラキラ音用ペンタトニック(C6〜E7)— どの組み合わせでも綺麗に響く
    this.chimeFreqs = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2349.3, 2637.0];

    const unlock = () => this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  /** ユーザー操作をきっかけに音声を有効化する */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") this.ctx.resume();

    if (this.enabled) {
      this.bgm.play().catch(() => {});
    }
    if (this.onUnlock) this.onUnlock();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.bgm.pause();
    } else if (this.unlocked) {
      this.bgm.play().catch(() => {});
    }
  }

  _ready() {
    return this.enabled && this.unlocked && this.ctx;
  }

  /** 1音のチャイム(ベル系)を鳴らす共通処理 */
  _chime(freq, when, peak, dur) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    // 倍音を足してガラスベルっぽく
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2.01;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const gain2 = this.ctx.createGain();
    gain2.gain.value = 0.25;

    osc.connect(gain);
    osc2.connect(gain2).connect(gain);
    gain.connect(this.master);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.05);
    osc2.stop(t + dur + 0.05);
  }

  /** 指を動かしている時のキラッという音(呼び出し側でスロットルする) */
  sparkle() {
    if (!this._ready()) return;
    const freq = this.chimeFreqs[(Math.random() * this.chimeFreqs.length) | 0];
    this._chime(freq, 0, 0.05 + Math.random() * 0.04, 0.35 + Math.random() * 0.25);
  }

  /** パーッ!と弾けた時の音(シュワーッ+上昇するベルの連鎖) */
  burst() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;

    // --- シュワーッというノイズ ---
    const dur = 0.9;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(4500, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + dur);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.4, t);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    noise.connect(bp).connect(nGain).connect(this.master);
    noise.start(t);

    // --- 低いボワンという土台 ---
    const boom = this.ctx.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(180, t);
    boom.frequency.exponentialRampToValueAtTime(55, t + 0.5);
    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.3, t);
    bGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    boom.connect(bGain).connect(this.master);
    boom.start(t);
    boom.stop(t + 0.7);

    // --- 上昇しながら散らばるベルの連鎖 ---
    for (let i = 0; i < 8; i++) {
      const freq = this.chimeFreqs[Math.min(i, this.chimeFreqs.length - 1)];
      this._chime(freq * (1 + Math.random() * 0.02), 0.03 + i * 0.05, 0.12, 0.6);
    }
  }
}
