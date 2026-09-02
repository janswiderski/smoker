const fs = require('fs');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

function cropToSize(png, width, height) {
  if (png.width === width && png.height === height) return png.data;
  const cropped = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    png.data.copy(cropped, y * width * 4, y * png.width * 4, y * png.width * 4 + width * 4);
  }
  return cropped;
}

function compareImages(baselineBuffer, currentBuffer, diffOutputPath) {
  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);

  const width = Math.min(baseline.width, current.width);
  const height = Math.min(baseline.height, current.height);
  const dimensionsChanged = baseline.width !== current.width || baseline.height !== current.height;

  const diff = new PNG({ width, height });
  const mismatchedPixels = pixelmatch(
    cropToSize(baseline, width, height),
    cropToSize(current, width, height),
    diff.data,
    width,
    height,
    { threshold: 0.1, diffColor: [255, 0, 0], alpha: 0.6 }
  );

  fs.writeFileSync(diffOutputPath, PNG.sync.write(diff));

  return {
    mismatchPercent: (mismatchedPixels / (width * height)) * 100,
    diffPath: diffOutputPath,
    dimensionsChanged,
  };
}

module.exports = { compareImages };
