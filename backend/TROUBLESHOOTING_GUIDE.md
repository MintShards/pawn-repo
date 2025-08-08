# Backend Troubleshooting Guide

## Error: [Errno 98] Address already in use

### Problem
When trying to start the backend server with `uvicorn app.app:app --reload`, you get:
```
ERROR:    [Errno 98] Address already in use
```

### Cause
This error occurs when:
- A previous instance of the server is still running on port 8000
- The server didn't shut down cleanly
- Another application is using port 8000

### Solution

#### 1. Find the process using port 8000
```bash
lsof -ti:8000
```

#### 2. Check what process is running
```bash
ps aux | grep <PID>
```

#### 3. Kill the process
```bash
kill -9 <PID>
```
Or kill all processes on port 8000:
```bash
kill -9 $(lsof -ti:8000)
```

#### 4. Restart the server
```bash
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
source env/bin/activate
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

### Alternative Solutions

#### Run on a different port
```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8001
```

#### Run in background with logging
```bash
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000 > server.log 2>&1 &
```

#### Check server status
```bash
# Check if server is running
ps aux | grep uvicorn

# Test if server is responding
curl http://localhost:8000/docs
```

### Prevention
- Always shut down the server cleanly with `Ctrl+C`
- Use `--workers 1` to avoid multiple worker processes
- Consider using a process manager like `supervisord` for production

### Common Related Issues

#### Redis Connection Warning
```
{"error": "Error 111 connecting to localhost:6379. Connection refused."}
```
This is expected if Redis isn't running. The app falls back to in-memory rate limiting.

#### Permission Denied
If you get permission errors, ensure:
- Virtual environment is activated
- You have write permissions in the backend directory
- Port 8000 isn't restricted by firewall

### Quick Start Script
Create a `start_server.sh` script:
```bash
#!/bin/bash
# Kill any existing processes on port 8000
kill -9 $(lsof -ti:8000) 2>/dev/null || true

# Start the server
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
source env/bin/activate
uvicorn app.app:app --reload --host 0.0.0.0 --port 8000
```

Make it executable:
```bash
chmod +x start_server.sh
```