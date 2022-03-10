/**
 *
 * 为降低内存的使用，提高可以同时支持的音轨的数量，并且提高加载速度
 * 创建这个中间类
 *
 * 基本的想法是用磁盘空间替换内容空间，对于一些只读wav，提供快速访问
 *
 */
const BUFFER_LEN = 1024 * 1024;
const FP = require("fs/promises");
export default class WavFile {
  constructor(path) {
    this._path = path;
  }
  async init() {
    if (this._wavFile) return;
    this._wavFile = await FP.open(this._path);
    const stat = await FP.stat(this._path);
    let zoneStart = 0;
    while (zoneStart < stat.size) {
      const name = await this.readStr(zoneStart, 4);
      if (name === "fmt ") {
        this._fmtZoneOffset = zoneStart;
      } else if (name === "data") {
        this._dataZoneOffset = zoneStart;
      }
      const size = await this.readInt32(zoneStart + 4, 4);
      zoneStart += zoneStart === 0 ? 12 : size + 8;
    }
    if (!this._fmtZoneOffset) {
      throw new Error(`wav error, expect fmt`);
    }
    const audioFormat = await this.readInt16(this._fmtZoneOffset + 8, 2);
    if (audioFormat !== 1) {
      throw new Error(`wav error, expect wave`);
    }
    if (!this._dataZoneOffset) {
      throw new Error(`wav error, expect data`);
    }
    const dataSize = await this.readInt32(this._dataZoneOffset + 4);
    this.channels = await this.readInt16(this._fmtZoneOffset + 10);
    this.sampleRate = await this.readInt32(this._fmtZoneOffset + 12);
    this.bitsPerSample = await this.readInt16(this._fmtZoneOffset + 22);
    this.bytesPerSample = (this.channels * this.bitsPerSample) / 8;
    this.frameLen = dataSize / this.bytesPerSample;
    this._buffer = Buffer.alloc(BUFFER_LEN);
    this.bufferSampleLen = BUFFER_LEN / this.bytesPerSample;
    await this.prepareBuffer(0);
  }
  async readStr(offset, length) {
    const buffer = await this.read(offset, length);
    return this.buf2str(buffer);
  }
  async readInt16(offset) {
    const buffer = await this.read(offset, 2);
    return this.buf2int16(buffer);
  }
  async readInt32(offset) {
    const buffer = await this.read(offset, 4);
    return this.buf2int32(buffer);
  }
  async prepareBuffer(idx) {
    this._bufferStart = idx;
    if (this._bufferStart + this.bufferSampleLen >= this.frameLen) {
      this._bufferStart = this.frameLen - this.bufferSampleLen;
    }
    if (this._bufferStart < 0) this._bufferStart = 0;
    await this._wavFile.read(
      this._buffer,
      0,
      BUFFER_LEN,
      this._bufferStart * this.bytesPerSample + this._dataZoneOffset + 8
    );
  }
  real2buf(idx) {
    if (
      idx >= this._bufferStart &&
      idx < this._bufferStart + this.bufferSampleLen
    )
      return idx - this._bufferStart;
    return -1;
  }
  async getSample(channel, idx) {
    let bufidx = this.real2buf(idx);
    if (bufidx < 0) {
      await this.prepareBuffer(idx);
      bufidx = this.real2buf(idx);
    }
    if (bufidx < 0) {
      return 0;
    }
    //TODO readInt16LE: should use different method based on bitsPerSample
    const byteidx =
      this.bytesPerSample * bufidx + (this.bitsPerSample * channel) / 8;
    const data = this._buffer.readInt16LE(byteidx);
    const result = data < 0 ? data / 32768 : data / 32767;
    return result;
  }
  async read(offset, length) {
    const { bytesRead, buffer } = await this._wavFile.read(
      Buffer.alloc(length),
      0,
      length,
      offset
    );
    if (bytesRead !== length) throw new Error("read file mis length");
    return buffer;
  }
  buf2str(buf) {
    return buf.toString();
  }
  buf2int16(buf) {
    return buf.readInt16LE();
  }
  buf2int32(buf) {
    return buf.readInt32LE();
  }
}
