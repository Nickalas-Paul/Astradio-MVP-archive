// Prometheus metrics collection for observability

class PrometheusMetrics {
  constructor() {
    this.metrics = new Map();
    this.initializeMetrics();
  }

  /**
   * Initialize default metrics
   */
  initializeMetrics() {
    // HTTP request metrics
    this.metrics.set('http_requests_total', {
      type: 'counter',
      help: 'Total number of HTTP requests',
      labels: ['method', 'route', 'status_code']
    });

    this.metrics.set('http_request_duration_seconds', {
      type: 'histogram',
      help: 'HTTP request duration in seconds',
      labels: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    // Composition metrics
    this.metrics.set('compositions_total', {
      type: 'counter',
      help: 'Total number of compositions generated',
      labels: ['model_version', 'status']
    });

    this.metrics.set('composition_duration_seconds', {
      type: 'histogram',
      help: 'Composition generation duration in seconds',
      labels: ['model_version'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    // Queue metrics
    this.metrics.set('queue_jobs_total', {
      type: 'counter',
      help: 'Total number of queue jobs',
      labels: ['queue', 'status']
    });

    this.metrics.set('queue_size', {
      type: 'gauge',
      help: 'Current queue size',
      labels: ['queue']
    });

    // System metrics
    this.metrics.set('memory_usage_bytes', {
      type: 'gauge',
      help: 'Memory usage in bytes',
      labels: ['type']
    });

    this.metrics.set('active_connections', {
      type: 'gauge',
      help: 'Number of active connections',
      labels: ['type']
    });

    // Initialize counters and gauges
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  /**
   * Increment a counter
   */
  incrementCounter(name, labels = {}, value = 1) {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name, labels = {}, value) {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Observe a histogram value
   */
  observeHistogram(name, labels = {}, value) {
    const key = this.getMetricKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  }

  /**
   * Get metric key for storage
   */
  getMetricKey(name, labels) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * Format metrics for Prometheus
   */
  formatMetrics() {
    const lines = [];
    
    // Add help and type lines
    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      lines.push('');
    }

    // Add counter values
    for (const [key, value] of this.counters) {
      lines.push(`${key} ${value}`);
    }

    // Add gauge values
    for (const [key, value] of this.gauges) {
      lines.push(`${key} ${value}`);
    }

    // Add histogram values
    for (const [key, values] of this.histograms) {
      const sorted = values.sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      
      // Add count and sum
      lines.push(`${key}_count ${count}`);
      lines.push(`${key}_sum ${sum}`);
      
      // Add bucket values
      const metric = this.metrics.get(key.split('{')[0]);
      if (metric && metric.buckets) {
        for (const bucket of metric.buckets) {
          const bucketCount = sorted.filter(v => v <= bucket).length;
          lines.push(`${key}_bucket{le="${bucket}"} ${bucketCount}`);
        }
        lines.push(`${key}_bucket{le="+Inf"} ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    const usage = process.memoryUsage();
    
    this.setGauge('memory_usage_bytes', { type: 'heap_used' }, usage.heapUsed);
    this.setGauge('memory_usage_bytes', { type: 'heap_total' }, usage.heapTotal);
    this.setGauge('memory_usage_bytes', { type: 'external' }, usage.external);
    this.setGauge('memory_usage_bytes', { type: 'rss' }, usage.rss);
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method, route, statusCode, duration) {
    this.incrementCounter('http_requests_total', {
      method: method.toUpperCase(),
      route,
      status_code: statusCode.toString()
    });

    this.observeHistogram('http_request_duration_seconds', {
      method: method.toUpperCase(),
      route
    }, duration / 1000);
  }

  /**
   * Record composition
   */
  recordComposition(modelVersion, status, duration) {
    this.incrementCounter('compositions_total', {
      model_version: modelVersion,
      status
    });

    this.observeHistogram('composition_duration_seconds', {
      model_version: modelVersion
    }, duration / 1000);
  }

  /**
   * Record queue job
   */
  recordQueueJob(queue, status) {
    this.incrementCounter('queue_jobs_total', {
      queue,
      status
    });
  }

  /**
   * Update queue size
   */
  updateQueueSize(queue, size) {
    this.setGauge('queue_size', { queue }, size);
  }
}

// Global metrics instance
const metrics = new PrometheusMetrics();

// Update system metrics every 30 seconds
setInterval(() => {
  metrics.updateSystemMetrics();
}, 30000);

module.exports = { PrometheusMetrics, metrics };
