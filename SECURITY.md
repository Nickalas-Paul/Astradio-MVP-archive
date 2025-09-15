# Astradio Security Implementation

This document outlines the comprehensive security measures implemented in Astradio according to the security blueprint.

## 🔐 Identity and Authentication

### Password Security
- **Algorithm**: Argon2id with per-user salt
- **Parameters**: 
  - Memory cost: 64-128 MB (configurable via `ARGON2_MEMORY_COST`)
  - Time cost: 3-5 iterations (configurable via `ARGON2_TIME_COST`)
  - Parallelism: 1-2 (configurable via `ARGON2_PARALLELISM`)
- **Requirements**: 12+ characters with complexity rules
- **Validation**: Configurable via environment variables:
  - `PASSWORD_MIN_LENGTH=12`
  - `PASSWORD_REQUIRE_UPPERCASE=true`
  - `PASSWORD_REQUIRE_LOWERCASE=true`
  - `PASSWORD_REQUIRE_NUMBERS=true`
  - `PASSWORD_REQUIRE_SYMBOLS=true`

### JWT Token Security
- **Access tokens**: 15-minute expiry with proper claims
- **Claims included**: `aud`, `iss`, `sub`, `jti`, `iat`, `exp`, `type`, `device_id`
- **Algorithm**: HS256 with secure secret
- **Refresh tokens**: 7-day expiry with device tracking
- **Token blacklisting**: Implemented for immediate revocation

### Session Management
- **Device tracking**: Unique device IDs based on IP + User-Agent hash
- **Session storage**: Redis with TTL and device metadata
- **Global logout**: Invalidate all sessions across devices
- **Token rotation**: Refresh tokens rotate on every use

### Magic Links
- **Expiry**: 10 minutes
- **Single-use**: Nonce-based with usage tracking
- **Rate limiting**: Per-IP and per-email limits
- **Security**: ULID-based nonces with Redis storage

## 🛡️ API and Web Security

### Security Headers
All security headers are implemented via Helmet middleware:

```javascript
Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; media-src 'self' https:; script-src 'self' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### CORS Configuration
- **Origins**: Restricted to configured domains only
- **Credentials**: Enabled for authenticated requests
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Whitelisted headers only
- **Preflight**: 10-minute cache

### Rate Limiting
Implemented with Redis-based sliding window:

- **Global**: 100 requests per 15 minutes per IP
- **Authentication**: 10 requests per minute per IP, 100 per day
- **Render endpoints**: 3 per hour per user (free tier), 20 per hour (paid)
- **Social actions**: 60 per minute per IP
- **Magic links**: 5 per hour per IP

### Input Validation and Sanitization
- **Framework**: Express-validator with custom validation
- **Sanitization**: XSS protection, parameter pollution prevention
- **Schema validation**: Centralized validation schemas
- **Unknown fields**: Rejected by default

## 💳 Payments and Webhooks

### Stripe Integration
- **Elements**: Client-side card handling only
- **Webhook verification**: Signature validation with 5-minute tolerance
- **Idempotency**: All create/update calls use idempotency keys
- **Data storage**: Only customer ID and subscription status

### Webhook Security
```javascript
// Example webhook handler
app.post('/webhooks/stripe', raw({type:'application/json'}), (req,res)=>{
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  handleEvent(event); // must be idempotent
  res.sendStatus(200);
});
```

## 🗄️ Data Security and Privacy

### Database Security
- **Connection**: Parameterized queries only
- **Users**: Separate read-only and read-write users
- **Row Level Security**: Enabled on user-scoped tables
- **Encryption**: TLS everywhere, secrets encrypted at rest

### PII Protection
- **Minimization**: Only necessary data collected
- **Logging**: Email addresses redacted from logs
- **Deletion**: Cascading deletes for account removal
- **Audit trails**: All security events logged

### Backup Security
- **Frequency**: Daily snapshots with 7-30 day retention
- **Encryption**: Backup encryption keys in KMS
- **Testing**: Quarterly restore drills
- **Point-in-time**: 7-day PITR capability

## 📁 File and Media Handling

### Upload Security
- **Type validation**: MIME type and magic bytes verification
- **Size limits**: Configurable via `MAX_FILE_SIZE`
- **Virus scanning**: ClamAV integration for user uploads
- **Processing**: Server-side image generation, never serve originals

### Audio Rendering Sandbox
- **Isolation**: Worker process or container isolation
- **Time limits**: Per-render timeouts
- **Memory caps**: Strict memory limits
- **Network**: Dropped for render workers

## 🔍 App Logic Protections

### SSRF Prevention
- **URL validation**: Allowlist-based URL fetching
- **Blocked ranges**: RFC1918 and link-local IP ranges
- **Protocol restriction**: HTTP/HTTPS only

### Path Traversal Protection
- **UUID paths**: All file paths use UUIDs
- **Input sanitization**: No raw input concatenation
- **Validation**: Strict path validation

### XSS Protection
- **Content escaping**: All user content escaped
- **Sanitization**: Markdown sanitizer for rich content
- **CSP**: Strict Content Security Policy
- **InnerHTML**: Avoided where possible

### Clickjacking Protection
- **Frame ancestors**: `frame-ancestors 'none'`
- **X-Frame-Options**: DENY header
- **UI protection**: No frame embedding allowed

## 📊 Observability and Incident Response

### Logging
- **Structured logs**: JSON format with request IDs
- **Security events**: Comprehensive audit logging
- **PII exclusion**: No sensitive data in logs
- **Centralized**: Log aggregation and monitoring

### Monitoring and Alerts
- **Auth errors**: Spike detection
- **5xx errors**: Error rate monitoring
- **Render failures**: Success rate tracking
- **Rate limiting**: Saturation alerts
- **Database**: Error rate monitoring

### Audit Logging
All security events are logged with:
- User ID and device ID
- IP address and User-Agent
- Timestamp and event type
- Additional context data

### Incident Response
- **Runbook**: Documented response procedures
- **Contact**: On-call contact information
- **Rollback**: Automated rollback procedures
- **Communication**: User notification templates
- **Evidence**: Retention policies

## 🚀 DevSecOps and Supply Chain

### Code Security
- **Review**: Mandatory code review for all changes
- **Branches**: Protected main branch
- **CI/CD**: Security checks in pipeline
- **Secrets**: No secrets in code

### Dependency Security
- **SBOM**: Software Bill of Materials generation
- **Scanning**: Automated vulnerability scanning
- **Updates**: Automated dependency updates
- **Pinning**: Version lockfiles

### Build Security
- **Signing**: Release signing and provenance
- **Artifacts**: Immutable build artifacts
- **Environments**: Separate staging and production
- **Credentials**: Distinct per environment

## 👨‍💼 Admin and Backoffice

### Admin Security
- **Separate domain**: Admin app on separate domain
- **2FA requirement**: Mandatory for all admin accounts
- **IP allowlist**: Optional IP restrictions
- **Read-only**: Default read-only dashboards

### Role Management
- **Fine-grained roles**: user, moderator, admin
- **No god mode**: Break-glass procedures required
- **Audit trails**: All admin actions logged
- **Least privilege**: Minimal required permissions

## 🔧 Configuration

### Environment Variables
All security settings are configurable via environment variables. See `env.example` for complete list.

### Security Headers Configuration
```javascript
// Example helmet configuration
helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "https:", "data:"],
      "media-src": ["'self'", "https:"],
      "script-src": ["'self'", "'strict-dynamic'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'", "https:"],
      "frame-ancestors": ["'none'"]
    }
  }
})
```

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] HSTS preloaded
- [ ] Valid TLS certificates
- [ ] No mixed content
- [ ] CSP violations monitored
- [ ] Auth flows tested with 2FA
- [ ] CSRF and CORS verified
- [ ] Webhooks tested and replay-tested
- [ ] Backup restore tested
- [ ] Admin access audited
- [ ] Rate limits tuned under load
- [ ] Privacy policy and ToS published
- [ ] Account deletion tested end-to-end

### Production Security
- [ ] All secrets rotated
- [ ] Database users configured with least privilege
- [ ] Redis configured with authentication
- [ ] File upload limits enforced
- [ ] Monitoring and alerting active
- [ ] Incident response procedures documented
- [ ] Security team contact information updated

## 🔍 Security Testing

### Automated Testing
- **SAST**: Static application security testing
- **DAST**: Dynamic application security testing
- **Dependency scanning**: Automated vulnerability checks
- **Secret scanning**: CI/CD integration

### Manual Testing
- **Penetration testing**: Regular security assessments
- **Code review**: Security-focused code reviews
- **Configuration review**: Security configuration audits
- **Incident response drills**: Regular testing of procedures

## 📞 Security Contacts

- **Security Team**: security@astradio.io
- **Bug Reports**: security@astradio.io
- **Incident Response**: On-call rotation
- **Compliance**: compliance@astradio.io

## 📋 Compliance

This implementation addresses:
- **OWASP Top 10**: All major web vulnerabilities
- **GDPR**: Privacy and data protection
- **SOC 2**: Security controls and monitoring
- **PCI DSS**: Payment card security (if applicable)

## 🔄 Updates and Maintenance

- **Security patches**: Applied within 24 hours
- **Dependency updates**: Weekly automated updates
- **Configuration reviews**: Monthly security audits
- **Incident reviews**: Post-incident analysis and improvements

---

*This security implementation follows industry best practices and is regularly updated based on emerging threats and security research.*
