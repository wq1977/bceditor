export function getFrameTotal(plugin) {
  return plugin.offset + plugin.framesInClip;
}

export function getSample(plugin, wavs, pos, framelen, value) {
  const s = pos - plugin.offset;
  if (s < 0 || s > plugin.framesInClip) return 0;
  const level = 1 - s / plugin.framesInClip;
  const targetValue = value * level;
  return targetValue - value;
}

export default {
  getFrameTotal,
  getSample,
};
