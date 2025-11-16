/**
 * Debounce Utility
 * Limits how often a function can be called
 * Useful for performance optimization of high-frequency events (mouse, scroll, resize, etc.)
 */


/**
 * Throttle function - ensures function is called at most once per specified interval
 * Unlike debounce, throttle will call the function periodically during ongoing events
 *
 * @param {Function} func - Function to throttle
 * @param {number} interval - Minimum interval between calls in milliseconds
 * @returns {Function} - Throttled function
 *
 * @example
 * // Call at most once every 100ms, even if event fires 60x/second:
 * document.addEventListener('mousemove', throttle(trackMouse, 100));
 */
function throttle(func, interval) {
	let lastCall = 0;
	let timeoutId = null;

	return function throttled(...args) {
		const now = Date.now();
		const timeSinceLastCall = now - lastCall;

		// If enough time has passed, call immediately
		if (timeSinceLastCall >= interval) {
			lastCall = now;
			func.apply(this, args);
		} else {
			// Otherwise, schedule a call at the end of the interval
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => {
				lastCall = Date.now();
				func.apply(this, args);
				timeoutId = null;
			}, interval - timeSinceLastCall);
		}
	};
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { throttle };
}
