/**
 * 呪文認識
 * Web Speech API(ブラウザ内蔵の音声認識)でマイクの音声を拾い、
 * 「ビビディバビディブー」と聞こえたらコールバックを呼ぶ。
 * 認識結果の揺れ(ビビデバビデブー等)も拾えるようゆるめに判定する。
 */
class SpellListener {
  /**
   * @param {(spell: string) => void} onSpell 呪文を検出した時に呼ばれる
   */
  constructor(onSpell) {
    this.onSpell = onSpell;
    this.recognition = null;
    this.running = false;
    this.lastFire = 0;
    this.cooldownMs = 4000;
  }

  /** ブラウザが音声認識に対応していれば true */
  static supported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start() {
    if (!SpellListener.supported() || this.recognition) return;

    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true; // 言い終わる前から判定してレスポンスを良くする

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (this._isSpell(text)) {
          const now = performance.now();
          if (now - this.lastFire > this.cooldownMs) {
            this.lastFire = now;
            this.onSpell(text);
          }
        }
      }
    };

    // 無音などで勝手に止まるので、止まったら再開し続ける
    rec.onend = () => {
      if (this.running) {
        try {
          rec.start();
        } catch (_) {
          setTimeout(() => this.running && rec.start(), 500);
        }
      }
    };
    rec.onerror = (e) => {
      // マイク拒否などの致命的エラー時は再起動を諦める
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.running = false;
      }
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
   * ひらがな→カタカナに揃え、空白・伸ばし棒・句読点を除いた上で、
   * 「ビビ(ディ/デ/リ/ジ)…バビ(ディ/デ/リ/ジ)…ブ」の並びを探す。
   */
  _isSpell(rawText) {
    const text = rawText
      .replace(/[ぁ-ゖ]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + 0x60)
      )
      .replace(/[\s、。・,.!!??ー〜~]/g, "");

    return /[ビピ][ビピ](ディ|デ|リ|ジ|ティ)?.{0,2}[バパ][ビピ](ディ|デ|リ|ジ|ティ)?.{0,2}[ブプ]/.test(text);
  }
}
