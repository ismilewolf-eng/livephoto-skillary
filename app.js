(function () {
  const video = document.getElementById('previewVideo');
  const input = document.getElementById('videoFileInput');
  const drop = document.getElementById('dropArea');
  const title = document.getElementById('dropTitle');
  const status = document.getElementById('dropStatus');
  const controls = document.getElementById('controlsBox');
  const scrubber = document.getElementById('keyframeSlider');
  const frameTime = document.getElementById('keyframeDisplay');
  const exportButton = document.getElementById('exportBtn');
  const phone = document.getElementById('iphoneDevice');
  const screen = document.getElementById('phoneScreen');
  const samples = {
    waves: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
    cyberpunk: 'https://assets.mixkit.co/videos/preview/mixkit-neon-lights-in-a-cyberpunk-city-43187-large.mp4',
    breeze: 'https://assets.mixkit.co/videos/preview/mixkit-tree-branches-in-the-breeze-1188-large.mp4'
  };
  let selectedFile = null;
  let objectUrl = null;
  let ready = false;
  let guideReturnFocus = null;
  let previewing = false;
  let frameBeforePreview = 0;

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16).toUpperCase();
    });
  }

  function injectLivePhotoXmp(jpegBuffer, uuid) {
    if (jpegBuffer[0] !== 0xFF || jpegBuffer[1] !== 0xD8) return jpegBuffer;
    const xmpHeader = "http://ns.adobe.com/xap/1.0/\0";
    const xmpPayload = '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
      '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
      '<rdf:Description rdf:about="" xmlns:AppleLivePhoto="http://ns.apple.com/livephoto/1.0/" ' +
      'AppleLivePhoto:MediaGroupUUID="' + uuid + '"/>' +
      '</rdf:RDF></x:xmpmeta>';
    const encoder = new TextEncoder();
    const headerBytes = encoder.encode(xmpHeader);
    const payloadBytes = encoder.encode(xmpPayload);
    const totalLength = 2 + headerBytes.length + payloadBytes.length;
    const segment = new Uint8Array(2 + totalLength);
    segment[0] = 0xFF; segment[1] = 0xE1;
    segment[2] = (totalLength >> 8) & 0xFF; segment[3] = totalLength & 0xFF;
    segment.set(headerBytes, 4); segment.set(payloadBytes, 4 + headerBytes.length);
    const result = new Uint8Array(jpegBuffer.length + segment.length);
    result.set(jpegBuffer.subarray(0, 2), 0);
    result.set(segment, 2);
    result.set(jpegBuffer.subarray(2), 2 + segment.length);
    return result;
  }

  function buildQuickTimeMetadataBox(uuid) {
    const encoder = new TextEncoder();
    const keyName = encoder.encode("com.apple.quicktime.content.identifier");
    const valBytes = encoder.encode(uuid);
    const keyEntrySize = 4 + 4 + keyName.length;
    const keysBoxSize = 8 + 4 + 4 + keyEntrySize;
    const keysBox = new Uint8Array(keysBoxSize);
    const keysView = new DataView(keysBox.buffer);
    keysView.setUint32(0, keysBoxSize);
    keysBox.set(encoder.encode("keys"), 4);
    keysView.setUint32(12, 1);
    keysView.setUint32(16, keyEntrySize);
    keysBox.set(encoder.encode("mdta"), 20);
    keysBox.set(keyName, 24);
    const dataBoxSize = 8 + 8 + valBytes.length;
    const itemSize = 8 + dataBoxSize;
    const ilstBoxSize = 8 + itemSize;
    const ilstBox = new Uint8Array(ilstBoxSize);
    const ilstView = new DataView(ilstBox.buffer);
    ilstView.setUint32(0, ilstBoxSize);
    ilstBox.set(encoder.encode("ilst"), 4);
    ilstView.setUint32(8, itemSize);
    ilstView.setUint32(12, 1);
    ilstView.setUint32(16, dataBoxSize);
    ilstBox.set(encoder.encode("data"), 20);
    ilstView.setUint32(24, 1);
    ilstBox.set(valBytes, 32);
    const hdlrSize = 8 + 4 + 4 + 4 + 12 + 1;
    const hdlrBox = new Uint8Array(hdlrSize);
    const hdlrView = new DataView(hdlrBox.buffer);
    hdlrView.setUint32(0, hdlrSize);
    hdlrBox.set(encoder.encode("hdlr"), 4);
    hdlrBox.set(encoder.encode("mdta"), 16);
    const metaContentSize = 4 + hdlrSize + keysBoxSize + ilstBoxSize;
    const metaBoxSize = 8 + metaContentSize;
    const metaBox = new Uint8Array(metaBoxSize);
    const metaView = new DataView(metaBox.buffer);
    metaView.setUint32(0, metaBoxSize);
    metaBox.set(encoder.encode("meta"), 4);
    let metaOffset = 12;
    metaBox.set(hdlrBox, metaOffset); metaOffset += hdlrSize;
    metaBox.set(keysBox, metaOffset); metaOffset += keysBoxSize;
    metaBox.set(ilstBox, metaOffset);
    const udtaBoxSize = 8 + metaBoxSize;
    const udtaBox = new Uint8Array(udtaBoxSize);
    const udtaView = new DataView(udtaBox.buffer);
    udtaView.setUint32(0, udtaBoxSize);
    udtaBox.set(encoder.encode("udta"), 4);
    udtaBox.set(metaBox, 8);
    return udtaBox;
  }

  function injectQuickTimeMetadata(videoBuffer, uuid) {
    const view = new DataView(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength);
    const decoder = new TextDecoder();
    let offset = 0, moovOffset = -1, moovSize = 0;
    while (offset < videoBuffer.byteLength) {
      if (offset + 8 > videoBuffer.byteLength) break;
      const size = view.getUint32(offset);
      const type = decoder.decode(videoBuffer.subarray(offset + 4, offset + 8));
      if (size === 0) break;
      const actualSize = size === 1 ? Number(view.getBigUint64(offset + 8)) : size;
      if (type === "moov") { moovOffset = offset; moovSize = actualSize; break; }
      offset += actualSize;
    }
    if (moovOffset === -1) return videoBuffer; // fallback to raw video if moov missing
    const udtaBox = buildQuickTimeMetadataBox(uuid);
    const delta = udtaBox.length;
    const moovEnd = moovOffset + moovSize;
    const newMoov = new Uint8Array(moovSize + delta);
    newMoov.set(videoBuffer.subarray(moovOffset, moovEnd), 0);
    newMoov.set(udtaBox, moovSize);
    const newMoovView = new DataView(newMoov.buffer);
    newMoovView.setUint32(0, moovSize + delta);
    let p = 8;
    while (p < newMoov.length - 8) {
      const bSize = newMoovView.getUint32(p);
      const bType = decoder.decode(newMoov.subarray(p + 4, p + 8));
      if (bSize < 8 || p + bSize > newMoov.length) { p += 4; continue; }
      if (bType === "trak" || bType === "mdia" || bType === "minf" || bType === "stbl") { p += 8; continue; }
      if (bType === "stco") {
        const entryCount = newMoovView.getUint32(p + 12);
        for (let i = 0; i < entryCount; i++) {
          const entryPos = p + 16 + i * 4;
          const currentOffset = newMoovView.getUint32(entryPos);
          if (currentOffset > moovOffset) newMoovView.setUint32(entryPos, currentOffset + delta);
        }
      } else if (bType === "co64") {
        const entryCount = newMoovView.getUint32(p + 12);
        for (let i = 0; i < entryCount; i++) {
          const entryPos = p + 16 + i * 8;
          const currentOffset = newMoovView.getBigUint64(entryPos);
          if (currentOffset > BigInt(moovOffset)) newMoovView.setBigUint64(entryPos, currentOffset + BigInt(delta));
        }
      }
      p += bSize;
    }
    const finalVideo = new Uint8Array(videoBuffer.length + delta);
    finalVideo.set(videoBuffer.subarray(0, moovOffset), 0);
    finalVideo.set(newMoov, moovOffset);
    finalVideo.set(videoBuffer.subarray(moovEnd), moovOffset + newMoov.length);
    return finalVideo;
  }

  function setStatus(message) { status.textContent = message; }
  function setReady(value) {
    ready = value;
    exportButton.disabled = !value;
  }
  function releaseFile() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    selectedFile = null;
    setReady(false);
  }

  function chooseFile(file) {
    if (!file) return;
    const ext = file.name.match(/\.(mp4|mov|webm)$/i);
    if (!ext || file.size === 0 || file.size > 100 * 1024 * 1024) {
      releaseFile();
      setStatus('Choose a non-empty MP4, MOV, or WebM file under 100 MB.');
      return;
    }
    releaseFile();
    selectedFile = file;
    objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.load();
    controls.classList.add('active');
    title.textContent = 'Loaded: ' + file.name;
    setStatus('Loading video locally…');
    input.value = '';
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove('dragover');
    });
  });
  drop.addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));
  drop.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', event => chooseFile(event.target.files[0]));

  window.loadSample = function (name) {
    releaseFile();
    video.src = samples[name] || samples.waves;
    video.load();
    controls.classList.remove('active');
    title.textContent = 'Sample preview: ' + name;
    setStatus('Preview only. Upload your own video to download a ZIP.');
  };
  window.openGuide = function () {
    guideReturnFocus = document.activeElement;
    document.getElementById('guideModal').classList.add('open');
    document.querySelector('#guideModal .btn-close-modal').focus();
  };
  window.closeGuide = function () {
    document.getElementById('guideModal').classList.remove('open');
    guideReturnFocus?.focus();
  };
  document.getElementById('guideModal').addEventListener('keydown', event => {
    if (event.key === 'Escape') window.closeGuide();
    if (event.key === 'Tab') {
      event.preventDefault();
      document.querySelector('#guideModal .btn-close-modal').focus();
    }
  });

  video.addEventListener('loadedmetadata', () => {
    scrubber.max = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : 0;
    scrubber.value = 0;
    frameTime.textContent = '0.00s';
  });
  video.addEventListener('loadeddata', () => {
    if (selectedFile) {
      setReady(true);
      setStatus('Move the slider to choose a frame, then download the ZIP.');
    }
  });
  video.addEventListener('error', () => {
    if (selectedFile) {
      setReady(false);
      setStatus('This browser cannot decode that video. Try an H.264 MP4.');
    }
  });
  video.addEventListener('seeking', () => setReady(false));
  video.addEventListener('seeked', () => {
    if (selectedFile && video.readyState >= 2) setReady(true);
  });
  scrubber.addEventListener('input', () => {
    const seconds = Number(scrubber.value);
    video.currentTime = seconds;
    frameTime.textContent = seconds.toFixed(2) + 's';
  });

  function previewStart() {
    if (previewing) return;
    previewing = true;
    frameBeforePreview = video.currentTime || 0;
    phone.classList.add('pressing');
    screen.classList.add('animating');
    video.play().catch(() => {});
  }
  function previewEnd() {
    if (!previewing) return;
    previewing = false;
    phone.classList.remove('pressing');
    screen.classList.remove('animating');
    video.pause();
    if (Number.isFinite(frameBeforePreview) && video.readyState >= 1) {
      video.currentTime = frameBeforePreview;
    }
  }
  phone.addEventListener('pointerdown', previewStart);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
    phone.addEventListener(eventName, previewEnd);
  });
  phone.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      previewStart();
    }
  });
  phone.addEventListener('keyup', event => {
    if (event.key === ' ' || event.key === 'Enter') previewEnd();
  });

  exportButton.addEventListener('click', async () => {
    if (!ready || !selectedFile) return;
    setReady(false);
    setStatus('Synthesizing Apple Live Photo metadata on your device…');
    try {
      const assetUuid = generateUUID();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (!canvas.width || !canvas.height) throw new Error('No video frame is available');
      canvas.getContext('2d').drawImage(video, 0, 0);
      const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!image) throw new Error('Could not encode the selected frame');
      const imageBuffer = new Uint8Array(await image.arrayBuffer());
      const pairedJpegBytes = injectLivePhotoXmp(imageBuffer, assetUuid);
      const pairedJpegBlob = new Blob([pairedJpegBytes], { type: 'image/jpeg' });

      const rawVideoBuffer = new Uint8Array(await selectedFile.arrayBuffer());
      const pairedMovBytes = injectQuickTimeMetadata(rawVideoBuffer, assetUuid);
      const pairedMovBlob = new Blob([pairedMovBytes], { type: 'video/quicktime' });

      const readme = new Blob([
        'Apple Live Photo Asset Bundle\n',
        '=============================\n',
        'Asset UUID: ' + assetUuid + '\n',
        'Paired Files:\n',
        '- IMG_LIVE.JPG (Apple ContentIdentifier Key 17 / XMP)\n',
        '- IMG_LIVE.MOV (QuickTime mdta ContentIdentifier metadata)\n\n',
        'How to save into iPhone Photos:\n',
        '1. AirDrop or unarchive this ZIP on your iPhone.\n',
        '2. Open the "Files" app.\n',
        '3. Select both IMG_LIVE.JPG and IMG_LIVE.MOV.\n',
        '4. Tap Share -> "Save to Photos".\n',
        '5. iOS will recognize both paired assets and merge them into 1 native Live Photo!\n'
      ], { type: 'text/plain' });
      const zip = await window.createStoredZip([
        { name: 'IMG_LIVE.JPG', blob: pairedJpegBlob },
        { name: 'IMG_LIVE.MOV', blob: pairedMovBlob },
        { name: 'README_SAVE_TO_IPHONE.txt', blob: readme }
      ]);
      const url = URL.createObjectURL(zip);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'LivePhoto-' + assetUuid.slice(0, 8) + '.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      const message = 'Downloaded paired Apple Live Photo ZIP (IMG_LIVE.JPG + MOV).';
      setStatus(message);
      setTimeout(() => {
        if (status.textContent === message) setStatus('Move the slider to choose a frame, then download Live Photo.');
      }, 5000);
    } catch (error) {
      setStatus('Export failed: ' + error.message);
    } finally {
      setReady(Boolean(selectedFile && video.readyState >= 2 && !video.seeking));
    }
  });
})();
