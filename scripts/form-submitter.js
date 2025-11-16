// Google Forms Submission Utility
// Handles form submission via hidden iframe (CORS workaround)
// with proper lifecycle management and error handling

class FormSubmitter {
	constructor(formUrl, fieldMapping, options = {}) {
		this.formUrl = formUrl;
		this.fieldMapping = fieldMapping;
		this.iframe = null;
		this.submissionQueue = [];
		this.isSubmitting = false;
		this.submitCount = 0;
		this.failCount = 0;

		// Rate limiting configuration
		this.rateLimitWindow = options.rateLimitWindow || 60000; // 1 minute window
		this.maxSubmissionsPerWindow = options.maxSubmissionsPerWindow || 10; // Max 10 submissions per minute
		this.submissionTimestamps = []; // Track when submissions occurred

		// Create reusable iframe on initialization
		this.createIframe();
	}

	/**
	 * Check if rate limit has been exceeded
	 * @returns {boolean} - True if rate limit exceeded
	 */
	isRateLimitExceeded() {
		const now = Date.now();

		// Remove timestamps outside the current window
		this.submissionTimestamps = this.submissionTimestamps.filter(
			timestamp => now - timestamp < this.rateLimitWindow
		);

		// Check if we've exceeded the limit
		if (this.submissionTimestamps.length >= this.maxSubmissionsPerWindow) {
			const oldestTimestamp = this.submissionTimestamps[0];
			const timeUntilReset = this.rateLimitWindow - (now - oldestTimestamp);
			console.warn(`⚠️ Rate limit exceeded. ${this.submissionTimestamps.length} submissions in ${this.rateLimitWindow / 1000}s window. Try again in ${Math.ceil(timeUntilReset / 1000)}s`);
			return true;
		}

		return false;
	}

	/**
	 * Record a submission timestamp
	 */
	recordSubmission() {
		this.submissionTimestamps.push(Date.now());
	}

	/**
	 * Create a single reusable iframe
	 * This iframe persists for the entire session
	 */
	createIframe() {
		if (this.iframe && document.body.contains(this.iframe)) {
			return; // Already exists
		}

		this.iframe = document.createElement('iframe');
		this.iframe.name = 'digiedu_form_iframe';
		this.iframe.id = 'digiedu_form_iframe';
		this.iframe.style.display = 'none';
		this.iframe.style.position = 'absolute';
		this.iframe.style.width = '0';
		this.iframe.style.height = '0';
		this.iframe.style.border = 'none';

		// Add to DOM
		document.body.appendChild(this.iframe);

		console.log('✅ Form submission iframe created');
	}

	/**
	 * Submit data to Google Form
	 * @param {Object} data - Key-value pairs to submit
	 * @param {Object} options - Submission options
	 * @returns {Promise} - Resolves when submission completes
	 */
	async submit(data, options = {}) {
		const {
			timeout = 10000, // 10 second timeout
			retries = 1,     // Retry once on failure
			onSuccess = null,
			onError = null
		} = options;

		return new Promise((resolve, reject) => {
			// Check rate limit first
			if (this.isRateLimitExceeded()) {
				const error = new Error('Rate limit exceeded. Too many submissions in a short time.');
				if (onError) {
					onError(error);
				}
				reject(error);
				return;
			}

			// Queue submission if already submitting
			if (this.isSubmitting) {
				this.submissionQueue.push({ data, options, resolve, reject });
				console.log('📋 Submission queued. Queue length:', this.submissionQueue.length);
				return;
			}

			this.isSubmitting = true;
			this.recordSubmission(); // Track this submission for rate limiting

			try {
				// Ensure iframe exists
				if (!this.iframe || !document.body.contains(this.iframe)) {
					this.createIframe();
				}

				// Create form
				const form = this.createForm(data);

				// Set up timeout
				const timeoutId = setTimeout(() => {
					this.handleTimeout(form, data, retries, resolve, reject);
				}, timeout);

				// Set up success detection (iframe load event)
				const loadHandler = () => {
					clearTimeout(timeoutId);
					this.handleSuccess(form, resolve, onSuccess);
				};

				this.iframe.addEventListener('load', loadHandler, { once: true });

				// Submit form
				document.body.appendChild(form);
				form.submit();

				console.log('📤 Form submitted:', {
					submitCount: ++this.submitCount,
					dataKeys: Object.keys(data)
				});

				// Clean up form immediately after submission
				setTimeout(() => {
					if (document.body.contains(form)) {
						document.body.removeChild(form);
					}
				}, 100);

			} catch (error) {
				this.handleError(error, reject, onError);
			}
		});
	}

	/**
	 * Create form element with data
	 */
	createForm(data) {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = this.formUrl;
		form.target = this.iframe.name;
		form.style.display = 'none';

		// Add form fields based on mapping
		Object.keys(data).forEach(key => {
			if (this.fieldMapping[key]) {
				const input = document.createElement('input');
				input.type = 'hidden';
				input.name = this.fieldMapping[key];
				input.value = data[key] !== null && data[key] !== undefined ? data[key] : '';
				form.appendChild(input);
			}
		});

		return form;
	}

	/**
	 * Handle successful submission
	 */
	handleSuccess(form, resolve, onSuccess) {
		this.isSubmitting = false;

		console.log('✅ Form submission successful');

		if (onSuccess) {
			onSuccess();
		}

		resolve({ success: true });

		// Process next queued submission
		this.processQueue();
	}

	/**
	 * Handle submission timeout
	 */
	handleTimeout(form, data, retriesLeft, resolve, reject) {
		console.warn('⏱️ Form submission timeout');

		// Clean up form
		if (document.body.contains(form)) {
			document.body.removeChild(form);
		}

		// Retry if retries remaining
		if (retriesLeft > 0) {
			console.log(`🔄 Retrying submission (${retriesLeft} retries left)...`);
			this.isSubmitting = false;
			this.submit(data, { retries: retriesLeft - 1 })
				.then(resolve)
				.catch(reject);
		} else {
			this.handleError(new Error('Submission timeout'), reject);
		}
	}

	/**
	 * Handle submission error
	 */
	handleError(error, reject, onError) {
		this.isSubmitting = false;
		this.failCount++;

		console.error('❌ Form submission failed:', error);

		if (onError) {
			onError(error);
		}

		reject(error);

		// Process next queued submission
		this.processQueue();
	}

	/**
	 * Process next submission in queue
	 */
	processQueue() {
		if (this.submissionQueue.length > 0) {
			const next = this.submissionQueue.shift();
			console.log('📋 Processing queued submission. Remaining:', this.submissionQueue.length);
			this.submit(next.data, next.options)
				.then(next.resolve)
				.catch(next.reject);
		}
	}

	/**
	 * Get submission statistics
	 */
	getStats() {
		return {
			submitted: this.submitCount,
			failed: this.failCount,
			queued: this.submissionQueue.length,
			successRate: this.submitCount > 0
				? Math.round((this.submitCount / (this.submitCount + this.failCount)) * 100)
				: 0
		};
	}

	/**
	 * Clean up (call when page unloads)
	 */
	destroy() {
		if (this.iframe && document.body.contains(this.iframe)) {
			document.body.removeChild(this.iframe);
			console.log('🗑️ Form submission iframe destroyed');
		}
		this.submissionQueue = [];
		this.iframe = null;
	}
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
	module.exports = FormSubmitter;
}
