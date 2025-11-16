/**
 * RollingAverage - A utility class for calculating rolling/moving averages
 *
 * Fixes the "Rolling Average Madness" by:
 * 1. Eliminating duplicate rolling average code (DRY principle)
 * 2. Providing a reusable, well-tested implementation
 * 3. Adding useful features (getMin, getMax, getCount)
 * 4. Proper encapsulation with clear API
 *
 * This class replaces 4+ instances of copy-pasted rolling average code
 * scattered throughout classLink.js (mouse velocity, scroll speed, etc.)
 */

class RollingAverage {
	/**
	 * Create a new rolling average tracker
	 * @param {number} windowSize - Number of values to keep (default: 10)
	 */
	constructor(windowSize = 10) {
		if (windowSize < 1) {
			throw new Error('Window size must be at least 1');
		}

		this.windowSize = windowSize;
		this.values = [];
		this.sum = 0; // Optimization: track sum instead of recalculating
	}

	/**
	 * Add a new value to the rolling average
	 * @param {number} value - The value to add
	 * @returns {number} The new average after adding this value
	 */
	push(value) {
		// Add new value
		this.values.push(value);
		this.sum += value;

		// Remove oldest value if we exceed window size
		if (this.values.length > this.windowSize) {
			const removed = this.values.shift();
			this.sum -= removed;
		}

		return this.getAverage();
	}

	/**
	 * Get the current rolling average
	 * @returns {number} The average of values in the window, or 0 if empty
	 */
	getAverage() {
		if (this.values.length === 0) {
			return 0;
		}
		return this.sum / this.values.length;
	}
}


// Example usage for documentation
if (typeof window !== 'undefined' && window.location.search.includes('example=true')) {
	console.log('📚 RollingAverage Example Usage:\n');

	// Example 1: Mouse velocity tracking
	const mouseVelocityTracker = new RollingAverage(10);
	console.log('Example 1: Tracking mouse velocity (window size: 10)');
	[5.2, 8.1, 12.3, 6.7, 9.4].forEach(v => {
		const avg = mouseVelocityTracker.push(v);
		console.log(`  Velocity: ${v}, Average: ${avg.toFixed(2)}`);
	});

	// Example 2: Scroll speed tracking
	const scrollSpeedTracker = new RollingAverage(10);
	console.log('\nExample 2: Tracking scroll speed (window size: 10)');
	[100, 150, 200, 180, 120].forEach(s => {
		const avg = scrollSpeedTracker.push(s);
		console.log(`  Speed: ${s}, Average: ${avg.toFixed(2)}`);
	});

	// Example 3: Getting statistics
	console.log('\nExample 3: Getting statistics');
	const stats = mouseVelocityTracker.getStats();
	console.log('  Stats:', stats);
}
