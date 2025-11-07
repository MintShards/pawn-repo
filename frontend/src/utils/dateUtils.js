/**
 * Format current date in a human-readable format
 * Example: "Friday, November 7, 2025"
 * @param {string|null} timezone - IANA timezone string (e.g., 'America/Vancouver')
 */
export const formatCurrentDate = (timezone = null) => {
  const now = new Date();

  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timezone && { timeZone: timezone })
  };

  return now.toLocaleDateString('en-US', options);
};
