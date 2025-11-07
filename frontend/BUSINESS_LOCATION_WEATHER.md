# Business Location Weather System

## Overview

The weather system now uses **manual business location settings** instead of browser permission requests. Admins set the business location once in settings, and accurate weather is always displayed - no permission prompts needed!

## How It Works

### New Flow (No Permissions Needed!)
```
1. Check cache (24h) → Use if valid
2. Fetch business location from settings → Use if configured
3. Fallback to IP geolocation → Only if settings not configured
```

**Result:** Zero permission prompts, always accurate weather for your business location

### Old Flow (❌ Removed)
```
Browser asks location permission → User must allow → Different location each time
```

## Setting Up Business Location

### Admin Settings Page

1. Navigate to **Admin Settings**
2. Find **Company Configuration** section
3. Enter or update your business address
4. **Add Location Coordinates**:
   - Option 1: Use the location search feature (coming soon)
   - Option 2: Manually enter latitude/longitude

### Finding Your Coordinates

**Method 1: Google Maps**
1. Go to Google Maps
2. Search for your business address
3. Right-click on the location pin
4. Click the coordinates to copy them
5. Format: First number = Latitude, Second number = Longitude

**Method 2: GPS Coordinates Website**
- Visit: https://www.gps-coordinates.net
- Enter your address
- Copy the decimal coordinates

**Method 3: From Your Smartphone**
- iOS Maps: Drop a pin → swipe up → copy coordinates
- Google Maps app: Long press location → copy coordinates

### Example Configuration

```json
{
  "company_name": "CashNow Pawn Solutions",
  "address_line1": "1234 Main Street",
  "city": "Newton",
  "state": "BC",
  "latitude": 49.0469,
  "longitude": -122.8761,
  "timezone": "America/Vancouver"
}
```

## Benefits

✅ **No Permission Prompts** - Never asks users for location access
✅ **Always Accurate** - Weather always matches your actual business location
✅ **Consistent Display** - Same weather on all pages, all users, all devices
✅ **Multi-Location Support** - Easy to update if you move or have multiple locations
✅ **Privacy Friendly** - No tracking, no GPS, completely transparent
✅ **Offline Capable** - Works with cached data even when offline
✅ **Professional** - Shows customers your actual store location weather

## API Endpoints

### Get Company Configuration (includes location)
```
GET /api/v1/admin/business-config/company
```

**Response:**
```json
{
  "company_name": "CashNow Solutions",
  "city": "Newton",
  "state": "BC",
  "latitude": 49.0469,
  "longitude": -122.8761,
  "timezone": "America/Vancouver",
  ...
}
```

### Update Company Configuration
```
POST /api/v1/admin/business-config/company
```

**Request Body:**
```json
{
  "company_name": "CashNow Solutions",
  "address_line1": "1234 Main St",
  "city": "Newton",
  "state": "BC",
  "zip_code": "V2L 1A1",
  "phone": "6045551234",
  "latitude": 49.0469,
  "longitude": -122.8761,
  "timezone": "America/Vancouver"
}
```

## Technical Details

### Weather Data Sources

**Priority Order:**
1. **24-Hour Cache** - Fastest, uses localStorage
2. **Business Settings** - Configured coordinates from admin settings
3. **IP Geolocation** - Fallback if settings not configured

### Cache Duration

**Default:** 24 hours

**Storage:** Browser localStorage (`weather_cache`)

**Cache Key:** Includes coordinates to detect location changes

### Location Data Flow

```javascript
// Frontend weather hook
const fetchWeather = async () => {
  // 1. Check cache first
  const cached = getCachedWeather();
  if (cached) return cached;

  // 2. Try business settings
  const settings = await fetch('/api/v1/admin/business-config/company');
  if (settings.latitude && settings.longitude) {
    return await fetchWeatherByCoords(
      settings.latitude,
      settings.longitude,
      settings.city
    );
  }

  // 3. Fallback to IP geolocation
  return await fetchWeatherByIP();
};
```

### Database Schema

**Backend Model:** `CompanyConfig`

**New Fields:**
- `latitude: Optional[float]` - Business latitude (-90 to 90)
- `longitude: Optional[float]` - Business longitude (-180 to 180)
- `timezone: Optional[str]` - Business timezone

**Validation:**
- Coordinates are optional (system works without them)
- Valid latitude range: -90 to 90
- Valid longitude range: -180 to 180
- Timezone follows IANA format (e.g., "America/Vancouver")

## Migration Guide

### For Existing Installations

1. **Update Backend Models**
   - `CompanyConfig` model now includes location fields
   - No database migration needed (fields are optional)

2. **Configure Location**
   - Navigate to Admin Settings
   - Update company configuration with coordinates
   - Save changes

3. **Verify Weather**
   - Refresh any page
   - Check console: Should show "Using business location: [city]"
   - Weather should display instantly without prompts

### For New Installations

1. **Initial Setup**
   - Complete company configuration during setup
   - Include latitude/longitude coordinates
   - Weather works immediately

2. **Without Coordinates**
   - System falls back to IP geolocation
   - Still works, but less accurate
   - Can configure coordinates later

## Troubleshooting

### Weather Not Displaying

**Symptoms:** Blank weather section or "Unknown Location"

**Solutions:**
1. Check if business location is configured
2. Verify coordinates are within valid ranges
3. Clear weather cache: `localStorage.removeItem('weather_cache')`
4. Check browser console for errors

### Wrong Location Showing

**Symptoms:** Weather for wrong city

**Solutions:**
1. Verify coordinates in Admin Settings
2. Check if coordinates match your business address
3. Clear cache and refresh
4. Use IP geolocation temporarily while fixing coordinates

### Cache Not Working

**Symptoms:** Weather loads slowly every time

**Solutions:**
1. Check if localStorage is enabled
2. Verify not in private/incognito mode
3. Check browser console for cache errors
4. Adjust cache duration if needed

## Console Logging

Helpful debug messages in browser console:

```javascript
// Using cached data
"Using cached weather data"
"Cache valid for 23 more hours"

// Using business settings
"Fetching business location from settings..."
"Using business location: Newton (49.0469, -122.8761)"

// Fallback to IP
"Business location not configured in settings, falling back to IP geolocation"
"Using IP-based geolocation..."

// Weather fetch
"Weather data cached successfully"
```

## Future Enhancements

Possible improvements:

1. **Location Search UI** (Planned)
   - City search with autocomplete
   - Visual map picker
   - Preview weather before saving

2. **Multiple Locations**
   - Support for multiple store locations
   - User can select their current store
   - Weather updates based on selection

3. **Weather Alerts**
   - Severe weather notifications
   - Business day impact alerts
   - Customer notification integration

4. **Historical Weather**
   - Track weather patterns
   - Correlate with sales data
   - Business intelligence insights

## Related Files

### Backend
- `/backend/app/models/business_config_model.py` - Location fields added
- `/backend/app/schemas/business_config_schema.py` - API schemas updated
- `/backend/app/api/api_v1/handlers/business_config.py` - Existing endpoints work

### Frontend
- `/frontend/src/hooks/useWeather.js` - Business location integration
- `/frontend/src/context/WeatherContext.jsx` - Global weather state
- `/frontend/src/components/common/PageHeader.jsx` - Weather display
- `/frontend/src/App.js` - WeatherProvider wrapper

## Support

### Common Questions

**Q: Do I need to enter coordinates?**
A: No, they're optional. System falls back to IP geolocation if not configured.

**Q: How often does weather update?**
A: Every 24 hours automatically, or when cache is cleared.

**Q: Can I change location easily?**
A: Yes! Just update coordinates in Admin Settings and refresh.

**Q: Does this work offline?**
A: Yes, cached weather displays even when offline (up to 24 hours old).

**Q: What if I have multiple locations?**
A: Currently single location. Multi-location support planned for future.

## Security & Privacy

**What's Stored:**
- Business coordinates (admin-configured)
- Weather data (temperature, condition, city name)
- Cache timestamp

**What's NOT Stored:**
- User GPS location
- IP addresses
- Personal user data
- Tracking information

**Access Control:**
- Only admins can configure location
- All users see same business weather
- No individual user tracking
- Transparent data handling
