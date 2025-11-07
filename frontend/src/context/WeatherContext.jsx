import React, { createContext, useContext } from 'react';
import { useWeather as useWeatherHook } from '../hooks/useWeather';

/**
 * Weather Context
 * Provides global weather data shared across all pages
 * Uses business location from LocationConfig API or IP geolocation fallback
 * No browser permissions required - fetches once on app mount
 */
const WeatherContext = createContext(null);

export const WeatherProvider = ({ children }) => {
  const weather = useWeatherHook();

  return (
    <WeatherContext.Provider value={weather}>
      {children}
    </WeatherContext.Provider>
  );
};

/**
 * Hook to access weather data from context
 * Uses shared weather data instead of creating new geolocation requests
 */
export const useWeather = () => {
  const context = useContext(WeatherContext);

  if (context === null) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }

  return context;
};
