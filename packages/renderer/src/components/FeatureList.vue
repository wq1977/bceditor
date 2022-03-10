<template>
  <div class="featureList">
    <div class="feature">
      <div class="featurename">片尾淡出</div>
      <div class="featureenable"><input type="checkbox" /></div>
    </div>
  </div>
</template>

<script >
import { defineComponent } from "vue";
import { useElectron } from "../use/electron";

export default defineComponent({
  name: "HelloWorld",
  setup() {
    const {} = useElectron();
    return {};
  },

  mounted() {},

  methods: {},
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.featureList {
  display: flex;
  flex-direction: column;
}
.feature {
  display: flex;
  flex-direction: row;
}
</style>
