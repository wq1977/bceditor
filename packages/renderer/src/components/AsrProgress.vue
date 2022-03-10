<template>
  <div class="asrproot">
    <div class="asrdialog">
      <div v-for="p in names" :key="p" class="progress">
        <div class="progress_label">{{ label(p) }}</div>
        <div style="position: relative" class="progress_progress">
          <div
            class="progress_back"
            style="position: absolute; left: 0; right: 0; top: 0; bottom: 0"
          ></div>
          <div
            class="progress_front"
            :style="{ right: progress(p) }"
            style="position: absolute; left: 0; top: 0; bottom: 0"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: ["names"],
  methods: {
    label(key) {
      return {
        wav: "并轨",
        mp3: "合成mp3",
        upload: "上传素材",
        asr: "文本识别",
      }[key];
    },
    progress(key) {
      const value = 1 - ((this.allProgress || {})[key] || 0);
      return `${value * 100}%`;
    },
  },
  computed: {
    allProgress() {
      return this.$store.state.editor.asrProgress;
    },
  },
};
</script>
<style scoped>
.asrproot {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 3000;
}
.asrdialog {
  background-color: white;
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  -webkit-box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
  -moz-box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
  box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
  -webkit-background-clip: padding-box;
  -moz-background-clip: padding-box;
  background-clip: padding-box;
}
.progress_progress {
  width: 300px;
}
.progress_back {
  border: 1px solid black;
  border-radius: 5px;
  background-color: white;
}

.progress_front {
  border-left: 1px solid black;
  border-top: 1px solid black;
  border-bottom: 1px solid black;
  border-radius: 5px;
  background-color: green;
}
.progress {
  display: flex;
  flex-direction: row;
  margin-bottom: 0.5em;
}
.progress_label {
  margin-right: 1em;
  width: 100px;
}
</style>