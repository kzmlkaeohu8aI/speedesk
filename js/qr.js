/* test-planner/js/qr.js
 *
 * Minimal, dependency-free QR encoder.
 * Supports byte mode, ECC level M, versions 1–10 (up to ~213 chars).
 * Sufficient for our deep-link URLs (~70-90 chars).
 *
 * Render output: a square <canvas> or SVG-string, sized by the caller.
 *
 * This is intentionally small. For anything beyond ~200 chars, use a
 * full library. We don't need that here.
 */
(function (global) {
  "use strict";

  // ---------- Galois field arithmetic (GF(256), poly 0x11d) ----------
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  // ---------- Reed-Solomon ----------
  function rsGeneratorPoly(deg) {
    let g = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  function rsEncode(data, ecBytes) {
    const gen = rsGeneratorPoly(ecBytes);
    const res = new Array(data.length + ecBytes).fill(0);
    for (let i = 0; i < data.length; i++) res[i] = data[i];
    for (let i = 0; i < data.length; i++) {
      const factor = res[i];
      if (factor === 0) continue;
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], factor);
      }
    }
    return res.slice(data.length);
  }

  // ---------- Version tables (ECC level M only) ----------
  // [version]: { totalCodewords, ecPerBlock, group1Blocks, group1Data, group2Blocks, group2Data }
  // (group2Blocks/group2Data are 0 when unused)
  const VERSIONS_M = {
    1:  { total: 26,  ec: 10, g1b: 1, g1d: 16, g2b: 0, g2d: 0  },
    2:  { total: 44,  ec: 16, g1b: 1, g1d: 28, g2b: 0, g2d: 0  },
    3:  { total: 70,  ec: 26, g1b: 1, g1d: 44, g2b: 0, g2d: 0  },
    4:  { total: 100, ec: 18, g1b: 2, g1d: 32, g2b: 0, g2d: 0  },
    5:  { total: 134, ec: 24, g1b: 2, g1d: 43, g2b: 0, g2d: 0  },
    6:  { total: 172, ec: 16, g1b: 4, g1d: 27, g2b: 0, g2d: 0  },
    7:  { total: 196, ec: 18, g1b: 4, g1d: 31, g2b: 0, g2d: 0  },
    8:  { total: 242, ec: 22, g1b: 2, g1d: 38, g2b: 2, g2d: 39 },
    9:  { total: 292, ec: 22, g1b: 3, g1d: 36, g2b: 2, g2d: 37 },
    10: { total: 346, ec: 26, g1b: 4, g1d: 43, g2b: 1, g2d: 44 },
  };

  function dataCapacityBytes(version) {
    const v = VERSIONS_M[version];
    return v.g1b * v.g1d + v.g2b * v.g2d;
  }

  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      // 4 (mode) + 8/16 (length) bits consumed before data; be conservative: 4 + 16
      const headerBytes = 3; // mode+length fits in ≤ 3 bytes for versions ≤10
      if (dataCapacityBytes(v) >= byteLen + headerBytes) return v;
    }
    throw new Error("QR: text too long for supported versions");
  }

  // ---------- Bit buffer ----------
  function BitBuffer() {
    this.bits = [];
  }
  BitBuffer.prototype.put = function (value, length) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  };
  BitBuffer.prototype.length = function () {
    return this.bits.length;
  };

  // ---------- Data encoding ----------
  function encodeBytes(text) {
    const utf8 = new TextEncoder().encode(text);
    const byteLen = utf8.length;

    const version = pickVersion(byteLen);
    const dataCap = dataCapacityBytes(version);

    const bb = new BitBuffer();
    bb.put(4, 4); // byte mode
    const lenBits = version <= 9 ? 8 : 16;
    bb.put(byteLen, lenBits);
    for (const b of utf8) bb.put(b, 8);

    // Terminator
    const capBits = dataCap * 8;
    const remaining = capBits - bb.length();
    const term = Math.min(4, remaining);
    bb.put(0, term);

    // Pad to byte boundary
    while (bb.length() % 8 !== 0) bb.put(0, 1);

    // Pad bytes 0xEC 0x11 alternating
    let pad = 0xec;
    while (bb.length() < capBits) {
      bb.put(pad, 8);
      pad = pad === 0xec ? 0x11 : 0xec;
    }

    // Build data codewords per block
    const dataBytes = [];
    for (let i = 0; i < bb.length(); i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bb.bits[i + j];
      dataBytes.push(b);
    }

    // Split into blocks
    const spec = VERSIONS_M[version];
    const blocks = [];
    let offset = 0;
    for (let i = 0; i < spec.g1b; i++) {
      blocks.push(dataBytes.slice(offset, offset + spec.g1d));
      offset += spec.g1d;
    }
    for (let i = 0; i < spec.g2b; i++) {
      blocks.push(dataBytes.slice(offset, offset + spec.g2d));
      offset += spec.g2d;
    }

    // EC per block
    const ecBlocks = blocks.map((blk) => rsEncode(blk, spec.ec));

    // Interleave data
    const maxDataLen = Math.max(...blocks.map((b) => b.length));
    const interleaved = [];
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of blocks) {
        if (i < blk.length) interleaved.push(blk[i]);
      }
    }
    // Interleave EC
    for (let i = 0; i < spec.ec; i++) {
      for (const blk of ecBlocks) {
        if (i < blk.length) interleaved.push(blk[i]);
      }
    }

    return { version, codewords: interleaved };
  }

  // ---------- Matrix construction ----------
  function buildMatrix(version, codewords) {
    const size = 17 + version * 4;
    const m = [];
    for (let i = 0; i < size; i++) m.push(new Array(size).fill(null));
    const reserved = [];
    for (let i = 0; i < size; i++) reserved.push(new Array(size).fill(false));

    function setFn(r, c, v) {
      m[r][c] = v;
      reserved[r][c] = true;
    }

    // Finder patterns
    function placeFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r, cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const inRing =
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          setFn(rr, cc, inRing ? 1 : 0);
        }
      }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!reserved[6][i]) setFn(6, i, i % 2 === 0 ? 1 : 0);
      if (!reserved[i][6]) setFn(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // Alignment patterns (version ≥ 2)
    const alignPositions = ALIGN_POS[version] || [];
    for (const r of alignPositions) {
      for (const c of alignPositions) {
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isRing =
              Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setFn(r + dr, c + dc, isRing ? 1 : 0);
          }
        }
      }
    }

    // Reserve format areas
    for (let i = 0; i < 9; i++) {
      if (!reserved[8][i]) reserved[8][i] = true;
      if (!reserved[i][8]) reserved[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
      if (!reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
    }
    // Dark module
    setFn(size - 8, 8, 1);

    // Reserve version info areas (version ≥ 7)
    if (version >= 7) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          reserved[i][size - 11 + j] = true;
          reserved[size - 11 + j][i] = true;
        }
      }
    }

    // Place data bits in zigzag
    let bitIdx = 0;
    const bits = [];
    for (const cw of codewords) {
      for (let b = 7; b >= 0; b--) bits.push((cw >>> b) & 1);
    }
    // Remainder bits (versions 2-6 need 7 extra; 7-13 need 0; etc. — for level M only:
    // v1: 0, v2-6: 7, v7-13: 0, v14-20: 3, v21-27: 4, v28-34: 3, v35-40: 0.
    // We only support up to v10, so add 7 remainder bits for v2..v6, 0 for v7..v10.
    let remainder = 0;
    if (version >= 2 && version <= 6) remainder = 7;
    else if (version >= 7 && version <= 13) remainder = 0;
    for (let i = 0; i < remainder; i++) bits.push(0);

    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;
      const rows = upward
        ? Array.from({ length: size }, (_, i) => size - 1 - i)
        : Array.from({ length: size }, (_, i) => i);
      for (const row of rows) {
        for (let c = 0; c < 2; c++) {
          const cc = col - c;
          if (reserved[row][cc]) continue;
          const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
          m[row][cc] = bit;
        }
      }
      upward = !upward;
    }

    // Format info (level M = 00)
    applyFormat(m, size, 0 /*M*/, 0 /*mask 0*/);

    // Apply mask 0 (pattern 101010…) to all non-reserved modules
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && (r + c) % 2 === 0) {
          m[r][c] ^= 1;
        }
      }
    }
    // Re-apply format bits (they're in reserved zones so mask doesn't touch them,
    // but be safe)
    applyFormat(m, size, 0, 0);

    return m;
  }

  const ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
  };

  function applyFormat(m, size, ecLevel, mask) {
    // Format info bits: [EC (2) | mask (3)] then BCH(15,5) + XOR with 0x5412
    const dataBits = ((ecLevel & 3) << 3) | (mask & 7);
    let rem = dataBits;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const format = (((dataBits << 10) | rem) ^ 0x5412) & 0x7fff;

    // Place around top-left finder
    for (let i = 0; i < 15; i++) {
      const bit = (format >>> i) & 1;
      // Left column
      if (i < 6) m[i][8] = bit;
      else if (i < 8) m[i + 1][8] = bit;
      else m[size - 15 + i][8] = bit;
    }
    for (let i = 0; i < 15; i++) {
      const bit = (format >>> i) & 1;
      // Top row
      if (i < 8) m[8][size - i - 1] = bit;
      else if (i < 9) m[8][15 - i - 1 + 1] = bit;
      else m[8][15 - i - 1] = bit;
    }
    m[size - 8][8] = 1; // dark module
  }

  // ---------- Public API ----------
  function generateMatrix(text) {
    const { version, codewords } = encodeBytes(text);
    return buildMatrix(version, codewords);
  }

  /**
   * Render a QR code as a canvas.
   * @param {string} text
   * @param {HTMLCanvasElement} canvas
   * @param {Object} opts { size: px, margin: modules }
   */
  function renderToCanvas(text, canvas, opts) {
    const size = (opts && opts.size) || 180;
    const margin = (opts && opts.margin != null) ? opts.margin : 2;

    const m = generateMatrix(text);
    const modules = m.length;
    const total = modules + margin * 2;
    const scale = Math.floor(size / total);

    canvas.width = total * scale;
    canvas.height = total * scale;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111111";
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (m[r][c] === 1) {
          ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
      }
    }
  }

  global.TP = global.TP || {};
  global.TP.qr = {
    generateMatrix,
    renderToCanvas,
  };
})(window);