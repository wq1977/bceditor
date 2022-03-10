// /**
//  * 从本地插件结构转换成通用插件结构
//  * @param {*} plugin
//  */
// export function convertPlugin(plugin, clipFrameTotal) {
//   if (plugin.type === "mix") {
//     //TODO fadein 算法到底应该怎么搞
//     if (plugin.mixType === "fadein") {
//       //1秒钟淡入，保持主音量,等到片段结束时，恢复到结束音量
//       const volumns = [
//         [0, plugin.mainVolumn],
//         [clipFrameTotal - plugin.offset, plugin.maxVolumn],
//       ];
//       return {
//         id: plugin.media.id,
//         total: plugin.media.length,
//         offset: plugin.offset,
//         volumns,
//       };
//     }
//   }
//   throw new Error("unknown plugin");
// }

/**
 *
 * 将某一段充满各种操作的剪辑转化成一个个单一的剪辑
 *
 * @param {*} clip
 * @param {*} originidx
 * @returns
 *
 * 返回第一个字段是新建的片段，第二个字段是其中可能使用的插件，插件的offset是相对于这个片段的
 *
 */
export function clip2pieces(clip, originidx) {
  const pieces = [];
  let plugins = [];
  let laststart = 0;
  let lastOpt = clip.words[0].opt || "";
  let thisopt;
  let offset = 0;

  for (let i = 0; i < clip.words.length; i++) {
    thisopt = clip.words[i].opt || "";
    if (clip.words[i].plugins) {
      plugins = [
        ...plugins,
        ...clip.words[i].plugins.map((p) => ({
          ...p,
          offset,
        })),
      ];
    }
    if (thisopt !== "del") {
      offset +=
        ((clip.startms +
          clip.words[i].OffsetEndMs -
          (i == 0
            ? clip.startms
            : clip.startms + clip.words[i].OffsetStartMs)) *
          44100) /
        1000;
    }

    if (thisopt !== lastOpt) {
      if (lastOpt === "del" || i === 0) {
        laststart = i;
        lastOpt = thisopt;
        continue;
      }
      const msstart =
        laststart === 0
          ? clip.startms
          : clip.startms + clip.words[laststart].OffsetStartMs;
      const msend = clip.startms + clip.words[i - 1].OffsetEndMs;
      pieces.push({
        seekpos: Math.floor((msstart * 44100) / 1000),
        seeklimit: Math.ceil((msend * 44100) / 1000),
        type: lastOpt,
        originidx,
        enabled: clip.enabled && { ...clip.enabled },
      });
      laststart = i;
      lastOpt = thisopt;
    }
  }
  if (thisopt !== "del") {
    const msstart =
      laststart === 0
        ? clip.startms
        : clip.startms + clip.words[laststart].OffsetStartMs;
    const msend = clip.endms;
    pieces.push({
      seekpos: Math.floor((msstart * 44100) / 1000),
      seeklimit: Math.ceil((msend * 44100) / 1000),
      type: lastOpt,
      originidx,
      enabled: clip.enabled && { ...clip.enabled },
    });
  }

  pieces.forEach((piece) => {
    if (clip.volumns) {
      piece.volumns = { ...clip.volumns };
    }
  });

  const total = pieces.reduce((v, i) => (v += i.seeklimit - i.seekpos), 0);
  plugins.forEach((plugin) => {
    plugin.framesInClip = total - plugin.offset;
  });
  return { pieces, plugins };
}
