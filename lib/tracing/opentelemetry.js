// OpenTelemetry tracing for request flow observability

class OpenTelemetryTracer {
  constructor() {
    this.spans = new Map();
    this.traces = new Map();
    this.traceId = 0;
    this.spanId = 0;
  }

  /**
   * Start a new trace
   */
  startTrace(name, attributes = {}) {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const trace = {
      traceId,
      spanId,
      name,
      startTime: Date.now(),
      attributes,
      spans: new Map()
    };

    this.traces.set(traceId, trace);
    return this.startSpan(traceId, spanId, name, attributes);
  }

  /**
   * Start a new span
   */
  startSpan(traceId, parentSpanId, name, attributes = {}) {
    const spanId = this.generateSpanId();
    
    const span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      attributes,
      events: [],
      status: 'UNSET'
    };

    const spanKey = `${traceId}:${spanId}`;
    this.spans.set(spanKey, span);

    // Add to trace
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.set(spanId, span);
    }

    return {
      traceId,
      spanId,
      setAttribute: (key, value) => this.setSpanAttribute(spanKey, key, value),
      addEvent: (name, attributes) => this.addSpanEvent(spanKey, name, attributes),
      setStatus: (status, message) => this.setSpanStatus(spanKey, status, message),
      end: () => this.endSpan(spanKey)
    };
  }

  /**
   * Set span attribute
   */
  setSpanAttribute(spanKey, key, value) {
    const span = this.spans.get(spanKey);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /**
   * Add span event
   */
  addSpanEvent(spanKey, name, attributes = {}) {
    const span = this.spans.get(spanKey);
    if (span) {
      span.events.push({
        name,
        attributes,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Set span status
   */
  setSpanStatus(spanKey, status, message = '') {
    const span = this.spans.get(spanKey);
    if (span) {
      span.status = status;
      span.statusMessage = message;
    }
  }

  /**
   * End span
   */
  endSpan(spanKey) {
    const span = this.spans.get(spanKey);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId) {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces() {
    return Array.from(this.traces.values());
  }

  /**
   * Format trace for logging
   */
  formatTrace(traceId) {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    const spans = Array.from(trace.spans.values());
    const rootSpan = spans.find(s => !s.parentSpanId);
    
    return {
      traceId: trace.traceId,
      name: trace.name,
      startTime: trace.startTime,
      duration: rootSpan ? rootSpan.duration : 0,
      status: rootSpan ? rootSpan.status : 'UNSET',
      spans: spans.map(span => ({
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        startTime: span.startTime,
        duration: span.duration,
        status: span.status,
        attributes: span.attributes,
        events: span.events
      }))
    };
  }

  /**
   * Generate trace ID
   */
  generateTraceId() {
    return `trace_${++this.traceId}_${Date.now()}`;
  }

  /**
   * Generate span ID
   */
  generateSpanId() {
    return `span_${++this.spanId}_${Date.now()}`;
  }

  /**
   * Create middleware for Express
   */
  createMiddleware() {
    return (req, res, next) => {
      const trace = this.startTrace(`${req.method} ${req.path}`, {
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.get('User-Agent'),
        'http.request_id': req.get('X-Request-ID') || this.generateTraceId()
      });

      req.trace = trace;
      req.span = trace;

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = function(...args) {
        trace.setAttribute('http.status_code', res.statusCode);
        trace.setStatus(res.statusCode >= 400 ? 'ERROR' : 'OK');
        trace.end();
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Create span for Swiss Ephemeris operations
   */
  createEphemerisSpan(traceId, parentSpanId, operation, attributes = {}) {
    return this.startSpan(traceId, parentSpanId, `ephemeris.${operation}`, {
      'ephemeris.operation': operation,
      ...attributes
    });
  }

  /**
   * Create span for ML model operations
   */
  createModelSpan(traceId, parentSpanId, modelVersion, operation, attributes = {}) {
    return this.startSpan(traceId, parentSpanId, `model.${operation}`, {
      'model.version': modelVersion,
      'model.operation': operation,
      ...attributes
    });
  }

  /**
   * Create span for audio generation
   */
  createAudioSpan(traceId, parentSpanId, operation, attributes = {}) {
    return this.startSpan(traceId, parentSpanId, `audio.${operation}`, {
      'audio.operation': operation,
      ...attributes
    });
  }
}

// Global tracer instance
const tracer = new OpenTelemetryTracer();

module.exports = { OpenTelemetryTracer, tracer };
