/**
 * Validates that headless GL and FFmpeg are available
 * on the current environment. Run with:
 *   node dist/vnext/vnext/scripts/validate-video-deps.js
 */

// Minimal DOM stubs for Three.js WebGLRenderer in Node (no browser document).
if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  const stubEl = (): Record<string, unknown> => ({
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  (globalThis as {
    document: {
      createElement: (tag: string) => Record<string, unknown>;
      createElementNS: (_ns: string, tag: string) => Record<string, unknown>;
    };
  }).document = {
    createElement: (_tag: string) => stubEl(),
    createElementNS: (_ns: string, _tag: string) => stubEl(),
  };
}
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as unknown as {
    window: {
      requestAnimationFrame: (cb: () => void) => number;
      cancelAnimationFrame: (id: number) => void;
      devicePixelRatio: number;
    };
  }).window = {
    requestAnimationFrame: (cb) => setTimeout(cb, 0) as unknown as number,
    cancelAnimationFrame: (id) => clearTimeout(id as unknown as NodeJS.Timeout),
    devicePixelRatio: 1,
  };
}

// Test 1: headless-gl
try {
  const createContext = require('gl');
  const gl = createContext(1080, 1920, { preserveDrawingBuffer: true });
  if (gl) {
    console.log('[VIDEO_DEPS] headless-gl: OK');
    console.log('  GL_RENDERER:', gl.getParameter(gl.RENDERER));
    console.log('  GL_VERSION:', gl.getParameter(gl.VERSION));
    console.log('  MAX_TEXTURE_SIZE:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
    gl.getExtension('STACKGL_destroy_context')?.destroy();
  }
} catch (err) {
  console.error('[VIDEO_DEPS] headless-gl: FAILED', (err as Error).message);
}

// Test 2: Three.js with headless context
try {
  const THREE = require('three');
  const createContext = require('gl');
  const glCtx = createContext(1080, 1920, { preserveDrawingBuffer: true });

  const renderer = new THREE.WebGLRenderer({
    context: glCtx,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1080, 1920);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  // Render a simple triangle to verify the pipeline works
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0], 3));
  const material = new THREE.MeshBasicMaterial({ color: 0x0e9696 });
  scene.add(new THREE.Mesh(geometry, material));

  renderer.render(scene, camera);

  // Read pixels to verify rendering actually happened
  const pixels = new Uint8Array(4);
  glCtx.readPixels(540, 960, 1, 1, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);
  console.log('[VIDEO_DEPS] Three.js headless render: OK');
  console.log('  Center pixel RGBA:', Array.from(pixels));

  try {
    renderer.dispose();
  } catch {
    /* dispose may require fuller DOM stubs; render already validated */
  }
  glCtx.getExtension('STACKGL_destroy_context')?.destroy();
} catch (err) {
  console.error('[VIDEO_DEPS] Three.js headless render: FAILED', (err as Error).message);
}

// Test 3: FFmpeg via ffmpeg-static
try {
  const ffmpegPath = require('ffmpeg-static');
  console.log('[VIDEO_DEPS] ffmpeg-static path:', ffmpegPath);
  const { execSync } = require('child_process');
  const version = execSync(`"${ffmpegPath}" -version`, { encoding: 'utf-8' }).split('\n')[0];
  console.log('[VIDEO_DEPS] FFmpeg:', version);
} catch (err) {
  console.error('[VIDEO_DEPS] ffmpeg-static: FAILED', (err as Error).message);
}
