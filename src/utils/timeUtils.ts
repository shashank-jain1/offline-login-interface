
/**
 * Format date to Indian Standard Time
 */
export function formatIST(date: Date, format: string = 'YYYY-MM-DD'): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
  
    const formatter = new Intl.DateTimeFormat('en-IN', options);
    const parts = formatter.formatToParts(date);
  
    const values: { [key: string]: string } = {};
    parts.forEach(({ type, value }) => {
      values[type] = value;
    });
  
    if (format === 'YYYY-MM-DD') {
      return `${values.year}-${values.month}-${values.day}`;
    } else if (format === 'HH:mm:ss') {
      return `${values.hour}:${values.minute}:${values.second}`;
    } else if (format === 'YYYY-MM-DD HH:mm:ss') {
      return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
    }
  
    return date.toISOString();
  }
  
  /**
   * Get today's date in IST
   */
  export function getTodayDateIST(): string {
    return formatIST(new Date(), 'YYYY-MM-DD');
  }
  
  /**
   * Get current time in IST
   */
  export function getCurrentTimeIST(): string {
    return formatIST(new Date(), 'HH:mm:ss');
  }
  
  /**
   * Calculate working hours between two times
   */
  export function calculateWorkingHours(timeIn: string, timeOut: string): string {
    const [inHours, inMinutes, inSeconds] = timeIn.split(':').map(Number);
    const [outHours, outMinutes, outSeconds] = timeOut.split(':').map(Number);
  
    const inTotalSeconds = inHours * 3600 + inMinutes * 60 + inSeconds;
    const outTotalSeconds = outHours * 3600 + outMinutes * 60 + outSeconds;
  
    let diffSeconds = outTotalSeconds - inTotalSeconds;
  
    // Handle overnight (shouldn't happen in normal attendance)
    if (diffSeconds < 0) {
      diffSeconds += 24 * 3600;
    }
  
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
  
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  /**
   * Convert time string to seconds
   */
  export function timeToSeconds(time: string): number {
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + (seconds || 0);
  }
  
  /**
   * Convert seconds to time string
   */
  export function secondsToTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
  
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  /**
   * Get greeting based on time
   */
  export function getGreeting(): { icon: string; text: string } {
    const hour = new Date().getHours();
  
    if (hour < 12) {
      return { icon: '☀️', text: 'Good Morning' };
    } else if (hour < 17) {
      return { icon: '🌤️', text: 'Good Afternoon' };
    } else {
      return { icon: '🌙', text: 'Good Evening' };
    }
  }
  
  /**
   * Format date for display
   */
  export function formatDateForDisplay(date: string): string {
    const dateObj = new Date(date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return dateObj.toLocaleDateString('en-IN', options);
  }
  
  /**
   * Get relative time (e.g., "2 hours ago")
   */
  export function getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
  
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
    return formatDateForDisplay(dateString);
  }