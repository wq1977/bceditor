const MAX_LAYOUT_NUMBER = 2;
const state = () => ({
  wavs: [],
  cursor: {
    pos: 0,
  },
  layout: 1,
  sampleRate: 44100,
  zoom: 1,
  canvasw: 0,
  canvash: 0,
  startSampleIdx: 0,
  sampleLength: 0,
  endSampleIdx: 0,
  playing: false,
  volumn: {},
  disabled: {},
});

// actions
const actions = {};

// mutations
const mutations = {
  nextLayout(state) {
    state.layout = (state.layout + 1) % MAX_LAYOUT_NUMBER;
  },
  result(state, result) {
    state.result = result;
  },
  pan(state, delta) {
    const length = state.endSampleIdx - state.startSampleIdx;
    state.startSampleIdx = Math.floor(
      state.startSampleIdx + (delta * length) / state.canvasw
    );
    if (state.startSampleIdx < 0) state.startSampleIdx = 0;
    if (state.startSampleIdx > state.sampleLength - length)
      state.startSampleIdx = state.sampleLength - length;
    state.endSampleIdx = state.startSampleIdx + length;
  },
  scale(state, delta) {
    let scale = state.zoom - delta;
    if (scale < 1) scale = 1;
    const center = (state.startSampleIdx + state.endSampleIdx) / 2;
    const length = state.sampleLength / scale;
    if (length > 10 * state.sampleRate) {
      state.startSampleIdx = Math.floor(center - length / 2);
      state.endSampleIdx = Math.floor(center + length / 2);
      if (state.startSampleIdx < 0) state.startSampleIdx = 0;
      if (state.endSampleIdx > state.sampleLength)
        state.endSampleIdx = state.sampleLength;
      state.zoom =
        state.sampleLength / (state.endSampleIdx - state.startSampleIdx);
    }
  },
  set(state, payload) {
    for (let key in payload) {
      state[key] = payload[key];
    }
  },
  setenabled(state, payload) {
    const { id, value } = payload;
    state.disabled[id] = !value;
  },
  setvol(state, payload) {
    const { id, volumn } = payload;
    state.volumn[id] = volumn;
  },
  cursor(state, pos) {
    state.cursor.pos = pos;
  },
};

export default {
  namespaced: true,
  state,
  actions,
  mutations,
};
