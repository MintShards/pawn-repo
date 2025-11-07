import React from 'react';
import { useWeather } from '../../context/WeatherContext';
import { formatCurrentDate } from '../../utils/dateUtils';

/**
 * Reusable page header component with title, subtitle, date, and weather
 * Used consistently across Dashboard, Transaction, Customer, and User pages
 * Uses WeatherContext for shared weather data from business location
 */
const PageHeader = ({ title, subtitle }) => {
  const weather = useWeather();

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {/* Date Display */}
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {formatCurrentDate(weather.timezone)}
            </p>
          </div>

          {/* Weather Display */}
          {weather.loading ? (
            <div className="flex items-center gap-2.5 animate-pulse">
              <div className="w-7 h-7 bg-slate-300 dark:bg-slate-600 rounded"></div>
              <div className="h-5 w-24 bg-slate-300 dark:bg-slate-600 rounded"></div>
            </div>
          ) : weather.temperature !== null || weather.city !== null ? (
            <div
              className="flex items-center gap-2.5 cursor-help group"
              title={weather.description ? `${weather.description.charAt(0).toUpperCase() + weather.description.slice(1)}${weather.city ? ` in ${weather.city}` : ''}` : weather.city ? `Weather in ${weather.city}` : 'Weather information'}
            >
              <span
                className="text-3xl leading-none transition-transform group-hover:scale-110"
                role="img"
                aria-label={`Weather condition: ${weather.condition || 'Unknown'}`}
              >
                {weather.icon || '🌤️'}
              </span>
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                {weather.temperature !== null && `${weather.temperature}°C`}
                {weather.temperature !== null && weather.city && ' • '}
                {weather.city && (
                  <span className="font-semibold">
                    {weather.city}
                  </span>
                )}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
