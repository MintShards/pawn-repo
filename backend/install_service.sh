#!/bin/bash
#
# Pawnshop API Service Installation Script
#
# This script sets up the systemd service for automatic startup and management
# of the Pawnshop Operations API server.
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root. Use your regular user account."
    print_info "The script will use sudo when needed."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_FILE="$SCRIPT_DIR/pawnrepo.service"
SYSTEMD_DIR="/etc/systemd/system"

print_info "Pawnshop API Service Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    print_error "Service file not found: $SERVICE_FILE"
    exit 1
fi

print_info "Service file found: $SERVICE_FILE"

# Check if virtual environment exists
if [ ! -d "$SCRIPT_DIR/env" ]; then
    print_error "Virtual environment not found at $SCRIPT_DIR/env"
    print_info "Please create it first: python -m venv env"
    exit 1
fi

print_success "Virtual environment found"

# Check if dependencies are installed
if [ ! -f "$SCRIPT_DIR/env/bin/uvicorn" ]; then
    print_error "Uvicorn not found in virtual environment"
    print_info "Please install dependencies: pip install -r requirements.txt"
    exit 1
fi

print_success "Dependencies verified"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    print_warning ".env file not found"
    print_info "The service will start, but may not work without proper configuration"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Stop existing service if running
if systemctl is-active --quiet pawnrepo.service; then
    print_info "Stopping existing service..."
    sudo systemctl stop pawnrepo.service
    print_success "Service stopped"
fi

# Copy service file
print_info "Installing service file..."
sudo cp "$SERVICE_FILE" "$SYSTEMD_DIR/pawnrepo.service"
print_success "Service file installed"

# Reload systemd
print_info "Reloading systemd daemon..."
sudo systemctl daemon-reload
print_success "Systemd reloaded"

# Enable service (start on boot)
print_info "Enabling service (auto-start on boot)..."
sudo systemctl enable pawnrepo.service
print_success "Service enabled"

# Start service
print_info "Starting service..."
sudo systemctl start pawnrepo.service

# Wait a moment for startup
sleep 2

# Check status
if systemctl is-active --quiet pawnrepo.service; then
    print_success "Service is running!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "Installation completed successfully!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Service Management Commands:"
    echo "  Status:  sudo systemctl status pawnrepo"
    echo "  Stop:    sudo systemctl stop pawnrepo"
    echo "  Start:   sudo systemctl start pawnrepo"
    echo "  Restart: sudo systemctl restart pawnrepo"
    echo "  Logs:    sudo journalctl -u pawnrepo -f"
    echo ""
    echo "API Endpoints:"
    echo "  Health:  curl http://localhost:8000/api/v1/user/health"
    echo "  Docs:    http://localhost:8000/docs"
    echo ""
    print_info "The scheduler will run daily at 2:00 AM automatically"
else
    print_error "Service failed to start"
    echo ""
    print_info "Check the logs for errors:"
    echo "  sudo journalctl -u pawnrepo -n 50"
    echo ""
    print_info "Check service status:"
    echo "  sudo systemctl status pawnrepo"
    exit 1
fi
