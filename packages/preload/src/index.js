import { contextBridge, ipcRenderer, clipboard } from "electron";
import WavFile from "./WavFile";
import fadein from "./plugin/fadein";
import fadeout from "./plugin/fadeout";

const allPlugins = {
  fadein,
  fadeout,
};
var fs = require("fs");
var Speaker = require("speaker");
const bufferAlloc = require("buffer-alloc");
const md5 = require("md5");
const lamejs = require("lamejs");
const { machineIdSync } = require("node-machine-id");
const apiKey = "electron";
let bufferReader, playing, speaker;

const audioDecode = require("audio-decode");

let key = false;
try {
  key = JSON.parse(
    require("fs")
      .readFileSync(
        require("path").join(require("os").homedir(), ".bceditor.json")
      )
      .toString()
  );
} catch (ex) {
  console.log("error when parse config file", ex);
}

let wavSources = {};
let beepSample;
let fileBase;

const tencentcloud = require("tencentcloud-sdk-nodejs");
const AsrClient = tencentcloud.asr.v20190614.Client;
const clientConfig = {
  credential: {
    secretId: key.tsid,
    secretKey: key.tkey,
  },
  region: key.tzone,
  profile: {
    httpProfile: {
      endpoint: "asr.tencentcloudapi.com",
    },
  },
};

const client = new AsrClient(clientConfig);

function init() {
  const HZ = 1000;
  const VOLUMN = 0.5;
  beepSample = new Float32Array(44100);
  const frameinUnit = beepSample.length / HZ;
  for (let i = 0; i < beepSample.length; i++) {
    beepSample[i] = Math.sin((Math.PI * 2 * i) / frameinUnit) * VOLUMN;
  }
}
init();

const api = {
  versions: process.versions,
  txkey: key,
  machineId: machineIdSync(),
  async selectMedia(path) {
    if (!path) {
      const result = await ipcRenderer.invoke("select-media");
      path = result.filePaths[0];
    }
    const id = md5(path);
    const buffer = await audioDecode(require("fs").readFileSync(path));
    wavSources[id] = {
      path,
      id,
      channelData: Array.from(new Array(buffer.channels)).map((_, idx) => {
        return buffer.getChannelData(idx);
      }),
    };
    return { id, path, length: wavSources[id].channelData[0].length };
  },
  async copy(text) {
    clipboard.writeText(text);
  },
  async paste() {
    return clipboard.readText();
  },
  writeFileSync(path, cnt) {
    require("fs").writeFileSync(path, cnt);
  },
  readFileSync(path) {
    return require("fs").readFileSync(path).toString();
  },
  async openProj() {
    return await ipcRenderer.invoke("select-proj");
  },
  async joinWav() {
    const result = await ipcRenderer.invoke("select-wavs");
    const wavs = result.filePaths.map((path) => {
      let buffer = fs.readFileSync(path);
      return wav.decode(buffer);
    });
    const totalLen = wavs.reduce((r, i) => r + i.channelData[0].length, 0);
    const buf = new Float32Array(totalLen);
    let offset = 0;
    wavs.forEach((wav) => {
      buf.set(wav.channelData[0], offset);
      offset += wav.channelData[0].length;
    });
    const buffer = wav.encode([buf], {
      sampleRate: wavs[0].sampleRate,
      float: true,
      bitDepth: 32,
    });
    const result2 = await ipcRenderer.invoke(
      "save-wav",
      result.filePaths[0].split("/").slice(0, -1).concat(["join.wav"]).join("/")
    );
    const wavPath = result2.filePath;
    fs.writeFileSync(wavPath, buffer);
  },
  async selectWavs(pathes) {
    if (!pathes) {
      const result = await ipcRenderer.invoke("select-wavs");
      pathes = result.filePaths.map((path) => ({
        path,
        id: md5(path),
      }));
    }
    if (pathes.length > 0) {
      fileBase = require("path").dirname(pathes[0].path);
    }
    let result = [];
    for (let path of pathes) {
      let wave = new WavFile(path.path);
      await wave.init();
      wave.id = path.id;
      wave.path = path.path;
      const frameLen = wave.frameLen;
      wavSources[path.id] = wave;
      result.push({ ...path, frameLen });
    }
    return result;
  },
  async loadasr(path) {
    if (!path) {
      const result = await ipcRenderer.invoke("select-asr");
      path = result.filePaths[0];
    }
    const cnt = require(path);
    let lines = cnt.Data.ResultDetail.map((line) => ({
      startms: line.StartMs,
      endms: line.EndMs,
      sentence: line.FinalSentence,
      words: line.Words,
    }));
    return {
      path,
      lines,
    };
  },
  /**
   *
   * @param {*} plugins
   * 插件数组，插件的定义是 {
   *  id:     声音id
   *  total:  声音frame长度
   *  offset: 声音全局偏移
   *  volumns: 音量数组 [[0,1.0], [44100:0.5] ...]
   * }
   * @returns
   */
  pluginGetFrameTotal(plugins) {
    return Math.max(
      0,
      ...(plugins || []).map((item) =>
        allPlugins[item.type].getFrameTotal(item)
      )
    );
  },
  pluginGetSample(plugins, pos, mainFrameLen = -1, srcValue = 0) {
    return (plugins || []).reduce(
      (r, plugin) =>
        r +
        allPlugins[plugin.type].getSample(
          plugin,
          wavSources,
          pos,
          mainFrameLen,
          srcValue
        ),
      0
    );
  },
  async exportWav(wavs, volfn, opts, progressFn, plugins) {
    const fn = async (name, p) => {
      progressFn(name, p);
      await api.sleep(10);
    };
    const length1 = api.getFrameTotal(opts);
    const length2 = api.pluginGetFrameTotal(plugins);
    const length = Math.max(length1, length2);
    const channelData = new Int16Array(length);
    wavs = wavs.map((wav) => wavSources[wav.id]);
    const volumn = volfn();
    await fn("wav", 0);
    for (let i = 0; i < length; i++) {
      let frame1 = 0;
      if (i < length1) {
        const [pos, piece] = api.relative2Real(opts, i);
        frame1 = await api.getSampleInternal(wavs, volumn, piece, pos, true);
      }
      const frame2 = api.pluginGetSample(plugins, i, length1, frame1);
      channelData[i] = api.float2int(frame1 + frame2);
      if (i % (44100 * 5) === 0) {
        await fn("wav", i / length);
      }
    }
    await fn("wav", 1);
    const channels = 1; //1 for mono or 2 for stereo
    const sampleRate = 44100; //44.1khz (normal mp3 samplerate)
    const kbps = 320; //encode 128kbps mp3
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
    const sampleBlockSize = 115200 * 2;
    var mp3Data = [];
    var mp3len = 0;
    for (var i = 0; i < channelData.length; i += sampleBlockSize) {
      console.log("mp3 progress:", i / channelData.length);
      await fn("mp3", i / channelData.length);
      const sampleChunk = channelData.subarray(i, i + sampleBlockSize);
      var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3len += mp3buf.length;
        mp3Data.push(Buffer.from(mp3buf));
      }
    }
    var mp3buf = mp3encoder.flush(); //finish writing mp3
    if (mp3buf.length > 0) {
      mp3len += mp3buf.length;
      mp3Data.push(Buffer.from(mp3buf));
    }
    var mp3data = Buffer.concat(mp3Data, mp3len);
    const result = await ipcRenderer.invoke(
      "select-mp3",
      wavs[0].path.split("/").slice(0, -1).concat(["export.mp3"]).join("/")
    );
    const mp3Path = result.filePath;
    fs.writeFileSync(mp3Path, mp3data);
    await fn("mp3", 1);
  },
  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  async asr(wavs, volfn, progressFn) {
    let ps = async (name, p) => {
      progressFn(name, p);
      await api.sleep(10);
    };
    const mp3Path = require("path").join(fileBase, "merge.mp3");
    const jsonPath = require("path").join(fileBase, "asr.json");
    await ps("wav", 0);
    if (
      !require("fs").existsSync(mp3Path) &&
      !require("fs").existsSync(jsonPath)
    ) {
      //语音识别
      //将多个语音合并为一个语音，然后进行语音识别
      const length = Math.max(
        ...wavs.map((wav) => wavSources[wav.id].frameLen)
      );
      const channelData = new Int16Array(length);
      wavs = wavs.map((wav) => wavSources[wav.id]);
      const volumn = volfn();
      for (let i = 0; i < length; i++) {
        channelData[i] = await api.getSampleInternal(wavs, volumn, {}, i);
        if (i % (44100 * 5) === 0) {
          await ps("wav", i / length);
        }
      }
      await ps("wav", 1);
      const channels = 1; //1 for mono or 2 for stereo
      const sampleRate = 44100; //44.1khz (normal mp3 samplerate)
      const kbps = 128; //encode 128kbps mp3
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
      const sampleBlockSize = 115200 * 2;
      var mp3Data = [];
      var mp3len = 0;
      for (var i = 0; i < channelData.length; i += sampleBlockSize) {
        console.log("mp3 progress:", i / channelData.length);
        await ps("mp3", i / channelData.length);
        const sampleChunk = channelData.subarray(i, i + sampleBlockSize);
        var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3len += mp3buf.length;
          mp3Data.push(Buffer.from(mp3buf));
        }
      }
      var mp3buf = mp3encoder.flush(); //finish writing mp3
      if (mp3buf.length > 0) {
        mp3len += mp3buf.length;
        mp3Data.push(Buffer.from(mp3buf));
      }
      var mp3data = Buffer.concat(mp3Data, mp3len);
      fs.writeFileSync(mp3Path, mp3data);
      await ps("mp3", 1);
    } else {
      console.log("mp3 exists");
    }
    if (!require("fs").existsSync(jsonPath)) {
      const ossKey =
        "mp3/" +
        new Date().getTime() * 100 +
        Math.floor(Math.random() * 100) +
        ".mp3";

      const url = await api.push2Oss(mp3Path, ossKey, ps);
      const taskid = await api.asrRemote(url);
      let retryTimes = 0;
      while (true) {
        const result = await api.asrRemoteQuery(taskid);
        if (result.Data.Status == 2) {
          await ps("asr", 1);
          require("fs").writeFileSync(jsonPath, JSON.stringify(result));
          await api.deleteOss(ossKey);
          break;
        } else if (result.Data.Status == 0) {
          await ps("asr", 0.1);
        } else if (result.Data.Status == 1) {
          retryTimes++;
          await ps("asr", Math.min(0.3 + retryTimes * 0.1, 0.9));
        }
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }
    return jsonPath;
  },
  async asrRemoteQuery(taskid) {
    const params = {
      TaskId: taskid,
    };
    return client.DescribeTaskStatus(params);
  },
  async asrRemote(url) {
    const params = {
      EngineModelType: "16k_zh",
      ChannelNum: 1,
      ResTextFormat: 1,
      SourceType: 0,
      Url: url,
    };
    const result = await client.CreateRecTask(params);
    return result.Data.TaskId;
  },
  async deleteOss(ossKey) {
    var COS = require("cos-nodejs-sdk-v5");
    var cos = new COS({
      SecretId: key.tsid,
      SecretKey: key.tkey,
    });
    await cos.deleteObject({
      Bucket: key.tbucket /* 必须 */,
      Region: key.tzone /* 存储桶所在地域，必须字段 */,
      Key: ossKey /* 必须 */,
    });
  },
  async push2Oss(path, ossKey, progressFn) {
    var COS = require("cos-nodejs-sdk-v5");
    var cos = new COS({
      SecretId: key.tsid,
      SecretKey: key.tkey,
    });
    return new Promise((resolve) => {
      cos.uploadFile(
        {
          Bucket: key.tbucket /* 必须 */,
          Region: key.tzone /* 存储桶所在地域，必须字段 */,
          Key: ossKey /* 必须 */,
          FilePath: path /* 必须 */,
          SliceSize:
            1024 *
            1024 *
            5 /* 触发分块上传的阈值，超过5MB使用分块上传，非必须 */,
          onTaskReady: function (taskId) {
            /* 非必须 */
            console.log(taskId);
          },
          onProgress: async function (progressData) {
            /* 非必须 */
            console.log(JSON.stringify(progressData));
            await progressFn(
              "upload",
              progressData.loaded / progressData.total
            );
          },
          onFileFinish: function (err, data, options) {
            console.log(options.Key + "上传" + (err ? "失败" : "完成"));
          },
        },
        async function (err, data) {
          await progressFn("upload", 1);
          resolve("https://" + data.Location);
        }
      );
    });
  },
  stop() {
    // speaker.close();
    playing = false;
  },
  async getSample(wavs, volfn, piece, s, float = false) {
    wavs = wavs.map((wav) => wavSources[wav.id]);
    const volumn = volfn();
    return await api.getSampleInternal(wavs, volumn, piece, s, float);
  },

  async getSampleInternal(wavs, volumn, piece, s, float = false) {
    let v;
    const Volumn = 0.07;
    if (piece.type === "beep") {
      const T = (Math.PI * 2 * 1000) / 44100;
      v = Math.sin(T * s) * Volumn;
    } else if (piece.type === "mute") {
      v = 0;
    } else {
      let mixValue = 0;
      for (let wav of wavs) {
        if (!piece.enabled || piece.enabled[wav.id]) {
          const value = await wav.getSample(0, s);
          const thisvalue =
            (value || 0) *
            (volumn[wav.id] || 1) *
            (piece.volumns ? piece.volumns[wav.id] || 1 : 1);
          mixValue += thisvalue;
        }
      }
      v = Math.max(-1, Math.min(mixValue * (volumn.main || 1), 1));
    }

    if (float) return v;
    return api.float2int(v);
  },

  //使用opts作为参数，兼容将来可能的添加开始结束位置的操作
  getFrameTotal(opts) {
    return opts.pieces.reduce(
      (r, piece) => r + piece.seeklimit - piece.seekpos + 1,
      0
    );
  },
  real2Relative(opts, realpos) {
    let result = 0;
    for (let piece of opts.pieces) {
      if (realpos >= piece.seekpos && realpos <= piece.seeklimit) {
        result += realpos - piece.seekpos;
        break;
      } else {
        result += piece.seeklimit - piece.seekpos + 1;
      }
    }
    return result;
  },
  relative2Real(opts, relativepos) {
    for (let piece of opts.pieces) {
      const linelength = piece.seeklimit - piece.seekpos + 1;
      if (relativepos > linelength) {
        relativepos -= linelength;
        if (relativepos < 0) {
          throw new Error("wrong params!");
        }
      } else {
        return [piece.seekpos + relativepos, piece];
      }
    }
    throw new Error("wrong params!");
  },
  float2int(val) {
    const v = Math.max(-1, Math.min(val, 1));
    return Math.round(32760 * v);
  },
  // opts {pieces: [seekpos seeklimit]}
  //
  play(wavs, volfn, opts, callback, plugins) {
    console.log("do play", opts);
    wavs = wavs.map((wav) => wavSources[wav.id]);
    const Readable = require("stream").Readable;

    playing = true;
    bufferReader = new Readable();
    bufferReader.bitDepth = 16;
    bufferReader.channels = 1;
    bufferReader.sampleRate = 44100;
    bufferReader.samplesGenerated = 0;
    bufferReader.pieceIdx = 0;
    const pluginTotal = api.pluginGetFrameTotal(plugins);
    const srcTotal = api.getFrameTotal(opts);
    const mediaLen = Math.max(pluginTotal, srcTotal);
    console.log("play with length", srcTotal, pluginTotal);
    bufferReader._read = async function (n) {
      if (!playing) {
        console.log("playing was set to false");
        bufferReader.destroy();
        setTimeout(() => {
          speaker.close();
          speaker = null;
        }, 1000);
        return;
      }
      const sampleSize = this.bitDepth / 8;
      const blockAlign = sampleSize * this.channels;
      const numSamples = Math.ceil(n / blockAlign) | 0;
      const buf = bufferAlloc(numSamples * blockAlign);
      let s;
      const volumn = volfn();
      let pos, piece;
      for (let i = 0; i < numSamples; i++) {
        s = this.samplesGenerated + i;
        if (s >= mediaLen) {
          playing = false;
          break;
        }
        try {
          let val1 = 0;
          if (s < srcTotal) {
            [pos, piece] = api.relative2Real(opts, s);
            val1 = await api.getSampleInternal(wavs, volumn, piece, pos, true);
          }
          const val2 = api.pluginGetSample(plugins, s, srcTotal, val1);
          const val = api.float2int(val1 + val2);
          const offset = i * sampleSize;
          buf[`writeInt${this.bitDepth}LE`](val, offset);
        } catch (ex) {
          console.log(ex);
          // if (s < pluginTotal) {
          //   const v = api.pluginGetSample(plugins, s);
          //   const val = api.float2int(v);
          //   const offset = i * sampleSize;
          //   buf[`writeInt${this.bitDepth}LE`](val, offset);
          //   continue;
          // }
          console.log("play finish");
          playing = false;
          break;
        }
      }
      this.push(buf);
      this.samplesGenerated = s + 1;
      if (!playing) {
        callback(false);
      } else {
        callback(true, piece ? piece.originidx : -1, s);
      }
    };
    if (speaker) {
      speaker.close();
    }
    speaker = new Speaker({
      channels: 1,
      sampleRate: 44100,
      bitDepth: 32,
    });
    bufferReader.pipe(speaker);
  },
};

/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */
contextBridge.exposeInMainWorld(apiKey, api);
