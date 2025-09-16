// render-client.ts - Client for /api/render endpoint

import { ChartContext, Vector6, Composition } from './contracts';

export class RenderClient {
  async render(composition: Composition, chart: ChartContext, vector: Vector6, bpm: number): Promise<string> {
    try {
      const payload = {
        chartContext: {
          planets: chart.planets,
          houses: chart.houses,
          aspects: chart.aspects || [],
          moonPhase: chart.moonPhase || 0,
          dominantElements: chart.dominantElements || { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
          clusters: chart.clusters || null
        },
        mode: 'house-order',
        vector: vector,
        format: 'wav',
        duration: 60,
        bpm: bpm
      };

      console.log('[RenderClient] Rendering audio with payload:', payload);

      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server render failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.url) {
        throw new Error('Server returned no audio URL');
      }

      console.log('[RenderClient] Audio rendered successfully:', result.url);
      return result.url;

    } catch (error) {
      console.error('[RenderClient] Render failed:', error.message);
      throw new Error(`Audio render failed: ${error.message}`);
    }
  }
}
