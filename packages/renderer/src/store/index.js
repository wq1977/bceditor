import { createLogger, createStore } from "vuex";
import editor from "/@/store/modules/editor";
import loadsave from "/@/store/modules/loadsave";

const debug = process.env.NODE_ENV !== "production";
export default createStore({
  state: {},
  mutations: {},
  actions: {
    setvol({ dispatch, commit, state }, payload) {
      commit("editor/setvol", payload);
      console.log("action set vol", payload, state.editor.volumn);
      dispatch("loadsave/save", {
        volumn: state.editor.volumn,
      });
    },
  },
  modules: {
    editor,
    loadsave,
  },
  plugins: debug ? [createLogger()] : [],
});
