<template>
  <div style="height: 100vh; display: flex; flex-direction: column">
    <nav v-if="layout == 1" class="titlebar navbar navbar-dark bg-dark">
      <h3 class="navbar-brand mx-3">播客编辑界面</h3>
      <div style="flex: 1" />
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="doNextLayout()"
      >
        切换布局
      </button>
      <button type="button" class="btn btn-outline-primary" @click="doNew()">
        关闭工程
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="playPause()"
      >
        {{ playing ? "停止" : "播放" }}
      </button>
      <button
        type="button"
        class="btn btn-outline-primary"
        @click="gotoStart()"
      >
        移动到开始
      </button>
      <button type="button" class="btn btn-outline-primary" @click="doText()">
        识别
      </button>
    </nav>
    <div
      v-if="layout == 1"
      ref="channels"
      @click="setGlobalCursor"
      class="channels"
    >
      <PlayCursor />
      <div v-for="(wav, idx) in wavs" :key="idx" class="wave m-2">
        <WavForm
          :id="wav.id"
          :enableChange="setenable"
          :wavenable="wavenable"
          :wavs="[wav]"
          :opts="this.opts"
        />
      </div>
    </div>
    <TextEditor v-if="asrResult" :asr="asrResult" />
    <AsrProgress v-if="inASR" :names="['wav', 'mp3', 'upload', 'asr']" />
    <!-- <FeatureList /> -->
  </div>
</template>

<script>
import WavForm from "/@/components/WavForm.vue";
import PlayCursor from "/@/components/PlayCursor.vue";
import Ruler from "/@/components/Ruler.vue";
import TextEditor from "/@/components/TextEditor.vue";
import FeatureList from "/@/components/FeatureList.vue";
import AsrProgress from "/@/components/AsrProgress.vue";
import { defineComponent } from "vue";
import { useElectron } from "../use/electron";

export default defineComponent({
  name: "HelloWorld",
  setup() {
    const { play, stop, asr, loadasr, writeFileSync, txkey, machineId } =
      useElectron();
    return { play, stop, asr, loadasr, writeFileSync, txkey, machineId };
  },
  data() {
    return {
      asrResult: false,
      asrProgress: {},
      inASR: false,
    };
  },
  components: {
    WavForm,
    PlayCursor,
    Ruler,
    TextEditor,
    FeatureList,
    AsrProgress,
  },
  methods: {
    setGlobalCursor(ev) {
      const node = this.$refs.channels;
      const x = ev.clientX;
      const totalFrames = Math.max(...this.wavs.map((w) => w.frameLen));
      const pos = Math.round((totalFrames * x) / node.offsetWidth);
      this.$store.commit("editor/cursor", pos);
    },
    setenable(id, value) {
      this.$store.commit("editor/setenabled", {
        id,
        value,
      });
      this.$store.dispatch("loadsave/save", {
        disabled: this.$store.state.editor.disabled,
      });
    },
    async doText() {
      if (!this.txkey) {
        //如果本地加载腾讯云的Token失败，就通过机器ID远程查询支付信息
        const rsp = await this.getPayInfo(this.machineId);
        // 如果机器已经支付成功，将会返回正确的腾讯云配置
        if (rsp.txkey) {
          await this.setTxKey(rsp.txkey);
        } else {
          switch (rsp.err) {
            // 这台机器没有付费，跳到赞助页面
            case 1:
              break;
            //这台机器的付费信息已过期，跳到赞助页面
            case 2:
              break;
            //已经停止服务或者其他异常，您可以稍后重试
            default:
              break;
          }
          return;
        }
      }
      this.inASR = true;
      this.$store.commit("editor/set", {
        asrProgress: {},
      });
      this.asrProgress = {};
      const path = await this.asr(
        this.wavs.map((wav) => ({ id: wav.id })),
        () => ({ ...this.volumn }),
        (name, progress) => {
          this.asrProgress[name] = progress;
          this.$store.commit("editor/set", { asrProgress: this.asrProgress });
        }
      );
      await this.loadText(path);
      this.inASR = false;
    },
    async gotoStart() {
      this.$store.commit("editor/cursor", 0);
    },
    async loadText(apath) {
      const { path, lines } = await this.loadasr(apath);
      this.asrResult = lines;
      this.asrPath = path;
      this.$store.dispatch("loadsave/save", {
        asr: this.asrPath,
      });
    },
    doNextLayout() {
      this.$store.commit("editor/nextLayout");
    },
    doNew() {
      this.$store.dispatch("loadsave/clear");
      this.$router.replace("/");
    },
    playPause() {
      if (this.$store.state.editor.playing) {
        this.stop();
        this.$store.commit("editor/set", {
          playing: false,
        });
      } else {
        this.$store.commit("editor/set", {
          playing: true,
        });
        const playBase = this.$store.state.editor.cursor.pos;
        this.play(
          this.wavs
            .map((wav) => ({ id: wav.id }))
            .filter((wav) => this.disabled[wav.id] !== true),
          () => ({ ...this.volumn }),
          {
            pieces: [
              {
                seekpos: this.$store.state.editor.cursor.pos,
                seeklimit: this.$store.state.editor.sampleLength,
              },
            ],
          },
          (playing, _, pos) => {
            if (playing) {
              this.$store.commit("editor/cursor", pos + playBase);
            }
          }
        );
      }
    },
  },
  mounted() {
    if (this.$store.state.loadsave.asr) {
      setTimeout(() => {
        this.loadText(this.$store.state.loadsave.asr);
      }, 10);
    }
    if (this.$store.state.loadsave.disabled) {
      for (let id in this.$store.state.loadsave.disabled) {
        this.$store.commit("editor/setenabled", {
          id,
          value: !this.$store.state.loadsave.disabled[id],
        });
      }
    }
    for (let k in this.$store.state.loadsave.volumn) {
      this.$store.commit("editor/setvol", {
        id: k,
        volumn: this.$store.state.loadsave.volumn[k],
      });
    }
  },
  computed: {
    layout() {
      return this.$store.state.editor.layout;
    },
    opts() {
      return {
        pieces: [
          {
            seekpos: this.$store.state.editor.startSampleIdx,
            seeklimit: this.$store.state.editor.endSampleIdx,
          },
        ],
      };
    },
    disabled() {
      return this.$store.state.editor.disabled;
    },
    volumn() {
      return this.$store.state.editor.volumn;
    },
    wavs() {
      return this.$store.state.editor.wavs;
    },
    playing() {
      return this.$store.state.editor.playing;
    },
    wavenable() {
      return (this.$store.state.editor.wavs || []).reduce((r, wav) => {
        r[wav.id] = !this.$store.state.editor.disabled[wav.id];
        return r;
      }, {});
    },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.channels {
  position: relative;
}
.titlebar {
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
