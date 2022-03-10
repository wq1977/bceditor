<template>
  <div class="ruler">
    <canvas class="rulercanvas" height="100" id="ruler" />
  </div>
</template>

<script >
import { defineComponent } from "vue";

function formatSecs(secs) {
  const minutes = Math.floor(secs / 60);
  secs = Math.floor(secs % 60);
  return `${minutes < 10 ? "0" : ""}${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

export default defineComponent({
  name: "Ruler",
  props: [],
  setup() {
    return {
      startpx: 0,
      startsecs: 1,
      smallunit: 10,
      smallunitsecs: 1,
    };
  },
  created() {
    this.$watch(
      () => `${this.startSampleIdx}_${this.endSampleIdx}`,
      () => {
        this.updateRuler();
      }
    );
  },
  mounted() {
    const canvas = document.querySelector(`#ruler`);
    this.context = canvas.getContext("2d");
    this.canvasW =
      canvas.getBoundingClientRect().width * window.devicePixelRatio;
    this.canvasH =
      canvas.getBoundingClientRect().height * window.devicePixelRatio;
    canvas.width = this.canvasW;
    canvas.height = this.canvasH;
    this.updateRuler();
  },
  computed: {
    startSampleIdx() {
      return this.$store.state.editor.startSampleIdx;
    },
    endSampleIdx() {
      return this.$store.state.editor.endSampleIdx;
    },
  },
  methods: {
    updateRuler() {
      const sampleRate = this.$store.state.editor.sampleRate;
      const totalSecs = (this.endSampleIdx - this.startSampleIdx) / sampleRate;
      this.startsecs = Math.ceil(this.startSampleIdx / sampleRate);
      this.startpx =
        (this.canvasW * (this.startsecs * sampleRate - this.startSampleIdx)) /
        (this.endSampleIdx - this.startSampleIdx);
      this.smallunitsecs = Math.floor(
        (totalSecs * this.smallunit * window.devicePixelRatio) / this.canvasW
      );
      if (this.smallunitsecs < 1) this.smallunitsecs = 1;
      this.smallunit =
        (this.canvasW * this.smallunitsecs * sampleRate) /
        (this.endSampleIdx - this.startSampleIdx);
      if (this.smallunit >= 5) {
        this.drawCanvas();
      } else {
        console.log("smallunit < 5, not update", this.smallunit);
      }
    },
    drawCanvas() {
      this.context.fillStyle = "#FFF";
      this.context.strokeStyle = "#000";
      this.context.lineWidth = 1;
      var fontArgs = this.context.font.split(" ");
      var newSize = "22px";
      this.context.font = newSize + " " + fontArgs[fontArgs.length - 1]; /// using the last part
      this.context.fillRect(0, 0, this.canvasW, this.canvasH);

      this.context.beginPath();
      this.context.moveTo(0, this.canvasH - 10);
      this.context.lineTo(this.canvasW, this.canvasH - 10);
      this.context.stroke();
      let lastText = -1;
      let lastBigLine = -1;
      for (let i = 0; ; i++) {
        const x = this.startpx + i * this.smallunit;
        if (x >= this.canvasW) break;
        this.context.beginPath();
        this.context.moveTo(x, this.canvasH - 10);
        const txt = formatSecs(this.startsecs + i * this.smallunitsecs);
        if ((txt.endsWith("0") || txt.endsWith("5")) && i - lastBigLine >= 5) {
          this.context.lineTo(x, this.canvasH - 30);
          lastBigLine = i;
          if (i - lastText >= 10) {
            lastText = i;
            this.context.strokeText(
              txt,
              x - this.context.measureText(txt).width / 2,
              this.canvasH - 50
            );
          }
        } else {
          this.context.lineTo(x, this.canvasH - 20);
        }
        this.context.stroke();
      }
    },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.ruler {
  background-color: tomato;
  display: flex;
  flex-direction: column;
}
.rulercanvas {
  align-self: stretch;
  height: 100px;
}
</style>
