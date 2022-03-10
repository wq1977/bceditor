<template>
  <router-view />
</template>

<script>
import { defineComponent } from "vue";
import AppNavigation from "/@/components/AppNavigation.vue";
export default defineComponent({
  name: "App",
  components: {
    AppNavigation,
  },
  mounted() {
    this.$store.dispatch("loadsave/load");
  },
});
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
*:focus {
  outline: none !important;
}
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-height: 100vh;
}
button {
  margin: 0 5px;
  padding: 5px 10px;
}
</style>
