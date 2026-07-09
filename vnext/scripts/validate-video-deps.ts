/**
 * Validates that headless GL and FFmpeg are available
 * on the current environment. Run with:
 *   node dist/vnext/vnext/scripts/validate-video-deps.js
 */

// Test 1: headless-gl
let glContext: any = null;
try {
  const createContext = require('gl');
  glContext = createContext(1080, 1920, { preserveDrawingBuffer: true });
  if (glContext) {
    console.log('[VIDEO_DEPS] headless-gl: OK');
    console.log('  GL_RENDERER:', glContext.getParameter(glContext.RENDERER));
    console.log('  GL_VERSION:', glContext.getParameter(glContext.VERSION));
    console.log('  MAX_TEXTURE_SIZE:', glContext.getParameter(glContext.MAX_TEXTURE_SIZE));
  }
} catch (err) {
  console.error('[VIDEO_DEPS] headless-gl: FAILED', (err as Error).message);
}

// Test 2: Three.js with headless context (no DOM polyfills)
try {
  const THREE = require('three');

  // Create renderer using the already-created gl context directly
  // Do NOT use document/window polyfills
  const renderer = new THREE.WebGLRenderer({
    context: glContext,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1080, 1920);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0], 3)
  );
  const material = new THREE.MeshBasicMaterial({ color: 0x0e9696 });
  scene.add(new THREE.Mesh(geometry, material));

  renderer.render(scene, camera);

  const pixels = new Uint8Array(4);
  glContext.readPixels(540, 960, 1, 1, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);
  console.log('[VIDEO_DEPS] Three.js headless render: OK');
  console.log('  Center pixel RGBA:', Array.from(pixels));

  try {
    renderer.dispose();
  } catch {}
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
