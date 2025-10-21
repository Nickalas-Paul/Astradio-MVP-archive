#!/usr/bin/env node
// Export worker for processing audio export jobs from Redis queue

const { ExportQueue } = require('../lib/queue/export-queue');
const { generateChartHashSync } = require('../lib/hash/chartHash');
const fs = require('fs').promises;
const path = require('path');

class ExportWorker {
  constructor() {
    this.queue = new ExportQueue();
    this.isRunning = false;
    this.pollInterval = 1000; // 1 second
    this.cleanupInterval = 30000; // 30 seconds
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('[EXPORT_WORKER] Starting export worker...');
    this.isRunning = true;

    // Start polling for jobs
    this.pollForJobs();
    
    // Start cleanup timer
    this.startCleanupTimer();

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Poll for jobs from the queue
   */
  async pollForJobs() {
    while (this.isRunning) {
      try {
        const job = await this.queue.dequeue();
        
        if (job) {
          console.log(`[EXPORT_WORKER] Processing job ${job.id}`);
          await this.processJob(job);
        } else {
          // No jobs available, wait before polling again
          await this.sleep(this.pollInterval);
        }
      } catch (error) {
        console.error('[EXPORT_WORKER] Error polling for jobs:', error);
        await this.sleep(this.pollInterval);
      }
    }
  }

  /**
   * Process a single export job
   */
  async processJob(job) {
    try {
      const { data } = job;
      
      // Generate deterministic export based on job data
      const exportResult = await this.generateExport(data);
      
      // Mark job as completed
      await this.queue.complete(job.id, exportResult);
      
      console.log(`[EXPORT_WORKER] Completed job ${job.id}`);
    } catch (error) {
      console.error(`[EXPORT_WORKER] Failed to process job ${job.id}:`, error);
      
      // Mark job as failed (will trigger retry logic)
      await this.queue.fail(job.id, error);
    }
  }

  /**
   * Generate export file (mock implementation)
   */
  async generateExport(data) {
    const { controlSurface, seed, modelVersion = 'v2.8', format = 'mp3' } = data;
    
    // Generate deterministic hash for filename
    const chartHash = generateChartHashSync(controlSurface);
    const exportHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify({ controlSurface, seed, modelVersion, format }))
      .digest('hex')
      .slice(0, 16);

    // Create export directory if it doesn't exist
    const exportDir = path.join(__dirname, '..', 'exports', modelVersion);
    await fs.mkdir(exportDir, { recursive: true });

    // Generate mock audio file (in production, this would be real audio generation)
    const filename = `${exportHash}.${format}`;
    const filepath = path.join(exportDir, filename);
    
    // Create a mock audio file (just a placeholder)
    const mockAudioData = Buffer.from(`Mock audio data for ${exportHash}`, 'utf8');
    await fs.writeFile(filepath, mockAudioData);

    // Generate metadata
    const metadata = {
      id: exportHash,
      filename,
      format,
      size: mockAudioData.length,
      duration: 60.0, // 60 seconds
      modelVersion,
      chartHash,
      seed,
      createdAt: new Date().toISOString(),
      url: `/api/exports/${modelVersion}/${filename}`
    };

    // Save metadata
    const metadataPath = path.join(exportDir, `${exportHash}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`[EXPORT_WORKER] Generated export: ${filename}`);
    
    return {
      success: true,
      export: metadata,
      filepath: filepath
    };
  }

  /**
   * Start cleanup timer for expired jobs
   */
  startCleanupTimer() {
    setInterval(async () => {
      try {
        const cleaned = await this.queue.cleanupExpired();
        if (cleaned > 0) {
          console.log(`[EXPORT_WORKER] Cleaned up ${cleaned} expired jobs`);
        }
      } catch (error) {
        console.error('[EXPORT_WORKER] Cleanup error:', error);
      }
    }, this.cleanupInterval);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[EXPORT_WORKER] Shutting down...');
    this.isRunning = false;
    
    // Wait for current jobs to complete
    await this.sleep(2000);
    
    console.log('[EXPORT_WORKER] Shutdown complete');
    process.exit(0);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start worker if run directly
if (require.main === module) {
  const worker = new ExportWorker();
  worker.start().catch(error => {
    console.error('[EXPORT_WORKER] Failed to start worker:', error);
    process.exit(1);
  });
}

module.exports = { ExportWorker };
