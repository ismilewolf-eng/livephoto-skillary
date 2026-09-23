(function (scope) {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    crcTable[n] = value >>> 0;
  }

  async function crc32(blob) {
    let value = 0xffffffff;
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        for (const byte of chunk) {
          value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
        }
      }
    } finally {
      reader.releaseLock();
    }
    return (value ^ 0xffffffff) >>> 0;
  }

  function header(size, name, crc, length, offset) {
    const bytes = new Uint8Array(size + name.length);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, size === 30 ? 0x04034b50 : 0x02014b50, true);
    let pos = 4;
    if (size === 46) {
      view.setUint16(pos, 20, true);
      pos += 2;
    }
    view.setUint16(pos, 20, true); pos += 2;
    view.setUint16(pos, 0x0800, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    view.setUint16(pos, 0x21, true); pos += 2;
    view.setUint32(pos, crc, true); pos += 4;
    view.setUint32(pos, length, true); pos += 4;
    view.setUint32(pos, length, true); pos += 4;
    view.setUint16(pos, name.length, true); pos += 2;
    view.setUint16(pos, 0, true); pos += 2;
    if (size === 46) {
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint16(pos, 0, true); pos += 2;
      view.setUint32(pos, 0, true); pos += 4;
      view.setUint32(pos, offset, true); pos += 4;
    }
    bytes.set(name, pos);
    return bytes;
  }

  async function createStoredZip(entries) {
    if (!entries.length || entries.length > 100) throw new Error('Invalid ZIP entry count');
    const body = [];
    const directory = [];
    let offset = 0;
    for (const entry of entries) {
      if (!entry || !entry.name || !(entry.blob instanceof Blob)) {
        throw new Error('Invalid ZIP entry');
      }
      const name = encoder.encode(entry.name);
      if (name.length > 65535 || entry.blob.size > 0xffffffff) {
        throw new Error('ZIP entry is too large');
      }
      const crc = await crc32(entry.blob);
      const local = header(30, name, crc, entry.blob.size, 0);
      directory.push(header(46, name, crc, entry.blob.size, offset));
      body.push(local, entry.blob);
      offset += local.length + entry.blob.size;
    }
    const centralSize = directory.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    return new Blob([...body, ...directory, end], { type: 'application/zip' });
  }

  scope.createStoredZip = createStoredZip;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createStoredZip };
})(globalThis);
