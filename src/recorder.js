// Hidden window: records the screen and streams chunks to the main process, which writes them to
// the run folder. MP4 is preferred so the file opens in QuickTime; WebM is the fallback.
const MIME_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
const CHUNK_INTERVAL_MS = 1000;
const VIDEO_BITS_PER_SECOND = 4_000_000;

let recorder = null;
// Chunks are converted asynchronously; chaining keeps them in order and lets "stopped" wait for the last one.
let pendingChunks = Promise.resolve();

window.api.onRecorderStart(async ({ sourceId, width, height }) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: width,
          maxHeight: height,
          maxFrameRate: 30,
        },
      },
    });
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      pendingChunks = pendingChunks.then(async () => window.api.sendRecorderChunk(await event.data.arrayBuffer()));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      pendingChunks.then(() => window.api.recorderStopped());
    };
    window.api.recorderStarted(mimeType);
    recorder.start(CHUNK_INTERVAL_MS);
  } catch (err) {
    window.api.recorderError(err.message || String(err));
  }
});

window.api.onRecorderStop(() => {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  } else {
    window.api.recorderStopped();
  }
});
