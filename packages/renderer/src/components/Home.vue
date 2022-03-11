<template>
  <div class="homeroot container">
    <div v-if="loading">Loading ...</div>
    <div class="optgroup lh-lg p-5" style="text-align: justify" v-else>
      <h1>欢迎使用</h1>
      <p>
        <span class="fw-bolder">BCEditor</span>
        是一个简单的播客编辑软件，它的特点是可以首先将声音转换成文本，然后让你可以像编辑word文档一样编辑声音文件。
      </p>
      <div v-if="keyReady">
        <ul class="mt-5">
          <li :class="{ 'fw-bold': btnfocus === 0 }">
            录制播客通常会使用专用设备将声音按照每个人一个音轨的方式录制成wav格式，如果你已经有原始的wav格式的文件需要进行编辑，请选择下面三个按钮中最左边的那个。
          </li>
          <li :class="{ 'fw-bold': btnfocus === 1 }">
            如果你想要编辑一个以前的工程，请选择第二个按钮，打开以前工程目录中的proj.json这个文件。
          </li>
          <li :class="{ 'fw-bold': btnfocus === 2 }">
            如果你在录制过程中发生中断，需要把多个中断的Wav文件合并成一个，请选择下面第三个按钮。
          </li>
        </ul>
        <div class="d-flex mt-5 px-5">
          <button
            class="homebtn btn btn-outline-primary"
            style="flex: 1"
            @mouseover="btnFocus(0)"
            @click="doload"
          >
            加载声音文件(*仅支持wav格式，可多选)
          </button>
          <button
            class="homebtn btn btn-outline-secondary"
            style="flex: 1"
            @mouseover="btnFocus(1)"
            @click="doOpen"
          >
            打开工程文件
          </button>
          <button
            class="homebtn btn btn-outline-secondary"
            style="flex: 1"
            @mouseover="btnFocus(2)"
            @click="doJoinWav"
          >
            工具 -> 合并 Wav
          </button>
        </div>
      </div>
      <div v-else>
        <p class="text-center">
          BCEditor需要使用腾讯云进行文本识别，您需要先自行注册腾讯云服务，然后提供下述信息
        </p>
        <form class="row g-3 px-5" ref="txconf">
          <div class="col-md-6">
            <label class="form-label">COS 存储桶</label>
            <input
              type="text"
              class="form-control"
              v-model="tbucket"
              placeholder="recs-xxxx"
              required
            />
          </div>
          <div class="col-md-6">
            <label class="form-label">COS 区域</label>
            <input
              type="text"
              class="form-control"
              v-model="tzone"
              placeholder="ap-beijing"
              required
            />
          </div>
          <div class="col-12">
            <label for="inputAddress" class="form-label">SID</label>
            <input
              type="text"
              class="form-control"
              v-model="tsid"
              placeholder="AKIDxxxxxxx"
              required
            />
          </div>
          <div class="col-12">
            <label class="form-label">Key</label>
            <input
              type="text"
              class="form-control"
              v-model="tkey"
              placeholder="wdxxxxxxxx"
              required
            />
          </div>
          <div class="col-12">
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";
import { useElectron } from "../use/electron";

export default defineComponent({
  name: "HelloWorld",
  setup() {
    const { selectWavs, selectMedia, openProj, joinWav, txkey, setTxKey } =
      useElectron();
    return { selectWavs, selectMedia, openProj, joinWav, txkey, setTxKey };
  },

  data() {
    return {
      loading: false,
      btnfocus: 0,
      tbucket: "",
      tzone: "",
      tkey: "",
      tsid: "",
      newKey: false,
    };
  },

  computed: {
    keyReady() {
      return this.txkey || this.newKey;
    },
  },

  mounted() {
    const form = this.$refs.txconf;
    if (form) {
      form.addEventListener(
        "submit",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!form.checkValidity()) {
            return;
          }
          form.classList.add("was-validated");
          this.newKey = {
            tbucket: this.tbucket,
            tkey: this.tkey,
            tsid: this.tsid,
            tzone: this.tzone,
          };
          this.setTxKey({ ...this.newKey });
        },
        false
      );
    }
    this.recovery();
  },

  methods: {
    btnFocus(focus) {
      this.btnfocus = focus;
    },
    async recovery() {
      if (
        this.$store.state.loadsave.wavs &&
        this.$store.state.loadsave.wavs.map &&
        this.$store.state.loadsave.wavs.length > 0
      ) {
        this.loading = true;
        setTimeout(async () => {
          try {
            const now = new Date().getTime();
            await this.loadfiles([...this.$store.state.loadsave.wavs]);
            const allPluginPath = new Set();
            for (let line of this.$store.state.loadsave.result || []) {
              for (let word of line.words) {
                for (let plugin of word.plugins || []) {
                  if (plugin.media) {
                    allPluginPath.add(plugin.media.path);
                  }
                }
              }
            }
            for (let path of allPluginPath) {
              await this.selectMedia(path);
            }
            console.log(
              `load files takes ${(new Date().getTime() - now) / 1000} secs`
            );
          } catch (ex) {
            console.log(ex);
          }
          this.loading = false;
        }, 1000); //等待窗口最大化
      }
    },
    async doOpen() {
      const path = await this.openProj();
      if (path) {
        this.$store.dispatch("loadsave/load", path);
        await this.recovery();
      }
    },
    async doJoinWav() {
      await this.joinWav();
    },
    doload() {
      this.loading = true;
      setTimeout(async () => {
        await this.loadfiles();
        this.loading = false;
      }, 100);
    },
    async loadfiles(pathes) {
      const wavs = await this.selectWavs(
        pathes ? pathes.map((p) => ({ ...p })) : null
      );
      if (wavs.length > 0) {
        const wavlen = Math.max(...wavs.map((wav) => wav.frameLen));
        this.$store.commit("editor/set", {
          startSampleIdx: 0,
          sampleLength: wavlen,
          endSampleIdx: wavlen,
        });
        if (!pathes) {
          //不是从存盘里读取的
          this.$store.dispatch("loadsave/save", {
            wavs,
            result: [],
          });
        }
        this.$store.commit("editor/set", {
          wavs,
        });
        this.$router.replace("/editor");
      }
    },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.homeroot {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.optgroup {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.homebtn {
  margin-bottom: 10px;
}
</style>
