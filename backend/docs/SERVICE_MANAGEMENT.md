# Service Management Guide

Complete guide for managing the Pawnshop Operations API as a systemd service for 24/7 production operation.

## Quick Start

### Installation (One-Time Setup)

```bash
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
./install_service.sh
```

That's it! The service is now running 24/7 and will:
- ✅ Start automatically when the system boots
- ✅ Restart automatically if it crashes
- ✅ Run the status scheduler at 2:00 AM daily
- ✅ Keep running even if you logout

---

## Service Management

### Basic Commands

```bash
# Check if service is running
sudo systemctl status pawnshop

# Start the service
sudo systemctl start pawnshop

# Stop the service
sudo systemctl stop pawnshop

# Restart the service
sudo systemctl restart pawnshop

# View recent logs
sudo journalctl -u pawnshop -n 50

# Follow logs in real-time
sudo journalctl -u pawnshop -f
```

### Check Service Health

```bash
# Quick health check
curl http://localhost:8000/api/v1/user/health

# Expected response:
# {"status":"ok"}

# Check API documentation is accessible
curl http://localhost:8000/docs
```

---

## Automatic Features

### What Happens Automatically

1. **Auto-Start on Boot**
   - Service starts when the computer boots up
   - No manual intervention needed

2. **Auto-Restart on Crash**
   - If the service crashes, systemd restarts it automatically
   - Maximum 5 restart attempts within 200 seconds
   - 10-second delay between restarts

3. **Daily Status Updates**
   - Runs at 2:00 AM every day
   - Updates overdue transaction statuses
   - Logs all changes

4. **Resource Management**
   - CPU: Limited to 200% (2 cores max)
   - Memory: Limited to 2GB max
   - File handles: 4096 max

---

## Monitoring

### Check Scheduler Logs

**Verify daily status updates are running:**

```bash
# See recent scheduler activity
sudo journalctl -u pawnshop | grep "scheduled status update"

# Expected output:
# Oct 18 02:00:00 pawnshop-api[1234]: Starting scheduled status update...
# Oct 18 02:00:01 pawnshop-api[1234]: Scheduled status update completed: updated_counts={'overdue': 5}
```

### Service Status Details

```bash
# Full service status with recent logs
sudo systemctl status pawnshop

# Output shows:
# - Active: active (running) - Service is working
# - Process ID (PID)
# - Memory usage
# - Recent log entries
```

### Performance Monitoring

```bash
# Check resource usage
sudo systemctl show pawnshop --property=MemoryCurrent,CPUUsageNSec

# Monitor in real-time with htop
htop -p $(systemctl show -p MainPID --value pawnshop)
```

---

## Troubleshooting

### Service Won't Start

**Check logs for errors:**
```bash
sudo journalctl -u pawnshop -n 100 --no-pager
```

**Common issues:**

1. **Port already in use:**
   ```bash
   # Check what's using port 8000
   sudo lsof -i :8000

   # Kill the process if needed
   sudo kill -9 <PID>
   ```

2. **MongoDB not running:**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongodb

   # Start MongoDB
   sudo systemctl start mongodb
   ```

3. **Missing environment variables:**
   ```bash
   # Check .env file exists
   ls -la /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend/.env

   # Verify required variables
   cat .env | grep -E "MONGO_CONNECTION_STRING|JWT_SECRET_KEY"
   ```

4. **Permission errors:**
   ```bash
   # Check file ownership
   ls -la /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend

   # Fix if needed
   sudo chown -R mint:mint /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
   ```

### Service Crashes Repeatedly

**View crash logs:**
```bash
# See all crashes today
sudo journalctl -u pawnshop --since today --grep "Failed"

# See last 5 crashes
sudo journalctl -u pawnshop --reverse --grep "Failed" -n 5
```

**Check restart history:**
```bash
# See how many times service restarted
systemctl show pawnshop | grep NRestarts
```

**Disable auto-restart temporarily (for debugging):**
```bash
# Stop service completely
sudo systemctl stop pawnshop

# Run manually to see errors
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
source env/bin/activate
uvicorn app.app:app --host 0.0.0.0 --port 8000
```

### Scheduler Not Running

**Check if scheduler started:**
```bash
# Look for startup message
sudo journalctl -u pawnshop | grep "Background scheduler started"

# Expected:
# Background scheduler started - daily status updates at 2:00 AM
```

**Check if scheduler ran last night:**
```bash
# Look for scheduled runs
sudo journalctl -u pawnshop --since "2 days ago" | grep "scheduled status update"
```

**If no logs found:**
- Service may have been stopped at 2:00 AM
- Check service uptime: `sudo systemctl status pawnshop | grep Active`

**Manually trigger update:**
```bash
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
source env/bin/activate
python update_statuses.py
```

---

## Maintenance

### Update the Application

**When you update the code:**

```bash
# 1. Pull latest changes
cd /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend
git pull

# 2. Update dependencies if needed
source env/bin/activate
pip install -r requirements.txt

# 3. Restart service to apply changes
sudo systemctl restart pawnshop

# 4. Verify it's running
sudo systemctl status pawnshop
```

### Update Service Configuration

**If you modify `pawnshop.service` file:**

```bash
# 1. Copy updated service file
sudo cp pawnshop.service /etc/systemd/system/

# 2. Reload systemd
sudo systemctl daemon-reload

# 3. Restart service
sudo systemctl restart pawnshop

# 4. Verify
sudo systemctl status pawnshop
```

### Backup Service Configuration

```bash
# Backup current service file
sudo cp /etc/systemd/system/pawnshop.service ~/pawnshop.service.backup

# Include in regular backups
tar -czf pawnshop-backup-$(date +%Y%m%d).tar.gz \
  /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend/.env \
  /etc/systemd/system/pawnshop.service \
  /var/log/journal/*pawnshop*
```

### Log Rotation

**Prevent logs from growing too large:**

```bash
# Check current log size
sudo journalctl -u pawnshop --disk-usage

# Keep only last 7 days
sudo journalctl --vacuum-time=7d

# Keep only last 500MB
sudo journalctl --vacuum-size=500M
```

---

## Advanced Configuration

### Change Scheduler Time

**To run at 3:00 AM instead of 2:00 AM:**

1. Edit the application:
   ```bash
   nano /mnt/c/Users/seji\ lamina/Desktop/pawn-repo/backend/app/app.py
   ```

2. Find line ~135:
   ```python
   CronTrigger(hour=2, minute=0)
   ```

3. Change to:
   ```python
   CronTrigger(hour=3, minute=0)
   ```

4. Restart service:
   ```bash
   sudo systemctl restart pawnshop
   ```

### Increase Workers

**For better performance with more traffic:**

1. Edit service file:
   ```bash
   sudo nano /etc/systemd/system/pawnshop.service
   ```

2. Change workers (line with ExecStart):
   ```ini
   ExecStart=/path/to/env/bin/uvicorn app.app:app --host 0.0.0.0 --port 8000 --workers 8
   ```

3. Reload and restart:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart pawnshop
   ```

### Email Alerts on Failure

**Get notified if service crashes:**

1. Install mail utilities:
   ```bash
   sudo apt install mailutils
   ```

2. Create monitoring script:
   ```bash
   sudo nano /usr/local/bin/pawnshop-monitor.sh
   ```

3. Add:
   ```bash
   #!/bin/bash
   if ! systemctl is-active --quiet pawnshop; then
       echo "Pawnshop service is down!" | mail -s "Service Alert" your@email.com
   fi
   ```

4. Make executable:
   ```bash
   sudo chmod +x /usr/local/bin/pawnshop-monitor.sh
   ```

5. Add to crontab (check every 5 minutes):
   ```bash
   sudo crontab -e
   # Add:
   */5 * * * * /usr/local/bin/pawnshop-monitor.sh
   ```

---

## Uninstall

**To remove the service:**

```bash
# Stop and disable service
sudo systemctl stop pawnshop
sudo systemctl disable pawnshop

# Remove service file
sudo rm /etc/systemd/system/pawnshop.service

# Reload systemd
sudo systemctl daemon-reload
```

---

## Production Checklist

Before going to production, verify:

- [ ] Service starts successfully: `sudo systemctl status pawnshop`
- [ ] Service restarts on crash: Kill process and check auto-restart
- [ ] Service starts on boot: Reboot computer and verify
- [ ] API responds: `curl http://localhost:8000/api/v1/user/health`
- [ ] Scheduler logs visible: Check for "Background scheduler started"
- [ ] MongoDB connection works: Check logs for database errors
- [ ] Environment variables loaded: Verify in logs
- [ ] Logs are readable: `sudo journalctl -u pawnshop -n 50`
- [ ] Resource limits appropriate: Check CPU/memory usage
- [ ] Backup strategy in place: Schedule regular backups

---

## Support

### Quick Reference

```bash
# Service management
sudo systemctl {start|stop|restart|status} pawnshop

# Logs
sudo journalctl -u pawnshop -f                    # Follow logs
sudo journalctl -u pawnshop -n 100                # Last 100 lines
sudo journalctl -u pawnshop --since "1 hour ago"  # Last hour
sudo journalctl -u pawnshop --since today         # Today's logs

# Health checks
curl http://localhost:8000/api/v1/user/health     # API health
sudo systemctl is-active pawnshop                 # Service status
sudo systemctl is-enabled pawnshop                # Boot enabled?

# Scheduler verification
sudo journalctl -u pawnshop | grep "scheduled status update"
```

### Getting Help

If you encounter issues:

1. **Check logs first**: `sudo journalctl -u pawnshop -n 100`
2. **Verify service status**: `sudo systemctl status pawnshop`
3. **Check MongoDB**: `sudo systemctl status mongodb`
4. **Test manually**: Run uvicorn directly to see errors
5. **Review this guide**: Most issues are covered above

---

## Summary

**Setup once, forget forever:**

1. Run `./install_service.sh` (one time)
2. Service runs 24/7 automatically
3. Scheduler updates statuses every night at 2 AM
4. Auto-restarts if it crashes
5. Starts automatically on boot

**No need to:**
- Keep terminal open
- Stay logged in
- Manually start after reboot
- Remember to run updates
- Monitor constantly

**The service handles everything automatically!** ✨
