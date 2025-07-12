# Pawn Repo - Quick Start Guide

## Prerequisites
- Docker and Docker Compose installed
- At least 4GB RAM available
- Ports 3000, 8000, 27017 available

## Setup Steps

1. **Environment Configuration**
   ```bash
   cp .env.example backend/.env
   ```

2. **Start the System**
   ```bash
   docker-compose up -d
   ```

3. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - MongoDB: localhost:27017

## First Time Setup
1. Open http://localhost:3000
2. Create your first admin user through the setup wizard
3. Start managing your pawnshop!

## Services
- **Frontend**: React app with Chakra UI
- **Backend**: FastAPI with MongoDB
- **Database**: MongoDB with automated initialization

## Features Available
- PIN-based authentication
- Customer management
- Pawn loan transactions
- Payment processing with receipts
- Real-time updates via WebSocket
- Advanced reporting and analytics
- Audit trail logging
- Automated backups

## Stopping the System
```bash
docker-compose down
```

## Data Persistence
- Database data: Stored in Docker volume `mongodb_data`
- Backups: Stored in `./backups` directory
- Logs: Stored in `./logs` directory