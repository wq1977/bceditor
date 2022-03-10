<template>
  <div class="cursor" :style="{ left }"></div>
</template>

<script >
import { defineComponent } from "vue";

export default defineComponent({
  name: "TextPlayCursor",
  props: [],
  computed: {
    left() {
      const pos =
        (this.$store.state.editor.textPos * this.$store.state.editor.canvasw) /
        this.$store.state.editor.textTotal /
        window.devicePixelRatio;
      return `${pos}px`;
    },
  },
  mounted() {},
  methods: {},
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.cursor {
  position: absolute;
  bottom: 0;
  top: 0;
  width: 2px;
  background-color: tomato;
}
</style>
