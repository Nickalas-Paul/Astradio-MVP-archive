// Redis-backed export queue with visibility timeouts and retry logic

const redis = require('./redis');
const crypto = require('crypto');

class ExportQueue {
  constructor() {
    this.queueName = 'export_queue';
    this.processingName = 'export_processing';
    this.failedName = 'export_failed';
    this.visibilityTimeout = 30000; // 30 seconds
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Add export job to queue
   */
  async enqueue(jobData) {
    const jobId = this.generateJobId();
    const job = {
      id: jobId,
      data: jobData,
      status: 'queued',
      createdAt: new Date().toISOString(),
      retries: 0,
      priority: jobData.priority || 0
    };

    try {
      const client = await redis.getClient();
      
      // Add to main queue with priority score
      await client.zAdd(this.queueName, {
        score: job.priority,
        value: JSON.stringify(job)
      });

      // Store job details separately for status tracking
      await client.hSet(`job:${jobId}`, {
        status: 'queued',
        data: JSON.stringify(jobData),
        createdAt: job.createdAt,
        retries: '0'
      });

      console.log(`[QUEUE] Enqueued job ${jobId} with priority ${job.priority}`);
      return jobId;
    } catch (error) {
      console.error('[QUEUE] Failed to enqueue job:', error);
      throw error;
    }
  }

  /**
   * Get next job from queue with visibility timeout
   */
  async dequeue() {
    try {
      const client = await redis.getClient();
      
      // Get job with highest priority (lowest score)
      const result = await client.zPopMin(this.queueName);
      
      if (!result || result.length === 0) {
        return null;
      }

      const job = JSON.parse(result[0].value);
      const now = Date.now();
      
      // Move to processing queue with visibility timeout
      await client.zAdd(this.processingName, {
        score: now + this.visibilityTimeout,
        value: JSON.stringify(job)
      });

      // Update job status
      await client.hSet(`job:${job.id}`, {
        status: 'processing',
        startedAt: new Date().toISOString()
      });

      console.log(`[QUEUE] Dequeued job ${job.id}, visibility timeout: ${this.visibilityTimeout}ms`);
      return job;
    } catch (error) {
      console.error('[QUEUE] Failed to dequeue job:', error);
      throw error;
    }
  }

  /**
   * Mark job as completed
   */
  async complete(jobId, result) {
    try {
      const client = await redis.getClient();
      
      // Remove from processing queue
      await client.zRem(this.processingName, `*${jobId}*`);
      
      // Update job status
      await client.hSet(`job:${jobId}`, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: JSON.stringify(result)
      });

      // Set expiration for completed job (24 hours)
      await client.expire(`job:${jobId}`, 86400);

      console.log(`[QUEUE] Completed job ${jobId}`);
    } catch (error) {
      console.error('[QUEUE] Failed to complete job:', error);
      throw error;
    }
  }

  /**
   * Mark job as failed and handle retry logic
   */
  async fail(jobId, error) {
    try {
      const client = await redis.getClient();
      
      // Get current job details
      const jobDetails = await client.hGetAll(`job:${jobId}`);
      const retries = parseInt(jobDetails.retries || '0');
      
      if (retries < this.maxRetries) {
        // Retry job
        const job = JSON.parse(jobDetails.data);
        job.retries = retries + 1;
        
        // Add back to queue with exponential backoff
        const delay = this.retryDelay * Math.pow(2, retries);
        const retryTime = Date.now() + delay;
        
        await client.zAdd(this.queueName, {
          score: retryTime,
          value: JSON.stringify(job)
        });

        // Update job status
        await client.hSet(`job:${jobId}`, {
          status: 'retrying',
          retries: (retries + 1).toString(),
          lastError: error.message,
          retryAt: new Date(retryTime).toISOString()
        });

        console.log(`[QUEUE] Job ${jobId} failed, retrying in ${delay}ms (attempt ${retries + 1}/${this.maxRetries})`);
      } else {
        // Max retries exceeded, move to failed queue
        await client.lPush(this.failedName, JSON.stringify({
          id: jobId,
          data: jobDetails.data,
          error: error.message,
          failedAt: new Date().toISOString(),
          retries
        }));

        // Update job status
        await client.hSet(`job:${jobId}`, {
          status: 'failed',
          failedAt: new Date().toISOString(),
          finalError: error.message
        });

        console.log(`[QUEUE] Job ${jobId} failed permanently after ${retries} retries`);
      }

      // Remove from processing queue
      await client.zRem(this.processingName, `*${jobId}*`);
    } catch (err) {
      console.error('[QUEUE] Failed to handle job failure:', err);
      throw err;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    try {
      const client = await redis.getClient();
      const jobDetails = await client.hGetAll(`job:${jobId}`);
      
      if (!jobDetails || Object.keys(jobDetails).length === 0) {
        return null;
      }

      return {
        id: jobId,
        status: jobDetails.status,
        data: jobDetails.data ? JSON.parse(jobDetails.data) : null,
        createdAt: jobDetails.createdAt,
        startedAt: jobDetails.startedAt,
        completedAt: jobDetails.completedAt,
        failedAt: jobDetails.failedAt,
        retries: parseInt(jobDetails.retries || '0'),
        result: jobDetails.result ? JSON.parse(jobDetails.result) : null,
        error: jobDetails.lastError || jobDetails.finalError
      };
    } catch (error) {
      console.error('[QUEUE] Failed to get job status:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    try {
      const client = await redis.getClient();
      
      const [queued, processing, failed] = await Promise.all([
        client.zCard(this.queueName),
        client.zCard(this.processingName),
        client.lLen(this.failedName)
      ]);

      return {
        queued,
        processing,
        failed,
        total: queued + processing + failed
      };
    } catch (error) {
      console.error('[QUEUE] Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Clean up expired processing jobs (visibility timeout exceeded)
   */
  async cleanupExpired() {
    try {
      const client = await redis.getClient();
      const now = Date.now();
      
      // Get expired jobs from processing queue
      const expired = await client.zRangeByScore(this.processingName, 0, now);
      
      for (const jobStr of expired) {
        const job = JSON.parse(jobStr);
        console.log(`[QUEUE] Cleaning up expired job ${job.id}`);
        
        // Move back to main queue for retry
        await client.zAdd(this.queueName, {
          score: job.priority,
          value: jobStr
        });
        
        // Remove from processing queue
        await client.zRem(this.processingName, jobStr);
      }

      return expired.length;
    } catch (error) {
      console.error('[QUEUE] Failed to cleanup expired jobs:', error);
      throw error;
    }
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

module.exports = { ExportQueue };
