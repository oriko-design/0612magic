/**
 * キラキラ魔法パーティクルシステム
 * 添付イメージのような「青白い光の粒(ボケ)+鋭いスパークル」を加算合成で描画する。
 */
class MagicParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.rings = [];
    this.flash = 0; // 画面全体のフラッシュ強度 (0-1)
    this.maxParticles = 3500;
    this.lastTime = performance.now();
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** 青〜白系のランダムな色相を返す */
  _pickColor() {
    const hue = 195 + Math.random() * 30; // 水色〜青
    const sat = 60 + Math.random() * 40;
    const light = 60 + Math.random() * 35;
    return { hue, sat, light };
  }

  _push(p) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  /**
   * 指先の軌跡用パーティクルを線分 (x0,y0)-(x1,y1) に沿って撒く。
   * speed が速いほど粒を増やして途切れないようにする。
   */
  emitTrail(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const count = Math.max(4, Math.min(40, Math.ceil(dist / 2.5)));

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const x = x0 + dx * t + (Math.random() - 0.5) * 8;
      const y = y0 + dy * t + (Math.random() - 0.5) * 8;
      const kind = Math.random();

      if (kind < 0.45) {
        // ボケた大きめの光球(イメージ画像の主役)
        this._push({
          type: "bokeh",
          x, y,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14 - 6,
          size: 7 + Math.random() * 26,
          life: 1,
          decay: 0.25 + Math.random() * 0.3, // 寿命 ~2.5-4秒 → 軌跡をたどれる
          color: this._pickColor(),
          alpha: 0.35 + Math.random() * 0.45,
        });
      } else if (kind < 0.82) {
        // 小さく鋭いスパークル
        this._push({
          type: "spark",
          x, y,
          vx: (Math.random() - 0.5) * 55,
          vy: (Math.random() - 0.5) * 55 - 12,
          size: 1.5 + Math.random() * 4,
          life: 1,
          decay: 0.35 + Math.random() * 0.45,
          color: this._pickColor(),
          alpha: 0.9 + Math.random() * 0.1,
          twinkle: Math.random() * Math.PI * 2,
        });
      } else {
        // 十字に光る星型フレア
        this._push({
          type: "star",
          x, y,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12 - 4,
          size: 6 + Math.random() * 13,
          life: 1,
          decay: 0.4 + Math.random() * 0.4,
          color: this._pickColor(),
          alpha: 1,
          rot: Math.random() * Math.PI,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }

    // 指先そのものを包む明るいコアの光
    this._push({
      type: "bokeh",
      x: x1,
      y: y1,
      vx: 0,
      vy: 0,
      size: 18 + Math.random() * 14,
      life: 1,
      decay: 2.2,
      color: { hue: 205, sat: 70, light: 90 },
      alpha: 0.75,
    });
  }

  /** 手のひらを開いている間、ふんわり漂うオーラ */
  emitAura(x, y, radius) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * Math.sqrt(Math.random());
      this._push({
        type: "bokeh",
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 30,
        size: 3 + Math.random() * 10,
        life: 1,
        decay: 0.7 + Math.random() * 0.5,
        color: this._pickColor(),
        alpha: 0.3 + Math.random() * 0.3,
      });
    }
  }

  /** 「パーッ」: 手のひら中心から放射状に爆発する特殊演出 */
  burst(x, y) {
    const total = 140;
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 120 + Math.random() * 520;
      const kind = Math.random();
      const base = {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.4 + Math.random() * 0.5,
        color: this._pickColor(),
        drag: 0.92, // 減速して花火のように残る
      };
      if (kind < 0.5) {
        this._push({ ...base, type: "bokeh", size: 5 + Math.random() * 18, alpha: 0.4 + Math.random() * 0.4 });
      } else if (kind < 0.85) {
        this._push({ ...base, type: "spark", size: 1.5 + Math.random() * 3.5, alpha: 1, twinkle: Math.random() * Math.PI * 2 });
      } else {
        this._push({ ...base, type: "star", size: 6 + Math.random() * 14, alpha: 1, rot: Math.random() * Math.PI, twinkle: Math.random() * Math.PI * 2 });
      }
    }

    // 広がる光のリング
    this.rings.push({ x, y, r: 10, vr: 900, life: 1, decay: 1.6 });
    this.rings.push({ x, y, r: 4, vr: 550, life: 1, decay: 1.1 });

    this.flash = 0.55;
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.flash = 0;
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";

    // --- パーティクル更新 & 描画 ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.drag) {
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 8 * dt; // ほんの少し沈む

      this._draw(p);
    }

    // --- リング描画 ---
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= ring.decay * dt;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      ring.r += ring.vr * dt;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(205, 100%, 80%, ${ring.life * 0.6})`;
      ctx.lineWidth = 6 * ring.life;
      ctx.shadowColor = "rgba(120, 190, 255, 0.9)";
      ctx.shadowBlur = 25;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // --- フラッシュ ---
    if (this.flash > 0.005) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(190, 225, 255, ${this.flash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.flash *= Math.pow(0.02, dt); // 急速に減衰
    } else {
      this.flash = 0;
    }

    ctx.globalCompositeOperation = "source-over";
  }

  _draw(p) {
    const { ctx } = this;
    const { hue, sat, light } = p.color;
    const a = p.life * p.alpha;

    if (p.type === "bokeh") {
      // 中心が白く外側が青く溶けるグラデーション円
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `hsla(${hue}, ${sat}%, 95%, ${a})`);
      g.addColorStop(0.4, `hsla(${hue}, ${sat}%, ${light}%, ${a * 0.7})`);
      g.addColorStop(1, `hsla(${hue}, ${sat}%, ${light - 20}%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "spark") {
      // チカチカまたたく明るい点
      const tw = 0.6 + 0.4 * Math.sin(p.twinkle + performance.now() * 0.02);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, `hsla(0, 0%, 100%, ${a * tw})`);
      g.addColorStop(0.3, `hsla(${hue}, 100%, 80%, ${a * tw * 0.8})`);
      g.addColorStop(1, "hsla(210, 100%, 60%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "star") {
      // 十字に伸びる光条
      const tw = 0.7 + 0.3 * Math.sin(p.twinkle + performance.now() * 0.015);
      const len = p.size * p.life * tw;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.strokeStyle = `hsla(${hue}, 80%, 92%, ${a * tw})`;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = `hsla(${hue}, 100%, 75%, ${a})`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.moveTo(0, -len);
      ctx.lineTo(0, len);
      ctx.moveTo(-len * 0.5, -len * 0.5);
      ctx.lineTo(len * 0.5, len * 0.5);
      ctx.moveTo(len * 0.5, -len * 0.5);
      ctx.lineTo(-len * 0.5, len * 0.5);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 中心の輝点
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 0.6);
      g.addColorStop(0, `hsla(0, 0%, 100%, ${a})`);
      g.addColorStop(1, "hsla(210, 100%, 70%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
