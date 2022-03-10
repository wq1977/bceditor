import { useElectron } from "../../use/electron";
const { writeFileSync, readFileSync } = useElectron();

const state = {};
const autosavePath = "/tmp/autosave.json";
const actions = {
  save({ commit, state }, payload) {
    commit("set", payload || {});
    const cnt = JSON.stringify(state);
    writeFileSync(autosavePath, cnt);
    if (state.wavs.length > 0) {
      const params = state.wavs[0].path.split("/");
      params[params.length - 1] = "proj.json";
      writeFileSync(params.join("/"), cnt);
    }
  },
  load({ commit }, path) {
    try {
      const str = readFileSync(path || autosavePath);
      const state = JSON.parse(str);
      commit("set", state);
    } catch (ex) {
      console.log(ex);
    }
  },
  clear({ commit }) {
    commit("clear");
    writeFileSync(autosavePath, JSON.stringify(state));
  },
};
const mutations = {
  clear(state) {
    for (let key in state) {
      delete state[key];
    }
  },
  set(state, payload) {
    for (let key in payload) {
      state[key] = payload[key];
    }
  },
};
export default {
  namespaced: true,
  state,
  actions,
  mutations,
};
