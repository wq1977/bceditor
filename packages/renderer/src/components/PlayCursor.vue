<template>
  <div class="cursor" :style="{ left }"></div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "PlayCursor",
  props: [],
  computed: {
    left() {
      const pos =
        (this.$store.state.editor.cursor.pos -
          this.$store.state.editor.startSampleIdx) /
        (this.$store.state.editor.endSampleIdx -
          this.$store.state.editor.startSampleIdx);
      return `${pos * 100}%`;
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
