<template>
  <div class="rootwrapper bg-light">
    <div class="textroot">
      <AsrProgress v-if="inExport" :names="['wav', 'mp3']" />
      <div class="optpanel">
        <input v-model="search" />
        <button
          type="button"
          class="btn btn-outline-primary"
          :disabled="!search"
          @click="searchNext"
        >
          下一个
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          :disabled="!search"
          @click="searchPrev"
        >
          上一个
        </button>
        <div style="flex: 1" />
        <button type="button" class="btn btn-outline-primary" @click="doplay">
          {{ isPlaying ? "Stop" : "Play" }}
        </button>
        <button type="button" class="btn btn-outline-primary" @click="docopy">
          复制
        </button>
        <button type="button" class="btn btn-outline-primary" @click="docut">
          剪切
        </button>
        <button type="button" class="btn btn-outline-primary" @click="dopaste">
          粘贴
        </button>
        <button type="button" class="btn btn-outline-primary" @click="addall">
          全部添加
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          @click="removeall"
        >
          全部移除
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          @click="doExport()"
        >
          导出
        </button>
        <button
          type="button"
          class="btn btn-outline-primary"
          @click="doNextLayout()"
        >
          切换布局
        </button>
      </div>
      <div class="texteditorwrapper">
        <div class="texteditor p-2">
          <div v-if="!isPlaying" class="src border pt-2 px-2">
            <div
              @click="addline(idx)"
              class="line"
              :id="`src_${idx}`"
              :class="[
                ...(active >= 0 &&
                active < result.length &&
                result[active].startms === line.startms
                  ? ['active']
                  : []),
                ...(searchActive === idx ? ['searchTarget'] : []),
              ]"
              v-for="(line, idx) in asr"
              :key="idx"
            >
              {{ idx + 1 }} {{ line.sentence }}
            </div>
          </div>
          <div class="dst border pt-2 px-2">
            <div
              @click="doclick($event, idx)"
              @dblclick="removeLine(idx)"
              class="line"
              :id="`dst_${idx}`"
              :class="activeClass(idx)"
              v-for="(line, idx) in result"
              :key="`result_${idx}`"
            >
              {{ idx + 1 }} {{ normalize(line) }}
            </div>
          </div>
        </div>
      </div>
      <ClipEditor
        v-if="!isPlaying && active >= 0 && active < result.length"
        :clip="result[active]"
        @split="dosplit"
      />
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import WavForm from "/@/components/WavForm.vue";
import ClipEditor from "/@/components/ClipEditor.vue";
import TextPlayCursor from "/@/components/TextPlayCursor.vue";
import { useElectron } from "../use/electron";
import { clip2pieces } from "../use/lib";
import AsrProgress from "/@/components/AsrProgress.vue";

export default defineComponent({
  name: "TextEditor",
  props: ["asr"],
  components: {
    WavForm,
    TextPlayCursor,
    ClipEditor,
    AsrProgress,
  },
  setup() {
    const { play, stop, copy, paste, exportWav, getFrameTotal, real2Relative } =
      useElectron();
    return { play, stop, paste, copy, exportWav, getFrameTotal, real2Relative };
  },
  data() {
    return {
      result: [],
      active: 0,
      activeLen: 1,
      isPlaying: false,
      inExport: false,
      asrProgress: {},
      search: "",
      searchActive: -1,
    };
  },
  computed: {
    layout() {
      return this.$store.state.editor.layout;
    },
    wavs() {
      return this.$store.state.editor.wavs;
    },
    volumn() {
      return this.$store.state.editor.volumn;
    },
    textTotal() {
      return this.getFrameTotal({ pieces: this.wavopts.pieces });
    },
    wavopts() {
      const disabled = this.$store.state.editor.disabled;
      const defaultEnabled = this.$store.state.editor.wavs.reduce((r, wav) => {
        r[wav.id] = !disabled[wav.id];
        return r;
      }, {});
      let piecesAll = [],
        pluginsAll = [];
      for (let idx = 0; idx < this.result.length; idx++) {
        const line = this.result[idx];
        const { pieces, plugins } = clip2pieces(
          {
            ...line,
            enabled: line.enabled || defaultEnabled,
          },
          idx
        );
        const total = this.getFrameTotal({ pieces: piecesAll });
        piecesAll = [...piecesAll, ...pieces];
        pluginsAll = [
          ...pluginsAll,
          ...plugins.map((p) => ({ ...p, offset: p.offset + total })),
        ];
      }
      return {
        pieces: piecesAll,
        plugins: pluginsAll,
      };
    },
  },
  mounted() {
    if (this.$store.state.loadsave.result) {
      setTimeout(() => {
        const volumns =
          this.$store.state.loadsave.volumns || this.wavs.map(() => 1);
        for (let id in volumns) {
          this.$store.commit("editor/setvol", {
            id,
            volumn: volumns[id],
          });
        }
        this.result = this.$store.state.loadsave.result;
        this.active = 0;
        this.$store.commit("editor/set", {
          textTotal: this.textTotal,
          textPos: 0,
        });
      }, 10);
    }
  },
  created() {
    this.$watch("textTotal", () => {
      document.title = this.formatSecs(this.textTotal / 44100);
    });
    this.$watch("searchActive", this.scrollSearchActive);
    this.$watch("active", () => {
      const line = this.result[this.active];
      if (line) {
        this.$store.commit("editor/set", {
          textPos: this.getFrameTotal({
            pieces: this.wavopts.pieces.filter(
              (piece) => piece.originidx < this.active
            ),
          }),
        });
      }
      setTimeout(() => {
        this.scroll2Viewable();
      }, 100);
    });
    this.$watch("result", () => {
      setTimeout(() => {
        this.$store.dispatch("loadsave/save", {
          result: this.result,
        });
      }, 100);
    });
  },
  methods: {
    searchNext() {
      for (let i = this.searchActive + 1; i < this.asr.length; i++) {
        if (this.asr[i].sentence.indexOf(this.search) >= 0) {
          this.searchActive = i;
          break;
        }
      }
    },
    dosplit(position) {
      console.log("split", position, this.result[this.active]);
      const curclip = { ...this.result[this.active] };
      const newclip1 = {
        ...curclip,
        words: curclip.words.slice(0, position + 1),
        endms: curclip.startms + curclip.words[position].OffsetEndMs,
      };
      const newclip2 = {
        ...curclip,
        words: curclip.words.slice(position + 1),
        startms: curclip.startms + curclip.words[position].OffsetEndMs,
      };
      this.result.splice(this.active, 1, newclip1);
      this.result.splice(this.active + 1, 0, newclip2);
    },
    searchPrev() {
      for (let i = this.searchActive - 1; i >= 0; i--) {
        if (this.asr[i].sentence.indexOf(this.search) >= 0) {
          this.searchActive = i;
          break;
        }
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

    doNextLayout() {
      this.$store.commit("editor/nextLayout");
    },
    normalize(line) {
      return line.words
        .filter((w) => w.opt !== "del" && w.opt !== "mute")
        .map((w) => w.Word)
        .join("");
    },
    async docut() {
      if (this.active >= 0 && this.activeLen > 0) {
        await this.copy(
          JSON.stringify(
            this.result.slice(this.active, this.active + this.activeLen)
          )
        );
        this.result = [
          ...this.result.slice(0, this.active),
          ...this.result.slice(this.active + this.activeLen),
        ];
        this.active = Math.max(this.active - 1, 0);
        this.activeLen = 1;
      }
    },
    async docopy() {
      if (this.active >= 0 && this.activeLen > 0) {
        await this.copy(
          JSON.stringify(
            this.result.slice(this.active, this.active + this.activeLen)
          )
        );
      }
    },
    async dopaste() {
      if (this.active < 0 || this.activeLen <= 0) return;
      const text = await this.paste();
      try {
        const lines = JSON.parse(text);
        if (lines.length > 0 && lines[0].endms) {
          this.result = [
            ...this.result.slice(0, this.active + 1),
            ...lines,
            ...this.result.slice(this.active + 1),
          ];
          this.active = this.active + 1;
          this.activeLen = lines.length;
        }
      } catch (ex) {
        console.log("paste with no json");
      }
    },
    activeClass(idx) {
      return this.active >= 0 &&
        idx >= this.active &&
        idx - this.active < this.activeLen
        ? "active"
        : "";
    },
    doclick(ev, idx) {
      if (ev.shiftKey) {
        if (idx > this.active && this.active >= 0) {
          this.activeLen = idx - this.active + 1;
        }
        return;
      }
      this.active = idx;
      this.activeLen = 1;
    },
    addall() {
      this.result = [...this.asr];
      this.active = 0;
    },
    removeall() {
      this.result = [];
      this.active = -1;
    },
    async doExport() {
      this.inExport = true;
      this.$store.commit("editor/set", {
        asrProgress: {},
      });
      this.asrProgress = {};
      const { pieces, plugins } = this.wavopts;
      await this.exportWav(
        this.wavs.map((wav) => ({ id: wav.id })),
        () => ({ ...this.volumn }),
        {
          pieces: [...pieces],
        },
        (name, progress) => {
          this.asrProgress[name] = progress;
          this.$store.commit("editor/set", { asrProgress: this.asrProgress });
        },
        JSON.parse(JSON.stringify(plugins))
      );
      this.inExport = false;
    },
    scrollSearchActive() {
      console.log("scroll", this.searchActive, this.active);
      if (this.searchActive >= 0 && this.searchActive < this.asr.length) {
        console.log("lookup element!");
        const srcelem = document.getElementById(`src_${this.searchActive}`);
        if (srcelem) {
          console.log("scroll!");
          srcelem.scrollIntoViewIfNeeded();
        }
      }
    },
    scroll2Viewable() {
      for (let i = 0; i < this.asr.length; i++) {
        const line = this.asr[i];
        if (
          this.result[this.active] &&
          this.result[this.active].startms === line.startms
        ) {
          const srcelem = document.getElementById(`src_${i}`);
          if (srcelem) {
            srcelem.scrollIntoViewIfNeeded();
          }
          break;
        }
      }
      const dstelem = document.getElementById(`dst_${this.active}`);
      if (dstelem) {
        dstelem.scrollIntoViewIfNeeded();
      }
    },
    doplay() {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.stop();
        return;
      }
      this.isPlaying = true;
      const posbase = this.getFrameTotal({
        pieces: this.wavopts.pieces.filter(
          (piece) => piece.originidx < this.active
        ),
      });
      this.result = [...this.result];
      const { pieces, plugins } = this.wavopts;
      const playPieces = pieces.filter(
        (piece) => piece.originidx >= this.active
      );
      const playPlugins = plugins
        .filter((p) => p.offset >= posbase)
        .map((p) => ({
          ...p,
          offset: p.offset - posbase,
        }));
      this.play(
        this.wavs.map((wav) => ({ id: wav.id })),
        () => {
          return { ...this.volumn };
        },
        {
          pieces: playPieces,
        },
        (playing, piece, pos) => {
          this.isPlaying = playing;
          if (playing) {
            this.active = piece;
            this.$store.commit("editor/set", {
              textPos: posbase + pos,
            });
          }
        },
        JSON.parse(JSON.stringify(playPlugins))
      );
    },
    removeLine(idx) {
      this.result.splice(idx, 1);
      if (this.active >= this.result.length) {
        this.active = this.result.length - 1;
      }
      this.$store.commit("editor/set", { textTotal: this.textTotal });
    },
    addline(idx) {
      this.result = [
        ...this.result.slice(0, this.active + 1),
        { ...this.asr[idx], words: this.asr[idx].words.map((w) => ({ ...w })) },
        ...this.result.slice(this.active + 1, this.result.length),
      ];
      this.active = this.active + 1;
      this.$store.commit("editor/set", { textTotal: this.textTotal });
    },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.textroot {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
}
.rootwrapper {
  flex: 1;
  position: relative;
}
.texteditorwrapper {
  flex: 1;
  position: relative;
}
.texteditor {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex: 1;
}
.src {
  flex: 1;
  overflow-y: scroll;
}
.dst {
  flex: 3;
  overflow-y: scroll;
}
.line {
  text-align: left;
  margin-bottom: 1em;
  font-weight: bold;
  cursor: pointer;
}
.active {
  color: red;
}
.optpanel {
  display: flex;
  flex-direction: row;
  padding: 10px;
}
.searchTarget {
  background-color: #ccc;
}
</style>
