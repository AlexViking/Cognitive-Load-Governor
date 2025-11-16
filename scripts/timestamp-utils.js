// Timestamp Utilities
// Unified timestamp parsing for all date formats

/**
 * Parse timestamp from various formats into Unix milliseconds
 * Handles:
 * 1. Unix timestamp (milliseconds)
 * 2. Google Sheets Date format: Date(2025,10,12,23,16,15)
 * 3. ISO string format
 *
 * @param {string|number} timestampStr - The timestamp to parse
 * @returns {number} - Unix timestamp in milliseconds, or NaN if invalid
 */
function parseTimestamp(timestampStr) {
	// Handle null/undefined
	if (!timestampStr) {
		return NaN;
	}

	// Case 1: Already a number (Unix timestamp)
	if (typeof timestampStr === 'number') {
		return timestampStr;
	}

	// Case 2: String that's just a number (Unix timestamp as string)
	if (!isNaN(timestampStr)) {
		return parseInt(timestampStr, 10);
	}

	// Case 3: Google Sheets Date format: Date(2025,10,12,23,16,15)
	// IMPORTANT: Month is 0-indexed in this format (10 = November)
	if (typeof timestampStr === 'string' && timestampStr.startsWith('Date(')) {
		const match = timestampStr.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
		if (match) {
			const year = parseInt(match[1], 10);
			const month = parseInt(match[2], 10);  // 0-indexed: 0=Jan, 11=Dec
			const day = parseInt(match[3], 10);
			const hour = parseInt(match[4], 10);
			const minute = parseInt(match[5], 10);
			const second = parseInt(match[6], 10);

			return new Date(year, month, day, hour, minute, second).getTime();
		}
	}

	// Case 4: Standard date string (ISO, etc.)
	const timestamp = new Date(timestampStr).getTime();

	// Validate result
	if (isNaN(timestamp)) {
		console.warn('⚠️  Failed to parse timestamp:', timestampStr);
		return NaN;
	}

	return timestamp;
}

/**
 * Format timestamp to human-readable "time ago" string
 * @param {string|number} timestampStr - The timestamp to format
 * @returns {string} - Formatted string like "2m ago", "Just now", etc.
 */
function formatTimeAgo(timestampStr) {
	const timestamp = parseTimestamp(timestampStr);

	if (isNaN(timestamp)) {
		return 'Unknown';
	}

	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSeconds = Math.floor(diffMs / 1000);

	if (diffSeconds < 10) {
		return 'Just now';
	} else if (diffSeconds < 60) {
		return `${diffSeconds}s ago`;
	} else if (diffSeconds < 3600) {
		const minutes = Math.floor(diffSeconds / 60);
		return `${minutes}m ago`;
	} else if (diffSeconds < 86400) {
		const hours = Math.floor(diffSeconds / 3600);
		return `${hours}h ago`;
	} else {
		const days = Math.floor(diffSeconds / 86400);
		return `${days}d ago`;
	}
}

// Export functions if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		parseTimestamp,
		formatTimeAgo
	};
}
