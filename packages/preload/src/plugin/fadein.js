export function getSample(plugin, wavs, pos, framelen, value) {
  const s = pos - plugin.offset;

  if (s >= 0 && s < plugin.media.length) {
    const v = wavs[plugin.media.id].channelData[0][s];
    if (pos < framelen) {
      return v * plugin.mainVolumn;
    } else if (pos >= framelen && pos < 44100 + framelen) {
      const delta = pos - framelen;
      return (
        v *
        (plugin.mainVolumn +
          (delta * (plugin.maxVolumn - plugin.mainVolumn)) / 44100)
      );
    } else if (pos >= framelen + 44100) {
      return v * plugin.maxVolumn;
    }
  }
  return 0;
}

export function getFrameTotal(plugin) {
  return plugin.media.length + plugin.offset;
}

export default {
  getFrameTotal,
  getSample,
};
