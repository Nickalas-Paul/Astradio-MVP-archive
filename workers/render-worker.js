const redis = require('../lib/redis');
const { getRow, update } = require('../lib/database');
const { uploadTrackAudio, uploadTrackPreview, uploadOGImage } = require('../lib/storage');
const { generateChartHash } = require('../lib/storage');
const { generateTrack, generateComparisonTrack } = require('../engine/adapter');

class RenderWorker {
  constructor() {
    this.isRunning = false;
    this.redisClient = null;
  }

  async start() {
    try {
      console.log('Starting render worker...');
      this.redisClient = await redis.getClient();
      this.isRunning = true;
      
      while (this.isRunning) {
        await this.processNextJob();
      }
    } catch (error) {
      console.error('Render worker error:', error);
      this.stop();
    }
  }

  async processNextJob() {
    try {
      // Wait for a job from the queue
      const result = await this.redisClient.brPop('render_queue', 5);
      
      if (!result) {
        return; // No job available
      }

      const jobData = JSON.parse(result[1]);
      console.log('Processing render job:', jobData);

      // Update track status to processing
      await update(
        'UPDATE tracks SET updated_at = now() WHERE id = $1',
        [jobData.trackId]
      );

      try {
        if (jobData.comparisonId) {
          await this.processComparisonJob(jobData);
        } else {
          await this.processTrackJob(jobData);
        }
      } catch (error) {
        console.error('Job processing error:', error);
        // Update track status to failed
        await update(
          'UPDATE tracks SET updated_at = now() WHERE id = $1',
          [jobData.trackId]
        );
      }
    } catch (error) {
      console.error('Process job error:', error);
    }
  }

  async processTrackJob(jobData) {
    const { trackId, chartData, mode, genre, source, duration_sec } = jobData;

    console.log(`Rendering track ${trackId}: ${mode} ${genre} ${source}`);

    // Generate track using the engine adapter
    const { timeline, audioBuffer, previewBuffer, ogPng } = await generateTrack(chartData, {
      mode,
      genre,
      durationSec: duration_sec
    });

    // Upload files to S3
    const waveformUrl = await uploadTrackAudio(trackId, audioBuffer, 'mp3');
    const previewUrl = await uploadTrackPreview(trackId, previewBuffer);
    const ogImageUrl = await uploadOGImage(trackId, ogPng);

    // Update track with URLs and timeline
    await update(
      `UPDATE tracks 
       SET waveform_url = $1, preview_url = $2, og_image_url = $3, 
           timeline_json = $4, key_signature = $5, bpm = $6, updated_at = now()
       WHERE id = $7`,
      [waveformUrl, previewUrl, ogImageUrl, JSON.stringify(timeline), 'C', 120, trackId]
    );

    console.log(`Track ${trackId} rendered successfully`);
  }

  async processComparisonJob(jobData) {
    const { comparisonId, requesterId, targetId, requesterChartData, targetChartData, mode, genre } = jobData;

    console.log(`Rendering comparison ${comparisonId}: ${mode} ${genre}`);

    // Generate comparison track using the engine adapter
    const { timeline, audioBuffer, previewBuffer, ogPng } = await generateComparisonTrack(
      requesterChartData, 
      targetChartData, 
      { mode, genre, durationSec: 60 }
    );

    // Create track for the comparison result
    const comparisonTrack = await update(
      `INSERT INTO tracks (owner_id, mode, genre, source, chart_hash, duration_sec, timeline_json, waveform_url, preview_url, og_image_url, key_signature, bpm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        requesterId,
        mode,
        genre,
        'overlay',
        generateChartHash({ requester: requesterChartData, target: targetChartData }),
        60,
        JSON.stringify(timeline),
        await uploadTrackAudio(comparisonId, audioBuffer, 'mp3'),
        await uploadTrackPreview(comparisonId, previewBuffer),
        await uploadOGImage(comparisonId, ogPng),
        'C',
        120
      ]
    );

    // Update comparison with result track
    await update(
      'UPDATE comparisons SET result_track_id = $1 WHERE id = $2',
      [comparisonTrack.id, comparisonId]
    );

    console.log(`Comparison ${comparisonId} rendered successfully`);
  }



  stop() {
    console.log('Stopping render worker...');
    this.isRunning = false;
    if (this.redisClient) {
      this.redisClient.quit();
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new RenderWorker();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    worker.stop();
    process.exit(0);
  });

  worker.start().catch(error => {
    console.error('Worker failed to start:', error);
    process.exit(1);
  });
}

module.exports = RenderWorker;
