'use client';

import { useEffect, useRef, useState } from 'react';
import { isFeatureEnabled } from '../../config/flags';
import { VizPayload } from '../core/viz/engine';

interface VizCanvasProps {
  payload: VizPayload | null;
  className?: string;
}

function VizCanvas({ payload, className = '' }: VizCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_VIZ_ENGINE')) {
    return (
      <div className={`flex items-center justify-center bg-bgElev rounded-lg ${className}`}>
        <div className="text-center text-subtext">
          <p className="text-sm">Visualization disabled</p>
          <p className="text-xs">Enable with ?viz=1</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!payload) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 400;

    setIsReady(true);

    // Cleanup on unmount
    return () => {
      if (canvas) {
        const cleanupCtx = canvas.getContext('2d');
        if (cleanupCtx) {
          cleanupCtx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };
  }, [payload]);

  useEffect(() => {
    if (!isReady || !payload) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw visualization based on payload
    drawVisualization(ctx, payload, currentTime);

  }, [isReady, payload, currentTime]);

  const drawVisualization = (ctx: CanvasRenderingContext2D, payload: VizPayload, time: number) => {
    const centerX = 200;
    const centerY = 200;
    const radius = 150;

    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

    // Draw background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = payload.theme.palette[0];
    ctx.fill();
    ctx.strokeStyle = payload.theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw wheel overlay highlights
    payload.wheelOverlay.highlight.forEach((planet, index) => {
      const angle = (index * 360 / payload.wheelOverlay.highlight.length) * Math.PI / 180;
      const x = centerX + Math.cos(angle) * (radius - 20);
      const y = centerY + Math.sin(angle) * (radius - 20);
      
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = payload.theme.accent;
      ctx.fill();
    });

    // Draw aspect lines
    payload.wheelOverlay.aspectLines.forEach((aspect, index) => {
      const angle1 = (index * 120) * Math.PI / 180;
      const angle2 = ((index * 120) + 60) * Math.PI / 180;
      
      const x1 = centerX + Math.cos(angle1) * (radius - 40);
      const y1 = centerY + Math.sin(angle1) * (radius - 40);
      const x2 = centerX + Math.cos(angle2) * (radius - 40);
      const y2 = centerY + Math.sin(angle2) * (radius - 40);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = payload.theme.palette[1];
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw time-based animation (respect reduced motion)
    if (!prefersReducedMotion) {
      const progress = time / payload.duration;
      const rotation = progress * 360;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * Math.PI / 180);
      
      // Draw rotating elements
      for (let i = 0; i < 8; i++) {
        const angle = (i * 45) * Math.PI / 180;
        const x = Math.cos(angle) * 100;
        const y = Math.sin(angle) * 100;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = payload.theme.palette[i % payload.theme.palette.length];
        ctx.fill();
      }
      
      ctx.restore();
    } else {
      // Static elements for reduced motion
      for (let i = 0; i < 8; i++) {
        const angle = (i * 45) * Math.PI / 180;
        const x = centerX + Math.cos(angle) * 100;
        const y = centerY + Math.sin(angle) * 100;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = payload.theme.palette[i % payload.theme.palette.length];
        ctx.fill();
      }
    }
  };

  // Mock audio tick subscription (in real implementation, this would connect to audio engine)
  useEffect(() => {
    if (!isReady || !payload) return;

    let interval: NodeJS.Timeout;
    let animationFrame: number | null = null;

    const updateTime = () => {
      setCurrentTime(prev => {
        const next = prev + 0.1;
        return next >= payload.duration ? 0 : next;
      });
    };

    // Start animation loop
    interval = setInterval(updateTime, 100);

    // Handle seek/pause events (mock implementation)
    const handleSeek = (time: number) => {
      setCurrentTime(Math.max(0, Math.min(time, payload.duration)));
    };

    const handlePause = () => {
      if (interval) clearInterval(interval);
    };

    const handleResume = () => {
      interval = setInterval(updateTime, 100);
    };

    // Mock event bus subscription
    const mockBus = {
      on: (event: string, callback: Function) => {
        if (event === 'transport.seek') {
          // Store seek handler for cleanup
          (mockBus as any).seekHandler = callback;
        }
      },
      off: (event: string) => {
        if (event === 'transport.seek') {
          (mockBus as any).seekHandler = null;
        }
      }
    };

    // Subscribe to audio events
    mockBus.on('transport.seek', handleSeek);
    mockBus.on('transport.pause', handlePause);
    mockBus.on('transport.resume', handleResume);

    return () => {
      if (interval) clearInterval(interval);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      mockBus.off('transport.seek');
      mockBus.off('transport.pause');
      mockBus.off('transport.resume');
    };
  }, [isReady, payload]);

  if (!payload) {
    return (
      <div className={`flex items-center justify-center bg-bgElev rounded-lg ${className}`}>
        <div className="text-center text-subtext">
          <p className="text-sm">No visualization data</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ maxWidth: '400px', maxHeight: '400px' }}
      />
      <div className="absolute bottom-2 right-2 text-xs text-subtext bg-bg/80 px-2 py-1 rounded">
        {Math.floor(currentTime)}s / {Math.floor(payload.duration)}s
      </div>
    </div>
  );
}

export default VizCanvas;
