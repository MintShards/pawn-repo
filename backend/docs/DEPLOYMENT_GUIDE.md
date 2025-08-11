# Deployment Guide

Production deployment guide for the Pawnshop Operations System.

## Prerequisites

- Python 3.8+
- MongoDB 4.4+
- Virtual environment support
- SSL certificates (for production)

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd pawn-repo/backend
```

### 2. Create Virtual Environment
```bash
python -m venv env
source env/bin/activate  # Linux/Mac
env\Scripts\activate     # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Environment Configuration

Create `.env` file:
```bash
# Database
MONGO_CONNECTION_STRING=mongodb://localhost:27017/pawnshop

# Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET_KEY=your-super-secret-refresh-key-here
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# API Configuration
API_V1_PREFIX=/api/v1
PROJECT_NAME=Pawnshop Operations API
VERSION=1.0.0
DEBUG=false

# Security
ALLOWED_ORIGINS=["http://localhost:3000"]
ALLOWED_METHODS=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
ALLOWED_HEADERS=["*"]

# Monitoring
ENABLE_METRICS=true
LOG_LEVEL=INFO
```

## MongoDB Setup

### Development (Local)
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath /data/db

# Create database and user
mongosh
use pawnshop
db.createUser({
  user: "pawnshop_user",
  pwd: "secure_password",
  roles: [{ role: "readWrite", db: "pawnshop" }]
})
```

### Production (Replica Set)
```bash
# MongoDB replica set configuration
rs.initiate({
  _id: "pawnshop-rs",
  members: [
    { _id: 0, host: "mongo1:27017" },
    { _id: 1, host: "mongo2:27017" },
    { _id: 2, host: "mongo3:27017" }
  ]
})
```

## Application Deployment

### Development Server
```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

### Production Server
```bash
# Using Gunicorn with Uvicorn workers
gunicorn app.app:app -w 4 -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
```

## Docker Deployment

### Dockerfile
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "app.app:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MONGO_CONNECTION_STRING=mongodb://mongo:27017/pawnshop
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=admin_password
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: unless-stopped

volumes:
  mongo_data:
```

## Nginx Configuration

```nginx
upstream pawnshop_api {
    server api:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://pawnshop_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/v1/docs {
        proxy_pass http://pawnshop_api;
        proxy_set_header Host $host;
    }
}
```

## Security Configuration

### SSL/TLS Setup
```bash
# Generate self-signed certificate (development)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# Production: Use Let's Encrypt
certbot --nginx -d your-domain.com
```

### Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw deny 8000   # Block direct API access
ufw deny 27017  # Block direct MongoDB access
ufw enable
```

## Monitoring Setup

### Health Checks
```bash
# API health check
curl http://localhost:8000/api/v1/monitoring/health

# MongoDB health check
mongosh --eval "db.adminCommand('ping')"
```

### Log Management
```bash
# Application logs
tail -f /var/log/pawnshop/app.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

### Performance Monitoring
```bash
# System metrics
htop
iostat -x 1
netstat -tuln

# Application metrics
curl http://localhost:8000/api/v1/monitoring/metrics
```

## Backup Strategy

### Database Backup
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"

mongodump --host localhost:27017 --db pawnshop --out $BACKUP_DIR/$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

### Application Backup
```bash
# Backup configuration and logs
tar -czf /backups/app/pawnshop_$DATE.tar.gz \
  /app/.env \
  /var/log/pawnshop/ \
  /etc/nginx/sites-available/pawnshop
```

## Scaling Considerations

### Horizontal Scaling
- Load balancer configuration
- Multiple API instances
- MongoDB replica sets
- Redis for session management

### Vertical Scaling
- CPU and memory optimization
- Database connection pooling
- Caching strategies
- CDN for static assets

## Maintenance

### Regular Tasks
```bash
# Update dependencies
pip list --outdated
pip install -U package_name

# Database maintenance
mongosh --eval "db.runCommand({compact: 'collection_name'})"

# Log rotation
logrotate -f /etc/logrotate.d/pawnshop

# SSL certificate renewal
certbot renew
```

### Security Updates
```bash
# System updates
apt update && apt upgrade

# Security scanning
pip-audit
bandit -r app/

# Dependency scanning
safety check
```

## Troubleshooting

### Common Issues

**1. MongoDB Connection Errors**
```bash
# Check MongoDB status
systemctl status mongod

# Check network connectivity
telnet localhost 27017

# Check authentication
mongosh -u username -p password
```

**2. API Performance Issues**
```bash
# Check CPU/Memory usage
top -p $(pgrep -f "uvicorn\|gunicorn")

# Check database queries
mongosh --eval "db.setProfilingLevel(2)"

# Analyze slow queries
mongosh --eval "db.system.profile.find().pretty()"
```

**3. SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:443
```

### Recovery Procedures

**Database Recovery:**
```bash
# Restore from backup
mongorestore --host localhost:27017 --db pawnshop /backups/mongodb/latest/pawnshop/

# Repair database
mongod --repair --dbpath /data/db
```

**Application Recovery:**
```bash
# Restart services
systemctl restart pawnshop-api
systemctl restart nginx

# Check service status
systemctl status pawnshop-api nginx
```

## Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured
- [ ] Firewall rules applied
- [ ] Log rotation configured
- [ ] Health checks implemented
- [ ] Load testing completed
- [ ] Security scan performed
- [ ] Documentation updated