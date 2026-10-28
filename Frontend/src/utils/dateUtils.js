/**
 * Frontend/src/utils/dateUtils.js
 * 
 * Utility functions for date formatting throughout the frontend
 */

/**
 * Format a date string or Date object into readable format
 * Input: ISO string or Date object
 * Output: "DD MMM YYYY" (e.g., "15 Sep 2024")
 */
export const formatDate = (dateValue) => {
  if (!dateValue) return 'N/A';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'N/A';
  }
};

/**
 * Format date and time
 * Output: "DD MMM YYYY HH:MM" (e.g., "15 Sep 2024 14:30")
 */
export const formatDateTime = (dateValue) => {
  if (!dateValue) return 'N/A';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', dateOptions);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    return `${dateStr} ${timeStr}`;
  } catch (error) {
    console.error('Error formatting date-time:', error);
    return 'N/A';
  }
};

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (dateValue) => {
  if (!dateValue) return 'N/A';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid Date';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // Fall back to formatted date for older items
    return formatDate(dateValue);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'N/A';
  }
};

/**
 * Calculate days until expiry
 * Output: number of days (positive = future, negative = past)
 */
export const daysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;

  try {
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  } catch (error) {
    console.error('Error calculating days until expiry:', error);
    return null;
  }
};

/**
 * Get status based on expiry date
 * Output: "Active" | "Expiring Soon" | "Expired"
 */
export const getAccessStatus = (expiryDate) => {
  const days = daysUntilExpiry(expiryDate);

  if (days === null) return 'Unknown';
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Active';
};

/**
 * Format date range
 * Output: "15 Sep 2024 - 15 Sep 2025"
 */
export const formatDateRange = (startDate, endDate) => {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};