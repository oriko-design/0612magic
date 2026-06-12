/**
 * マジックフィンガー
 * MediaPipe Hands でカメラに映った手を検出し、
 *  - 人差し指の先に魔法のキラキラ軌跡を描く
 *  - 手をパーに開いた瞬間「パーッ!!」と魔法が弾ける
 */
(() => {
  const video = document.getElementById("video");
  const canvas = document.getElementById("magic-canvas");
  const statusEl = document.getElementById("status");
  const loadingEl = document.getElementById("loading");
  const clearBtn = document.getElementById("clear-btn");
  const soundBtn = document.getElementById("sound-btn");

  const magic = new MagicParticles(canvas);
  const sound = new MagicSound();

  let soundOn = true;
  soundBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // OFF にした直後に保険のリスナーで再生が再開しないように
    soundOn = !soundOn;
    sound.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? "🔊 BGM ON" : "🔇 BGM OFF";
  });

  function resize() {
    magic.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  clearBtn.addEventListener("click", () => magic.clear());

  // ---- 手ごとの状態(最大2つ) ----
  // prevTip: 前フレームの指先座標 / openState: パー判定の状態遷移用
  const handStates = [
    { prevTip: null, open: false, lastBurst: 0 },
    { prevTip: null, open: false, lastBurst: 0 },
  ];
  const BURST_COOLDOWN_MS = 1200;

  /** MediaPipe の正規化座標 → 画面座標(鏡映し) */
  function toScreen(lm) {
    return {
      x: (1 - lm.x) * canvas.width,
      y: lm.y * canvas.height,
    };
  }

  /**
   * 手がパー(全指を開いている)かどうか判定。
   * 各指の指先が第二関節より手首から遠ければ「伸びている」とみなす。
   */
  function isHandOpen(lm) {
    const wrist = lm[0];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

    // 人差し指・中指・薬指・小指: tip vs pip
    const fingers = [
      [8, 6],
      [12, 10],
      [16, 14],
      [20, 18],
    ];
    let extended = 0;
    for (const [tip, pip] of fingers) {
      if (dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.1) extended++;
    }
    // 親指: 先端が人差し指の付け根から十分離れているか
    const thumbOpen = dist(lm[4], lm[5]) > dist(lm[2], lm[5]) * 0.8;

    return extended === 4 && thumbOpen;
  }

  /** 手のひらの中心(手首と中指付け根の中間あたり) */
  function palmCenter(lm) {
    const ids = [0, 5, 9, 13, 17];
    let x = 0;
    let y = 0;
    for (const i of ids) {
      x += lm[i].x;
      y += lm[i].y;
    }
    return toScreen({ x: x / ids.length, y: y / ids.length });
  }

  let handsVisible = 0;

  function onResults(results) {
    const list = results.multiHandLandmarks || [];
    handsVisible = list.length;

    for (let h = 0; h < handStates.length; h++) {
      const state = handStates[h];
      const lm = list[h];

      if (!lm) {
        state.prevTip = null;
        state.open = false;
        continue;
      }

      const tip = toScreen(lm[8]); // 人差し指の先
      const open = isHandOpen(lm);

      // --- パーッ!! 判定(閉→開の瞬間に発動) ---
      const now = performance.now();
      if (open && !state.open && now - state.lastBurst > BURST_COOLDOWN_MS) {
        const center = palmCenter(lm);
        magic.burst(center.x, center.y);
        state.lastBurst = now;
      }
      state.open = open;

      if (open) {
        // パーの間は手のひらからオーラを漂わせ、軌跡は描かない
        const center = palmCenter(lm);
        magic.emitAura(center.x, center.y, 80);
        state.prevTip = null;
      } else {
        // 指先の軌跡にキラキラを撒く
        if (state.prevTip) {
          magic.emitTrail(state.prevTip.x, state.prevTip.y, tip.x, tip.y);
        } else {
          magic.emitTrail(tip.x, tip.y, tip.x, tip.y);
        }
        state.prevTip = tip;
      }
    }
  }

  // ---- 描画ループ(手検出とは独立して常に回す) ----
  function renderLoop() {
    magic.update();
    if (soundOn && !sound.playing) {
      // 自動再生がブロックされている場合のみ案内を出す
      statusEl.textContent = "🎵 音楽が流れない時は画面をクリックしてね";
    } else {
      statusEl.textContent =
        handsVisible > 0
          ? `🖐 手を検出中 (${handsVisible}) — 指で魔法を描こう!`
          : "カメラに手をかざしてね";
    }
    requestAnimationFrame(renderLoop);
  }

  // ---- MediaPipe Hands 初期化 ----
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 1280,
    height: 720,
  });

  camera
    .start()
    .then(() => {
      loadingEl.classList.add("hidden");
      sound.tryPlay(); // カメラ起動のタイミングでも自動再生を再試行
      renderLoop();
    })
    .catch((err) => {
      loadingEl.querySelector("p").innerHTML =
        "カメラを起動できませんでした 😢<br /><small>カメラの使用を許可して、ページを再読み込みしてください</small>";
      loadingEl.querySelector(".spinner").style.display = "none";
      console.error(err);
    });
})();
