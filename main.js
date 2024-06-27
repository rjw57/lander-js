const onAnimationFrame = (timestamp) => {
  // Find the canvas and set the width/height to the current screen width/height.
  const canvasEl = document.getElementById("screen");
  const canvasRect = canvasEl.getBoundingClientRect();
  canvasEl.width = canvasRect.width;
  canvasEl.height = canvasRect.height;

  const ctx = canvasEl.getContext("2d");

  // Clear background
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvasRect.width, canvasRect.height);

  // Compute scale factor for width and height to fit a mode 13 screen and choose smallest.
  const canvasScale = Math.min(canvasRect.width / 320, canvasRect.height / 256);
  ctx.scale(canvasScale, canvasScale);

  // Compute required offset given scale to centre the screen.
  ctx.translate(
    0.5 * (canvasRect.width / canvasScale - 320),
    0.5 * (canvasRect.height / canvasScale - 256)
  );

  // Clear screen.
  ctx.fillStyle = "green";
  ctx.fillRect(0, 0, 320, 256);

  // Request callback on next frame.
  window.requestAnimationFrame(onAnimationFrame);
};

// Request callback be called on next frame.
window.requestAnimationFrame(onAnimationFrame);
