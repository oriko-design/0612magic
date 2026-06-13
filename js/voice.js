/**
 * 呪文認識
 * Web Speech API(ブラウザ内蔵の音声認識)でマイクの音声を拾い、
 * 「ビビディバビディブー」と聞こえたらコールバックを呼ぶ。
 * 認識結果の揺れ(ビビデバビデブー、英語表記 bibbidi 等)もゆるめに判定する。
 */
class SpellListener {
  /**
   * @param {(spell: string) => void} onSpell 呪文を検出した時に呼ばれる
   * @param {(text: string) => void} [onHeard] 何か聞き取るたびに呼ばれる(画面表示用)
   * @param {(msg: string) => void} [onStatus] エラーなどの状態通知
   */
  constructor(onSpell, onHeard, onStatus) {
    this.onSpell = onSpell;
    this.onHeard = onHeard || (() => {});
    this.onStatus = onStatus || (() => {});
    this.recognition = null;
    this.running = false;
    this.lastFire = 0;
    this.cooldownMs = 4000;
  }

  /** ブラウザが音声認識に対応していれば true */
  static supported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  async start() {
    if (this.recognition) return;
    if (!SpellListener.supported()) {
      this.onStatus("このブラウザは音声認識に対応していません(Chrome / Edge で呪文が使えます)");
      return;
    }

    // 先にマイク許可を明示的に取っておく(許可ダイアログを確実に出すため)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // 許可だけ貰ってすぐ解放
    } catch (err) {
      this.onStatus("マイクが使えないため呪文は無効です(マイクを許可してね)");
      console.warn("[SpellListener] mic permission error:", err);
      return;
    }

    this._startRec();
  }

  _startRec() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true; // 言い終わる前から判定してレスポンスを良くする
    rec.maxAlternatives = 3;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        // 候補すべてをチェック(第1候補だけだと取りこぼすことがある)
        for (let j = 0; j < result.length; j++) {
          const text = result[j].transcript;
          if (j === 0 && text.trim()) {
            this.onHeard(text.trim());
            console.log("[SpellListener] heard:", text);
          }
          if (this._isSpell(text)) {
            const now = performance.now();
            if (now - this.lastFire > this.cooldownMs) {
              this.lastFire = now;
              this.onSpell(text);
            }
          }
        }
      }
    };

    // 無音などで勝手に止まるので、止まったら再開し続ける
    rec.onend = () => {
      if (this.running) {
        setTimeout(() => {
          if (!this.running) return;
          try {
            rec.start();
          } catch (_) {
            /* 二重 start は無視 */
          }
        }, 250);
      }
    };
    rec.onerror = (e) => {
      console.warn("[SpellListener] error:", e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.running = false;
        this.onStatus("マイクが使えないため呪文は無効です(マイクを許可してね)");
      } else if (e.error === "network") {
        this.onStatus("音声認識サービスに接続できません(Chrome / Edge 推奨)");
      }
      // "no-speech" や "aborted" は onend → 自動再開に任せる
    };

    this.recognition = rec;
    this.running = true;
    try {
      rec.start();
    } catch (_) {
      /* 二重 start などは無視 */
    }
  }

  /**
   * 「ビビディバビディブー」っぽいかを判定。
   * ひらがな→カタカナに揃え、空白・伸ばし棒・句読点を除いた上でゆるくマッチ。
   * 英語認識された場合(bibbidi bobbidi boo)も拾う。
   */
  _isSpell(rawText) {
    const text = rawText
      .replace(/[ぁ-ゖ]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + 0x60)
      )
      .replace(/[\s、。・,..!!??ー〜~-]/g, "");

    // カタカナ: ビビ(ディ)バビ(ディ)ブ の骨格。間に多少のゴミを許す
    if (/[ビピ][ビピ](ディ|デ|リ|ジ|ティ|チ)?.{0,3}[バパ][ビピ](ディ|デ|リ|ジ|ティ|チ)?.{0,3}[ブプボ]/.test(text)) {
      return true;
    }
    // 「バビディブ」だけでも後半が合っていれば発動(聞き取り落ち対策)
    if (/[バパ][ビピ](ディ|デ|リ|ジ).{0,3}[ブプ]ー?/.test(text) && /[ビピ][ビピ]/.test(text)) {
      return true;
    }
    // 英語・ローマ字認識対策
    const en = rawText.toLowerCase().replace(/[^a-z]/g, "");
    return /b[iy]b+[iey]?d[iy]/.test(en) || /bob+[iey]?d[iy]/.test(en);
  }
}
