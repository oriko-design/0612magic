/**
 * BGM コントローラー(効果音なし)
 * audio/bgm.mp3 をループ再生する。
 * ページを開いた直後から自動再生を試み、ブラウザの自動再生制限で
 * ブロックされた場合のみ、最初のクリック/タップ/キー操作で再生を開始する。
 */
class MagicSound {
  constructor() {
    this.enabled = true;
    this.playing = false;

    this.bgm = new Audio("audio/bgm.mp3");
    this.bgm.loop = true;
    this.bgm.volume = 0.35;
    this.bgm.addEventListener("playing", () => {
      this.playing = true;
    });
    this.bgm.addEventListener("pause", () => {
      this.playing = false;
    });

    // 自動再生がブロックされた時のための保険(成功していれば何もしない)
    const retry = () => this.tryPlay();
    window.addEventListener("pointerdown", retry);
    window.addEventListener("keydown", retry);

    // ページを開いた直後にまず試す
    this.tryPlay();
  }

  /** 再生を試みる。ブロックされても例外は握りつぶす */
  tryPlay() {
    if (!this.enabled || this.playing) return;
    this.bgm.play().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) {
      this.tryPlay();
    } else {
      this.bgm.pause();
    }
  }
}
