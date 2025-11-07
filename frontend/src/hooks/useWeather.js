import { useState, useEffect } from 'react';

// Cache configuration
const WEATHER_CACHE_KEY = 'weather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds (for accurate real-time weather)

/**
 * Custom hook to fetch weather data based on business location
 * Features:
 * - Caches weather data for 30 minutes for real-time accuracy
 * - Uses business location from LocationConfig API (primary)
 * - Falls back to IP geolocation if LocationConfig not configured
 * - No browser geolocation permissions required
 * - Uses OpenWeatherMap or Open-Meteo APIs
 */
export const useWeather = () => {
  const [weather, setWeather] = useState({
    temperature: null,
    condition: null,
    description: null,
    icon: null,
    city: null,
    timezone: null, // Business location timezone (e.g., 'America/Vancouver')
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Check for cached weather data first
        const cachedData = getCachedWeather();
        if (cachedData) {
          setWeather({
            ...cachedData,
            loading: false,
            error: null
          });
          return; // Use cached data, skip API requests
        }

        // Step 1: Try to get business location from LocationConfig API
        try {
          const locationResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/v1/business-config/location`);

          if (locationResponse.ok) {
            const locationData = await locationResponse.json();
            await fetchWeatherByCoords(
              locationData.latitude,
              locationData.longitude,
              locationData.city,
              locationData.timezone // Pass timezone from business location
            );
            return; // Success! No permission needed
          }
        } catch (locationError) {
          // Silently fall back to IP geolocation
        }

        // Step 2: Fallback to IP-based geolocation (no permission needed)
        await fetchWeatherByIP();

      } catch (error) {
        console.error('Weather fetch error:', error);
        setWeather(prev => ({
          ...prev,
          loading: false,
          error: 'Unable to fetch weather'
        }));
      }
    };

    const fetchWeatherByCoords = async (lat, lon, providedCity = null, providedTimezone = null) => {
      try {
        // Determine if it's nighttime based on business timezone
        const isNight = isNighttime(providedTimezone);

        // Try OpenWeatherMap first (if API key provided)
        const apiKey = process.env.REACT_APP_WEATHER_API_KEY;

        if (apiKey) {
          // Use OpenWeatherMap API (requires API key)
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
          );

          if (!response.ok) throw new Error('OpenWeatherMap API error');

          const data = await response.json();

          const weatherResult = {
            temperature: Math.round(data.main.temp),
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: getWeatherIcon(data.weather[0].main, isNight),
            city: providedCity || data.name,
            timezone: providedTimezone,
            loading: false,
            error: null
          };

          // Cache the weather data
          setCachedWeather(weatherResult);

          setWeather(weatherResult);
          return;
        }

        // Fallback to Open-Meteo (free, no API key required)
        // If city name already provided (from settings), use it. Otherwise, geocode.
        let cityName = providedCity;

        if (!cityName) {
          // Get location name using reverse geocoding (BigDataCloud - free, no key)
          const geocodeResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );

          if (!geocodeResponse.ok) throw new Error('Geocoding API error');

          const geocodeData = await geocodeResponse.json();

          // Extract city name with fallback priority
          cityName = geocodeData.city || geocodeData.locality || geocodeData.localityInfo?.administrative?.[3]?.name;

          // If still no city, try to extract from principalSubdivision or countryName
          if (!cityName || cityName.includes('Regional District') || cityName.includes('County')) {
            // Use the most specific administrative level available
          const adminLevels = geocodeData.localityInfo?.administrative || [];
          for (let i = adminLevels.length - 1; i >= 0; i--) {
            const level = adminLevels[i];
            if (level.name && !level.name.includes('Regional District') && !level.name.includes('County')) {
              cityName = level.name;
              break;
            }
          }
          }

          // Final fallback
          cityName = cityName || geocodeData.principalSubdivision || 'Your Location';
        }

        // Get weather data from Open-Meteo
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
        );

        if (!weatherResponse.ok) throw new Error('Weather API error');

        const weatherData = await weatherResponse.json();
        const temp = Math.round(weatherData.current.temperature_2m);
        const weatherCode = weatherData.current.weather_code;
        const weatherCondition = getWeatherConditionFromCode(weatherCode, isNight);

        const weatherResult = {
          temperature: temp,
          condition: weatherCondition.condition,
          description: weatherCondition.description,
          icon: weatherCondition.icon,
          city: cityName,
          timezone: providedTimezone,
          loading: false,
          error: null
        };

        // Cache the weather data
        setCachedWeather(weatherResult);

        setWeather(weatherResult);
      } catch (error) {
        console.error('Weather API error:', error);

        // Final fallback: Try to at least get location name
        try {
          const geocodeResponse = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );

          if (geocodeResponse.ok) {
            const geocodeData = await geocodeResponse.json();

            // Extract city name with fallback priority
            let cityName = geocodeData.city || geocodeData.locality || geocodeData.localityInfo?.administrative?.[3]?.name;

            // If still no city, try to extract from administrative levels
            if (!cityName || cityName.includes('Regional District') || cityName.includes('County')) {
              const adminLevels = geocodeData.localityInfo?.administrative || [];
              for (let i = adminLevels.length - 1; i >= 0; i--) {
                const level = adminLevels[i];
                if (level.name && !level.name.includes('Regional District') && !level.name.includes('County')) {
                  cityName = level.name;
                  break;
                }
              }
            }

            // Final fallback
            cityName = cityName || geocodeData.principalSubdivision || 'Your Location';

            setWeather({
              temperature: null,
              condition: 'Unknown',
              description: 'weather data unavailable',
              icon: '🌤️',
              city: cityName,
              timezone: providedTimezone,
              loading: false,
              error: 'Weather data temporarily unavailable'
            });
            return;
          }
        } catch (geoError) {
          console.error('Geocoding error:', geoError);
        }

        // Last resort fallback
        setWeather({
          temperature: null,
          condition: 'Unknown',
          description: 'weather data unavailable',
          icon: '🌤️',
          city: 'Your Location',
          timezone: providedTimezone,
          loading: false,
          error: 'Weather data temporarily unavailable'
        });
      }
    };

    const fetchWeatherByIP = async () => {
      try {
        // Fallback: Use IP geolocation service (ipapi.co free tier)
        const ipResponse = await fetch('https://ipapi.co/json/');

        if (!ipResponse.ok) throw new Error('IP geolocation service unavailable');

        const ipData = await ipResponse.json();

        if (ipData.latitude && ipData.longitude) {
          await fetchWeatherByCoords(ipData.latitude, ipData.longitude);
        } else {
          throw new Error('Invalid geolocation data from IP service');
        }
      } catch (error) {
        console.error('IP geolocation error:', error);

        // Final fallback with no location data
        setWeather({
          temperature: null,
          condition: 'Unknown',
          description: 'location unavailable',
          icon: '📍',
          city: 'Unknown Location',
          timezone: null,
          loading: false,
          error: 'Unable to determine your location'
        });
      }
    };

    fetchWeather();
  }, []);

  return weather;
};

/**
 * Check if it's nighttime based on business location timezone
 * Nighttime is defined as 6 PM (18:00) to 6 AM (06:00)
 * @param {string|null} timezone - IANA timezone string (e.g., 'America/Vancouver')
 * @returns {boolean} - True if nighttime, false if daytime
 */
const isNighttime = (timezone = null) => {
  try {
    const now = new Date();

    // Get the current hour in the business timezone
    const options = {
      hour: 'numeric',
      hour12: false,
      ...(timezone && { timeZone: timezone })
    };

    const hour = parseInt(now.toLocaleTimeString('en-US', options).split(':')[0], 10);

    // Nighttime is 6 PM (18:00) to 6 AM (06:00)
    return hour >= 18 || hour < 6;
  } catch (error) {
    console.error('Error determining day/night:', error);
    // Fallback to browser timezone
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  }
};

/**
 * Get weather icon emoji based on condition (OpenWeatherMap format)
 * @param {string} condition - Weather condition
 * @param {boolean} isNight - Whether it's nighttime
 */
const getWeatherIcon = (condition, isNight = false) => {
  // Night icons
  if (isNight) {
    const nightIcons = {
      Clear: '🌙',        // Clear night - crescent moon
      Clouds: '☁️',       // Cloudy (same for day/night)
      Rain: '🌧️',        // Rain (same for day/night)
      Drizzle: '🌧️',     // Drizzle (same for day/night)
      Thunderstorm: '⛈️', // Thunderstorm (same for day/night)
      Snow: '❄️',        // Snow (same for day/night)
      Mist: '🌫️',        // Mist (same for day/night)
      Fog: '🌫️',         // Fog (same for day/night)
      Haze: '🌫️'         // Haze (same for day/night)
    };
    return nightIcons[condition] || '🌙';
  }

  // Day icons
  const dayIcons = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌦️',
    Thunderstorm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️',
    Fog: '🌫️',
    Haze: '🌫️'
  };

  return dayIcons[condition] || '🌤️';
};

/**
 * Convert WMO weather code to condition (Open-Meteo format)
 * Reference: https://open-meteo.com/en/docs
 * @param {number} code - WMO weather code
 * @param {boolean} isNight - Whether it's nighttime
 */
const getWeatherConditionFromCode = (code, isNight = false) => {
  // Night weather codes
  if (isNight) {
    const nightWeatherCodes = {
      0: { condition: 'Clear', description: 'clear sky', icon: '🌙' },
      1: { condition: 'Clear', description: 'mainly clear', icon: '🌙' },
      2: { condition: 'Clouds', description: 'partly cloudy', icon: '☁️' },
      3: { condition: 'Clouds', description: 'overcast', icon: '☁️' },
      45: { condition: 'Fog', description: 'foggy', icon: '🌫️' },
      48: { condition: 'Fog', description: 'depositing rime fog', icon: '🌫️' },
      51: { condition: 'Drizzle', description: 'light drizzle', icon: '🌧️' },
      53: { condition: 'Drizzle', description: 'moderate drizzle', icon: '🌧️' },
      55: { condition: 'Drizzle', description: 'dense drizzle', icon: '🌧️' },
      56: { condition: 'Drizzle', description: 'light freezing drizzle', icon: '🌧️' },
      57: { condition: 'Drizzle', description: 'dense freezing drizzle', icon: '🌧️' },
      61: { condition: 'Rain', description: 'slight rain', icon: '🌧️' },
      63: { condition: 'Rain', description: 'moderate rain', icon: '🌧️' },
      65: { condition: 'Rain', description: 'heavy rain', icon: '🌧️' },
      66: { condition: 'Rain', description: 'light freezing rain', icon: '🌧️' },
      67: { condition: 'Rain', description: 'heavy freezing rain', icon: '🌧️' },
      71: { condition: 'Snow', description: 'slight snow', icon: '🌨️' },
      73: { condition: 'Snow', description: 'moderate snow', icon: '❄️' },
      75: { condition: 'Snow', description: 'heavy snow', icon: '❄️' },
      77: { condition: 'Snow', description: 'snow grains', icon: '🌨️' },
      80: { condition: 'Rain', description: 'slight rain showers', icon: '🌧️' },
      81: { condition: 'Rain', description: 'moderate rain showers', icon: '🌧️' },
      82: { condition: 'Rain', description: 'violent rain showers', icon: '⛈️' },
      85: { condition: 'Snow', description: 'slight snow showers', icon: '🌨️' },
      86: { condition: 'Snow', description: 'heavy snow showers', icon: '❄️' },
      95: { condition: 'Thunderstorm', description: 'thunderstorm', icon: '⛈️' },
      96: { condition: 'Thunderstorm', description: 'thunderstorm with slight hail', icon: '⛈️' },
      99: { condition: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '⛈️' }
    };
    return nightWeatherCodes[code] || { condition: 'Unknown', description: 'unknown', icon: '🌙' };
  }

  // Day weather codes (WMO Weather interpretation codes)
  const dayWeatherCodes = {
    0: { condition: 'Clear', description: 'clear sky', icon: '☀️' },
    1: { condition: 'Clear', description: 'mainly clear', icon: '🌤️' },
    2: { condition: 'Clouds', description: 'partly cloudy', icon: '⛅' },
    3: { condition: 'Clouds', description: 'overcast', icon: '☁️' },
    45: { condition: 'Fog', description: 'foggy', icon: '🌫️' },
    48: { condition: 'Fog', description: 'depositing rime fog', icon: '🌫️' },
    51: { condition: 'Drizzle', description: 'light drizzle', icon: '🌦️' },
    53: { condition: 'Drizzle', description: 'moderate drizzle', icon: '🌦️' },
    55: { condition: 'Drizzle', description: 'dense drizzle', icon: '🌧️' },
    56: { condition: 'Drizzle', description: 'light freezing drizzle', icon: '🌧️' },
    57: { condition: 'Drizzle', description: 'dense freezing drizzle', icon: '🌧️' },
    61: { condition: 'Rain', description: 'slight rain', icon: '🌧️' },
    63: { condition: 'Rain', description: 'moderate rain', icon: '🌧️' },
    65: { condition: 'Rain', description: 'heavy rain', icon: '🌧️' },
    66: { condition: 'Rain', description: 'light freezing rain', icon: '🌧️' },
    67: { condition: 'Rain', description: 'heavy freezing rain', icon: '🌧️' },
    71: { condition: 'Snow', description: 'slight snow', icon: '🌨️' },
    73: { condition: 'Snow', description: 'moderate snow', icon: '❄️' },
    75: { condition: 'Snow', description: 'heavy snow', icon: '❄️' },
    77: { condition: 'Snow', description: 'snow grains', icon: '🌨️' },
    80: { condition: 'Rain', description: 'slight rain showers', icon: '🌦️' },
    81: { condition: 'Rain', description: 'moderate rain showers', icon: '🌧️' },
    82: { condition: 'Rain', description: 'violent rain showers', icon: '⛈️' },
    85: { condition: 'Snow', description: 'slight snow showers', icon: '🌨️' },
    86: { condition: 'Snow', description: 'heavy snow showers', icon: '❄️' },
    95: { condition: 'Thunderstorm', description: 'thunderstorm', icon: '⛈️' },
    96: { condition: 'Thunderstorm', description: 'thunderstorm with slight hail', icon: '⛈️' },
    99: { condition: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '⛈️' }
  };

  return dayWeatherCodes[code] || { condition: 'Unknown', description: 'unknown', icon: '🌤️' };
};

/**
 * Get cached weather data from localStorage
 * Returns null if cache is expired or invalid
 */
const getCachedWeather = () => {
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (within 30 minutes)
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading weather cache:', error);
    return null;
  }
};

/**
 * Save weather data to localStorage with timestamp
 */
const setCachedWeather = (weatherData) => {
  try {
    const cacheObject = {
      data: weatherData,
      timestamp: Date.now()
    };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cacheObject));
  } catch (error) {
    console.error('Error caching weather data:', error);
  }
};
