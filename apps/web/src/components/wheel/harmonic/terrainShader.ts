export const terrainVertexShader = /* glsl */ `
  #define MAX_SOURCES 10

  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uBpm;
  uniform float uHighlightIdx;
  uniform int uPlanetCount;
  uniform vec2 uPositions[MAX_SOURCES];
  uniform float uFrequencies[MAX_SOURCES];
  uniform float uAmplitudes[MAX_SOURCES];
  uniform float uGlobalDamping;
  uniform float uDisplacementScale;

  varying float vDisplacement;
  varying float vRadius;
  varying vec2 vLocalPos;

  void main() {
    vec2 point = position.xy;
    float radius = length(point);
    // Soft circular disk: plane is 10×10 (half ≈ 5); fade from 4.9 → 4.2
    float mask = smoothstep(4.9, 4.2, radius);
    float displacement = 0.0;
    float rhythmicSpeed = mix(0.55, 1.35, clamp((uBpm - 60.0) / 80.0, 0.0, 1.0));

    for (int i = 0; i < MAX_SOURCES; i++) {
      if (i >= uPlanetCount) break;
      float distanceToSource = distance(point, uPositions[i]);
      float isolation = 1.0;
      if (uHighlightIdx >= 0.0) {
        isolation = abs(float(i) - uHighlightIdx) < 0.5 ? 2.2 : 0.05;
      }
      float wave = sin(
        uFrequencies[i] * distanceToSource
        - uTime * rhythmicSpeed * (1.15 + uFrequencies[i] * 0.04)
      );
      displacement += (
        uAmplitudes[i]
        * isolation
        * wave
        * exp(-uGlobalDamping * distanceToSource)
      );
    }

    float audioScale = mix(0.55, 1.25, clamp(uAudioLevel, 0.0, 1.0));
    displacement *= mask * uDisplacementScale * audioScale;

    vec3 displaced = position;
    displaced.z += displacement;
    vDisplacement = displacement;
    vRadius = radius;
    vLocalPos = point;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

export const terrainFragmentShader = /* glsl */ `
  #define MAX_SOURCES 10

  uniform float uWarmth;
  uniform vec3 uColLow;
  uniform vec3 uColMid;
  uniform vec3 uColHigh;
  uniform vec3 uColPeak;
  uniform int uPlanetCount;
  uniform vec2 uPositions[MAX_SOURCES];
  uniform vec3 uPlanetColors[MAX_SOURCES];
  uniform float uColorInfluence;

  varying float vDisplacement;
  varying float vRadius;
  varying vec2 vLocalPos;

  void main() {
    float edge = smoothstep(4.9, 4.5, vRadius);
    if (edge <= 0.001) discard;

    float amplitude = clamp(abs(vDisplacement) * 2.2, 0.0, 1.0);
    vec3 mid = mix(uColMid, uColHigh, uWarmth * 0.12);

    vec3 color = mix(uColLow, mid, smoothstep(0.0, 0.35, amplitude));
    color = mix(color, uColHigh, smoothstep(0.28, 0.62, amplitude));
    color = mix(color, uColPeak, smoothstep(0.52, 1.0, amplitude));

    for (int i = 0; i < MAX_SOURCES; i++) {
      if (i >= uPlanetCount) break;
      float dist = distance(vLocalPos, uPositions[i]);
      float influence = smoothstep(1.0, 0.0, dist) * uColorInfluence;
      color = mix(color, uPlanetColors[i] * 0.7, influence);
    }

    float glow = 0.38 + amplitude * 0.14;
    gl_FragColor = vec4(color * glow, edge * 0.92);
  }
`;

/** Fixed terrain ramp — peaks cap at muted amber, never white-gold. */
export const TERRAIN_COLOR_RAMP = {
  low: '#0e0520',
  mid: '#2a1540',
  high: '#4a2814',
  peak: '#a06a18',
} as const;
