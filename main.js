(() => {
  // Screen width and height.
  const SCREEN_W = 320;
  const SCREEN_H = 256;

  // The size of one tile in world co-ordinates.
  const TILE_SIZE = 0x01000000;

  // Count of displayed tile corners.
  const TILES_X = 13;
  const TILES_Z = 11;

  // Fixed altitudes
  const SEA_LEVEL = 0x05500000;
  const LAUNCHPAD_ALTITUDE = 0x03500000;
  const UNDERCARRIAGE_Y = 0x00640000;

  // Derived values.

  // Altitude of mid-point of generated landscape.
  const LAND_MID_HEIGHT = TILE_SIZE * 5;

  const LAUNCHPAD_SIZE = TILE_SIZE * 8;
  const LAUNCHPAD_Y = LAUNCHPAD_ALTITUDE - UNDERCARRIAGE_Y;

  // Landscape offset
  const LANDSCAPE_X_WIDTH = TILE_SIZE * (TILES_X - 2);
  const LANDSCAPE_Z_DEPTH = TILE_SIZE * (TILES_Z - 1);
  const LANDSCAPE_X = LANDSCAPE_X_WIDTH / 2;
  const LANDSCAPE_Y = 0;
  const LANDSCAPE_Z = LANDSCAPE_Z_DEPTH + 10 * TILE_SIZE;

  const CAMERA_PLAYER_Z = (TILES_Z - 6) * TILE_SIZE;

  let playerX = 0;
  let playerY = 0;
  let playerZ = 0;

  let cameraX = 0;
  let cameraY = 0;
  let cameraZ = 0;

  let previousTimestamp = -1;

  const placePlayerOnLaunchpad = () => {
    playerX = LAUNCHPAD_SIZE / 2;
    playerY = LAUNCHPAD_Y;
    playerZ = LAUNCHPAD_SIZE / 2;
  };

  const onAnimationFrame = (timestamp) => {
    // Find the canvas and set the width/height to the current screen width/height.
    const canvasEl = document.getElementById("screen");
    const canvasRect = canvasEl.getBoundingClientRect();
    canvasEl.width = canvasRect.width;
    canvasEl.height = canvasRect.height;

    const ctx = canvasEl.getContext("2d");

    // Clear background
    ctx.fillStyle = "rgb(32, 32, 32)";
    ctx.fillRect(0, 0, canvasRect.width, canvasRect.height);

    // Compute scale factor for width and height to fit a mode 13 screen and choose smallest.
    const canvasScale = Math.min(
      canvasRect.width / SCREEN_W,
      canvasRect.height / SCREEN_H,
    );
    ctx.scale(canvasScale, canvasScale);

    // Compute required offset given scale to centre the screen.
    ctx.translate(
      0.5 * (canvasRect.width / canvasScale - SCREEN_W),
      0.5 * (canvasRect.height / canvasScale - SCREEN_H),
    );

    // Clear screen.
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Set clipping region to screen
    ctx.beginPath();
    ctx.rect(0, 0, SCREEN_W, SCREEN_H);
    ctx.clip();

    cameraX = playerX;
    cameraY = Math.min(playerY, 0);
    cameraZ = playerZ + CAMERA_PLAYER_Z;

    drawLandscape(ctx);

    const deltaT =
      previousTimestamp == -1
        ? 0
        : Math.min(timestamp - previousTimestamp, 500);
    playerZ -= 1 * deltaT * 1e-3 * TILE_SIZE;
    playerX += 0.3 * deltaT * 1e-3 * TILE_SIZE;
    playerY =
      getLandscapeAltitude(playerX, playerZ) - UNDERCARRIAGE_Y - 5 * TILE_SIZE;
    previousTimestamp = timestamp;

    // Request callback on next frame.
    // window.requestAnimationFrame(onAnimationFrame);
  };

  const drawTriangle = (ctx, pA, pB, pC, colour) => {
    ctx.beginPath();
    ctx.moveTo(pA[0], pA[1]);
    ctx.lineTo(pB[0], pB[1]);
    ctx.lineTo(pC[0], pC[1]);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = colour;
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.5;
    ctx.fill();
    ctx.stroke();
  };

  const drawQuad = (ctx, pA, pB, pC, pD, colour) => {
    drawTriangle(ctx, pA, pB, pC, colour);
    drawTriangle(ctx, pC, pD, pA, colour);
  };

  const drawLandscape = (ctx) => {
    const rows = [new Array(TILES_X), new Array(TILES_X)];

    const tileOriginX =
      Math.floor(cameraX / TILE_SIZE) * TILE_SIZE - LANDSCAPE_X;
    const tileOriginZ = Math.floor(cameraZ / TILE_SIZE) * TILE_SIZE;
    let previousAltitude = 0;
    for (let rowIdx = 0; rowIdx < TILES_Z; rowIdx++) {
      const z = tileOriginZ - rowIdx * TILE_SIZE;

      // Compute screen-space co-ordinates for a row of tile corners.
      for (let colIdx = 0; colIdx < TILES_X; colIdx++) {
        // Compute camera-space co-ordinate of corner.
        const x = tileOriginX + colIdx * TILE_SIZE;
        const y = getLandscapeAltitude(x, z);
        rows[1][colIdx] = projectVertexOntoScreen(
          x - cameraX,
          y - cameraY + LANDSCAPE_Y,
          z - cameraZ + LANDSCAPE_Z,
        );

        // Skip first row and column when drawing quads
        if (rowIdx == 0 || colIdx == 0) {
          previousAltitude = y;
          continue;
        }

        // Co-ords of quad to draw.
        const pA = rows[0][colIdx - 1],
          pB = rows[0][colIdx];
        const pC = rows[1][colIdx],
          pD = rows[1][colIdx - 1];

        const landscapeTileColour = getLandscapeTileColour(
          previousAltitude,
          y,
          rowIdx,
        );

        drawQuad(ctx, pA, pB, pC, pD, landscapeTileColour);

        previousAltitude = y;
      }

      // Make this row be the preceding row for the next one.
      const tmpRow = rows[0];
      rows[0] = rows[1];
      rows[1] = tmpRow;
    }

    drawObject(
      ctx,
      objectBlueprints.player,
      playerX,
      playerY + LANDSCAPE_Y,
      playerZ + LANDSCAPE_Z,
    );

    drawObject(
      ctx,
      objectBlueprints.smallLeafyTree,
      0,
      LAUNCHPAD_ALTITUDE + LANDSCAPE_Y,
      LANDSCAPE_Z,
    );
  };

  const drawObject = (
    ctx,
    { faces, vertices, flags: { hasShadow, rotates } },
    cx,
    cy,
    cz,
  ) => {
    const transformedVertices = vertices.map(([x, y, z]) => {
      if (x > 0x80000000) {
        x -= 0x100000000;
      }
      if (y > 0x80000000) {
        y -= 0x100000000;
      }
      if (z > 0x80000000) {
        z -= 0x100000000;
      }
      x += cx - cameraX;
      y += cy - cameraY;
      z += cz - cameraZ;
      return projectVertexOntoScreen(x, y, z);
    });

    faces.forEach(([nX, nY, nZ, v1Idx, v2Idx, v3Idx, colour]) => {
      if (nX > 0x80000000) {
        nX -= 0x100000000;
      }
      if (nY > 0x80000000) {
        nY -= 0x100000000;
      }
      if (nZ > 0x80000000) {
        nZ -= 0x100000000;
      }

      if (rotates && (nZ >= 0)) {
        return;
      }

      const p1 = transformedVertices[v1Idx];
      const p2 = transformedVertices[v2Idx];
      const p3 = transformedVertices[v3Idx];

      const brightness = (Math.min(0, -nY) >> 28) + (nX < 0 ? 1 : 0);
      const r = ((colour >> 8) & 0xf) + brightness;
      const g = ((colour >> 4) & 0xf) + brightness;
      const b = (colour & 0xf) + brightness;

      drawTriangle(ctx, p1, p2, p3, `rgb(${r << 4}, ${g << 4}, ${b << 4})`);
    });
  };

  const getLandscapeTileColour = (previousAltitude, altitude, rowIdx) => {
    let r = 0,
      g = 0,
      b = 0;

    // Select base colour of tile.
    if (altitude == LAUNCHPAD_ALTITUDE) {
      r = g = b = 4;
    } else if (altitude == SEA_LEVEL) {
      r = g = 0;
      b = 4;
    } else {
      r = altitude & (1 << 2);
      g = ((altitude & (1 << 3)) >> 1) + 4;
      b = 0;
    }

    // Calculate slope of tile.
    const slope = Math.max(0, previousAltitude - altitude);

    // Modify colour so tiles in the background are darker and tiles sloping towards light are
    // lighter.
    r = Math.min(16, r + rowIdx + (slope >> 22));
    g = Math.min(16, g + rowIdx + (slope >> 22));
    b = Math.min(16, b + rowIdx + (slope >> 22));

    return `rgb(${r << 4}, ${g << 4}, ${b << 4})`;
  };

  /**
   * Emulation of sin table.
   */
  const sin = (a) => (2 ** 31 - 1) * Math.sin(2 * Math.PI * (a / 2 ** 32));

  /**
   * Given an (x, y) location on the landscape in world co-ordinates, return the altitude.
   */
  const getLandscapeAltitude = (x, z) => {
    if (x >= 0 && x < LAUNCHPAD_SIZE && z >= 0 && z < LAUNCHPAD_SIZE) {
      return LAUNCHPAD_ALTITUDE;
    }

    return Math.min(
      SEA_LEVEL,
      LAND_MID_HEIGHT -
        (2 * sin(x - 2 * z) +
          2 * sin(4 * x + 3 * z) +
          2 * sin(3 * z - 5 * x) +
          2 * sin(3 * x + 3 * z) +
          sin(5 * x + 11 * z) +
          sin(10 * x + 7 * z)) /
          256,
    );
  };

  /**
   * Given a camera-space location, return the screen space location as an array of two values.
   */
  const projectVertexOntoScreen = (x, y, z) => {
    return [SCREEN_W * 0.5 + (256 * x) / z, SCREEN_H * 0.25 + (256 * y) / z];
  };

  // Start game.
  placePlayerOnLaunchpad();

  const objectBlueprints = {
    player: {
      flags: {
        rotates: true,
        hasShadow: true,
      },
      vertices: [
        // xObject   yObject     zObject
        [0x01000000, 0x00500000, 0x00800000], // Vertex 0
        [0x01000000, 0x00500000, 0xff800000], // Vertex 1
        [0x00000000, 0x000a0000, 0xfecccccd], // Vertex 2
        [0xff19999a, 0x00500000, 0x00000000], // Vertex 3
        [0x00000000, 0x000a0000, 0x01333333], // Vertex 4
        [0xffe66667, 0xff880000, 0x00000000], // Vertex 5
        [0x00555555, 0x00500000, 0x00400000], // Vertex 6
        [0x00555555, 0x00500000, 0xffc00000], // Vertex 7
        [0xffcccccd, 0x00500000, 0x00000000], // Vertex 8
      ],
      faces: [
        // xNormal   yNormal     zNormal     v1 v2 v3 colour
        [0x457c441a, 0x9e2a1f4c, 0x00000000, 0, 1, 5, 0x080], // 0
        [0x35f5d83b, 0x9bc03ec1, 0xda12d71d, 1, 2, 5, 0x040], // 1
        [0x35f5d83b, 0x9bc03ec1, 0x25ed28e3, 0, 5, 4, 0x040], // 2
        [0xb123d51c, 0xaf3f50ee, 0xd7417278, 2, 3, 5, 0x040], // 3
        [0xb123d51d, 0xaf3f50ee, 0x28be8d88, 3, 4, 5, 0x040], // 4
        [0xf765d8cd, 0x73242236, 0xdf4fd176, 1, 2, 3, 0x088], // 5
        [0xf765d8cd, 0x73242236, 0x20b02e8a, 0, 3, 4, 0x088], // 6
        [0x00000000, 0x78000000, 0x00000000, 0, 1, 3, 0x044], // 7
        [0x00000000, 0x78000000, 0x00000000, 6, 7, 8, 0xc80], // 8
      ],
    },
    smallLeafyTree: {
      flags: {
        rotates: false,
        hasShadow: true,
      },
      vertices: [
        // xObject   yObject     zObject
        [0x00300000, 0xfe800000, 0x00300000], // Vertex 0
        [0xffd9999a, 0x00000000, 0x00000000], // Vertex 1
        [0x00266666, 0x00000000, 0x00000000], // Vertex 2
        [0x00000000, 0xfef33334, 0xff400000], // Vertex 3
        [0x00800000, 0xff400000, 0xff800000], // Vertex 4
        [0xff400000, 0xfecccccd, 0xffd55556], // Vertex 5
        [0xff800000, 0xfea66667, 0x00400000], // Vertex 6
        [0x00800000, 0xfe59999a, 0x002aaaaa], // Vertex 7
        [0x00c00000, 0xfea66667, 0xffc00000], // Vertex 8
        [0xffa00000, 0xfecccccd, 0x00999999], // Vertex 9
        [0x00c00000, 0xff400000, 0x00c00000], // Vertex 10
      ],
      faces: [
        // xNormal   yNormal     zNormal     v1 v2 v3 colour
        [0x14a01873, 0xaf8f9f93, 0x56a0681e, 0, 9, 10, 0x040], // 0
        [0x00000000, 0x00000000, 0x00000000, 0, 1, 2, 0x400], // 1
        [0x499a254e, 0xb123fc2c, 0xcb6d5299, 0, 3, 4, 0x080], // 2
        [0xe4d2eebe, 0x8dc82837, 0xe72fe5e9, 0, 5, 6, 0x080], // 3
        [0xd5710585, 0xb29ef364, 0xaec07eb3, 0, 7, 8, 0x080], // 4
      ],
    },
  };

  // Request callback be called on next frame.
  window.requestAnimationFrame(onAnimationFrame);
})();
