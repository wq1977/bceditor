import { createRouter, createWebHashHistory } from "vue-router";
import Home from "/@/components/Home.vue";
import Editor from "/@/components/Editor.vue";

const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/editor", name: "Editor", component: Editor },
  {
    path: "/about",
    name: "About",
    component: () => import("/@/components/About.vue"),
  }, // Lazy load route component
];

export default createRouter({
  routes,
  history: createWebHashHistory(),
});
