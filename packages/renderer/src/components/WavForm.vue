<template>
  <div class="wavroot">
    <div class="panel">
      <div v-for="(wav, idx) in wavs" :key="`wav_${idx}`" class="wavenable">
        <span class="mx-1">{{ wav.path }}</span>
        <input
          class="mx-1"
          :ref="wav.id"
          v-if="fixenabled !== true"
          @change="setEnabled(wav.id, $event.target.checked)"
          type="checkbox"
          :checked="wavenable[wav.id]"
        />
        <div class="volumn" v-if="fixvolumn !== true">
          <span class="mx-1">音量</span>
          <input
            class="mx-1"
            :value="wavVolumns[wav.id] || 1"
            @change="setVolumn(wav.id, $event.target.value)"
          />
        </div>
      </div>
      <span class="mx-1">({{ duration }})</span>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { useElectron } from "../use/electron";
function formatSecs(secs) {
  const minutes = Math.floor(secs / 60);
  secs = Math.floor(secs % 60);
  return `${minutes < 10 ? "0" : ""}${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

export default defineComponent({
  name: "WavForm",
  props: [
    "wavs",
    "opts",
    "id",
    "fixenabled",
    "fixvolumn",
    "wavenable",
    "enableChange",
    "volumns",
    "volumnChange",
    "focus",
  ],
  setup() {
    const { getSample, getFrameTotal, relative2Real } = useElectron();
    return { getSample, getFrameTotal, relative2Real };
  },
  data() {
    return {
      clipVolumns: {},
    };
  },
  computed: {
    duration() {
      return formatSecs(
        this.getFrameTotal({ pieces: this.opts.pieces }) / 44100
      );
    },
    // canvasid() {
    //   return `canvas_${this.id}`;
    // },
    startSampleIdx() {
      return this.$store.state.editor.startSampleIdx;
    },
    wavVolumns() {
      if (this.volumnChange) {
        if (this.volumns) {
          return this.volumns;
        }
        return {};
      }
      return this.$store.state.editor.volumn;
    },
    endSampleIdx() {
      return this.$store.state.editor.endSampleIdx;
    },
    canvasw() {
      return this.$store.state.editor.canvasw;
    },
    canvash() {
      return this.$store.state.editor.canvash;
    },
    zoom() {
      return this.$store.state.editor.zoom;
    },
  },
  mounted() {
    // const canvas = document.querySelector(`#${this.canvasid}`);
    // this.context = canvas.getContext("2d");
    // const canvasW =
    //   canvas.getBoundingClientRect().width * window.devicePixelRatio;
    // const canvasH =
    //   canvas.getBoundingClientRect().height * window.devicePixelRatio;
    // canvas.width = canvasW;
    // canvas.height = canvasH;
    // this.$store.commit("editor/set", {
    //   canvasw: canvasW,
    //   canvash: canvasH,
    // });
    if (
      this.$store.state.loadsave.volumn &&
      this.$store.state.loadsave.volumn[this.id]
    ) {
      this.volumn = this.$store.state.loadsave.volumn[this.id];
    }
    // this.drawCanvas();
  },
  methods: {
    setEnabled(id, v) {
      if (this.enableChange) {
        this.enableChange(id, v);
      }
    },
    setVolumn(id, v) {
      v = parseFloat(v);
      if (this.volumnChange) {
        this.clipVolumns[id] = v;
        this.volumnChange(id, v);
        return;
      }
      this.$store.dispatch("setvol", {
        id: this.id,
        volumn: v,
      });
    },
    onwheel(e) {
      // if (e.ctrlKey) {
      //   this.$store.commit("editor/scale", e.deltaY);
      // } else {
      //   if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      //     this.$store.commit("editor/pan", e.deltaX);
      //   }
      // }
    },

    //   async drawCanvas() {
    //     const w = this.canvasw;
    //     const h = this.canvash;
    //     const [focusStart, focusEnd] = this.focus || [w, w];
    //     this.context.strokeStyle = "#000";
    //     this.context.fillStyle = "#FFF";
    //     this.context.lineWidth = 1;
    //     this.context.clearRect(0, 0, w, h);
    //     this.context.fillRect(0, 0, w, h);
    //     this.context.strokeRect(0, 0, w, h);
    //     const totalLen = this.getFrameTotal({ pieces: this.opts.pieces });
    //     this.context.strokeStyle = "#000";
    //     this.context.beginPath();
    //     for (let x = 0; x < w; x++) {
    //       const rate = x / w;
    //       let colorStyle = "notFocus";
    //       if (rate >= focusStart && rate < focusEnd) {
    //         colorStyle = "focus";
    //       }
    //       let result = 0;
    //       const relativePos = Math.floor((x * totalLen) / w);
    //       try {
    //         const [samplePos, piece] = this.relative2Real(this.opts, relativePos);
    //         const value = await this.getSample(
    //           this.wavs.map((wav) => ({ id: wav.id })),
    //           () => ({ ...this.volumns }),
    //           piece,
    //           samplePos,
    //           true
    //         );
    //         result += Math.abs(value);
    //       } catch (ex) {}
    //       if (colorStyle === "focus") {
    //         this.context.fillStyle = "#F00";
    //       } else {
    //         this.context.fillStyle = "#00F";
    //       }
    //       this.context.moveTo(x, (h / 2) * (1 - result));
    //       this.context.lineTo(x, (h / 2) * (1 + result));
    //     }
    //     this.context.stroke();
    //   },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.wavroot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
}
.wavcanvas {
  height: 100px;
}
h4 {
  color: #888888;
  margin: 10px;
}
.panel {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.wavenable {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
.volumn {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
</style>
