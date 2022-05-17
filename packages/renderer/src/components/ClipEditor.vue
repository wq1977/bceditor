<template>
  <div class="cliproot">
    <div class="optpanel mb-3">
      <button type="button" class="btn btn-outline-primary" @click="dosplit">
        拆分
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="pluginFadeout"
      >
        淡出
      </button>
      <button type="button" class="btn btn-outline-primary" @click="pluginMix">
        添加背景音
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="start !== false && addOpt('del')"
      >
        删除
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="start !== false && addOpt('mute')"
      >
        Mute
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="start !== false && addOpt('beep')"
      >
        Beep
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="start !== false && addOpt('')"
      >
        正常
      </button>
      <button type="button" class="btn btn-outline-primary" @click="doplay">
        {{ playing ? "Stop" : "Play" }}
      </button>
    </div>
    <WavForm
      id="clipeditor"
      :wavs="wavs"
      :opts="wavopts"
      :wavenable="wavEnabled"
      :enableChange="enableChange"
      :volumns="clip.volumns"
      :volumnChange="volumnChange"
    />
    <div class="wordroot mt-3">
      <div
        style="display: flex; align-items: center; justify-contents: center"
        @click="choose(idx)"
        v-for="(word, idx) in clip.words"
        :key="idx"
      >
        <div v-if="isLeftSafe(idx)" class="safeIndicator" />
        <div
          class="word"
          :class="[
            ...((start !== false && idx === start) ||
            (start !== false && end !== false && idx >= start && idx <= end)
              ? ['chosen']
              : []),
            ...(clip.words[idx].opt ? [`opt_${clip.words[idx].opt}`] : []),
          ]"
        >
          <span @dblclick="playFrom(idx)">{{ word.Word }}</span>
          <span
            v-for="(item, idx) in word.plugins || []"
            :key="`plugin_${idx}`"
          >
            <i
              @dblclick="
                word.plugins.splice(idx, 1);
                $store.dispatch('loadsave/save', {});
              "
              class="far fa-file-audio"
            ></i>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import WavForm from "/@/components/WavForm.vue";
import { useElectron } from "../use/electron";
import { clip2pieces } from "../use/lib";
export default {
  setup() {
    const { play, stop, selectMedia, getSample } = useElectron();
    return { play, stop, selectMedia, getSample };
  },
  props: ["clip"],
  data() {
    return {
      opts: [],
      active: -1,
      start: false,
      end: false,
      playing: false,
      wordSafe: {},
    };
  },
  created() {
    this.$watch("clip", () => {
      this.start = false;
      this.end = false;
      this.updateWordSafe();
    });
    this.updateWordSafe();
  },
  methods: {
    async updateWordSafe() {
      const wordsSafe = {};
      this.wordSafe = {};
      for (let idx = 0; idx < this.clip.words.length; idx++) {
        const startFrame = Math.round(
          ((this.clip.words[idx].OffsetStartMs + this.clip.startms) * 44100) /
            1000
        );
        let total = 0;
        const TEST_FRAME_LEN = 50;
        for (let i = 0; i < TEST_FRAME_LEN; i++) {
          const value = await this.getSample(
            this.wavs.map((wav) => ({ id: wav.id })),
            () => ({ ...this.volumns }),
            { opt: this.clip.words[idx].opt },
            i + startFrame,
            true
          );
          total += Math.abs(value);
        }
        wordsSafe[idx] = total;
      }
      this.wordSafe = { ...wordsSafe };
    },
    // 判断这个词可不可以被安全裁剪
    // 依据是这个词开始的一组sample的绝对值非常接近于零
    isLeftSafe(idx) {
      return this.wordSafe[idx] < 0.5;
    },
    async pluginFadeout() {
      let target = this.start;
      if (target === false) {
        return;
      }
      this.clip.words[target].plugins = [
        ...(this.clip.words[target].plugins || []),
        {
          type: "fadeout",
        },
      ];
      this.$store.dispatch("loadsave/save", {});
    },
    async pluginMix() {
      const mediapath = await this.selectMedia();
      if (mediapath) {
        let target = this.start;
        if (target === false) {
          for (let i = 0; i < this.clip.words.length; i++) {
            if (this.clip.words[i].opt !== "del") {
              target = i;
              break;
            }
          }
        }
        this.clip.words[target].plugins = [
          ...(this.clip.words[target].plugins || []),
          {
            type: "fadein",
            media: mediapath,
            mainVolumn: 0.3,
            maxVolumn: 1,
          },
        ];
        this.$store.dispatch("loadsave/save", {});
      }
    },
    volumnChange(id, value) {
      if (!this.clip.volumns) {
        this.clip.volumns = {};
      }
      this.clip.volumns[id] = value;
      this.$store.dispatch("loadsave/save", {});
    },
    enableChange(id, value) {
      if (!this.clip.enabled) {
        this.clip.enabled = {};
      }
      this.clip.enabled[id] = value;
      const disabled = this.$store.state.editor.disabled;
      const defaultEnabled = this.$store.state.editor.wavs.reduce((r, wav) => {
        r[wav.id] = !disabled[wav.id];
        return r;
      }, {});
      this.clip.enabled = { ...defaultEnabled, ...this.clip.enabled };
      this.$store.dispatch("loadsave/save", {});
    },
    playFrom(idx) {
      this.start = idx;
      this.end = this.clip.words.length - 1;
      this.doplay();
    },
    //将一个piece拆分成两个piece，两边都需要修改
    dosplit() {
      if (this.end || this.start) {
        this.$emit("split", this.end || this.start);
      }
    },
    doplay() {
      if (this.playing) {
        this.stop();
        this.playing = false;
        return;
      }
      this.playing = true;
      const { pieces, plugins } = this.currentPieces;
      this.play(
        this.wavs.map((wav) => ({ id: wav.id })),
        () => {
          return { ...this.volumn };
        },
        {
          pieces,
        },
        (playing, piece, pos) => {
          this.playing = playing;
        },
        JSON.parse(JSON.stringify(plugins))
      );
    },
    choose(idx) {
      if (this.start === false || idx < this.start) this.start = idx;
      else if (this.start === idx) {
        this.start = false;
        this.end = false;
      } else if (this.end === false) this.end = idx;
      else {
        this.end = false;
        this.start = idx;
      }
    },
    formatSecs(secs) {
      const ms = Math.floor((secs * 1000) % 1000);
      const minutes = Math.floor(secs / 60);
      secs = Math.floor(secs % 60);
      return `${minutes < 10 ? "0" : ""}${minutes}:${
        secs < 10 ? "0" : ""
      }${secs}.${ms < 10 ? "00" : ms < 100 ? "0" : ""}${ms}`;
    },
    optLabel(type) {
      return { del: "删除", beep: "Beep", mute: "静音" }[type];
    },
    addOpt(type) {
      for (let i = this.start; i <= (this.end || this.start); i++) {
        this.clip.words[i].opt = type;
      }
      this.start = false;
      this.end = false;
      this.$store.dispatch("loadsave/save", {});
    },
  },
  components: {
    WavForm,
  },
  computed: {
    localPlugins() {
      return this.clip.words.reduce(
        (r, word) => [
          ...r,
          ...((word.plugins || []).map((plugin) => ({
            ...plugin,
            clipend: Math.ceil((this.clip.endms * 44100) / 1000),
            offset: Math.ceil(
              ((word.OffsetStartMs + this.clip.startms) * 44100) / 1000
            ),
          })) || []),
        ],
        []
      );
    },
    wavEnabled() {
      const disabled = this.$store.state.editor.disabled;
      const defaultEnabled = this.$store.state.editor.wavs.reduce((r, wav) => {
        r[wav.id] = !disabled[wav.id];
        return r;
      }, {});
      return this.clip.enabled || defaultEnabled;
    },
    currentPieces() {
      const disabled = this.$store.state.editor.disabled;
      const defaultEnabled = this.$store.state.editor.wavs.reduce((r, wav) => {
        r[wav.id] = !disabled[wav.id];
        return r;
      }, {});
      if (this.start === false) {
        return clip2pieces({
          ...this.clip,
          enabled: this.clip.enabled || defaultEnabled,
        });
      }
      const startms =
        this.clip.startms + this.clip.words[this.start].OffsetStartMs;
      const endms =
        this.clip.startms + this.clip.words[this.end || this.start].OffsetEndMs;
      return clip2pieces({
        startms,
        endms,
        words: this.clip.words
          .filter(
            (_, idx) => idx >= this.start && idx <= (this.end || this.start)
          )
          .map((w) => ({
            ...w,
            OffsetStartMs: this.clip.startms + w.OffsetStartMs - startms,
            OffsetEndMs: this.clip.startms + w.OffsetEndMs - startms,
          })),
        enabled: this.clip.enabled || defaultEnabled,
      });
    },
    wavs() {
      return this.$store.state.editor.wavs;
    },
    volumn() {
      return this.$store.state.editor.volumn;
    },
    wavopts() {
      const { pieces } = clip2pieces(this.clip);
      return {
        pieces,
      };
    },
  },
};
</script>

<style scoped>
.cliproot {
  margin: 10px 0;
}
.optpanel {
  display: flex;
  flex-direction: row-reverse;
}
.optline {
  display: flex;
  flex-direction: row;
  margin: 10px 0;
  align-items: center;
}
.valuetype {
  width: 100px;
}
.active {
  color: red;
  font-weight: bold;
}
.wordroot {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.word {
  font-weight: bold;
  padding: 0.5em 0.5em;
  margin: 2px;
  background-color: lightgray;
  border-radius: 0.25em;
}
.chosen {
  color: red;
}
.opt_del {
  text-decoration: line-through;
  text-decoration-thickness: 3px;
  text-decoration-color: #ff0000aa;
}
.opt_beep {
  text-decoration: overline;
  text-decoration-thickness: 3px;
  text-decoration-color: #ff0000aa;
}
.opt_mute {
  text-decoration: underline;
  text-decoration-thickness: 3px;
  text-decoration-color: #ff0000aa;
}
.safeIndicator {
  width: 5pt;
  height: 5pt;
  background-color: rgb(19, 116, 19);
}
</style>
