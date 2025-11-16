// Student Interface Script - Activity Tracking and Form Submission
// This script tracks student behavior and submits data to Google Forms

// Global variables
let sessionId = '';
let studentId = '';
let classTitle = '';
let subjectName = '';

// Activity tracking counters
let keystrokeCount = 0;
let tabSwitches = 0;
let mouseVelocity = 0;
let copyPasteEvents = 0;
let scrollSpeed = 0;

// Student action tracking
let raiseHandActive = false;
let pendingQuestion = '';
let needBreakActive = false;

// Mouse tracking variables
let lastMousePos = { x: 0, y: 0 };
let lastMouseTime = Date.now();
let mouseVelocityTracker = new RollingAverage(10); // Track last 10 velocity readings

// Scroll tracking variables
let lastScrollPos = 0;
let lastScrollTime = Date.now();
let scrollSpeedTracker = new RollingAverage(10); // Track last 10 scroll speed readings

// Submission tracking
let submissionInterval = null;
let isTestMode = false;

// Form submitter instance
let formSubmitter = null;

// Tab monitor instance
let tabMonitor = null;

// Event listener references (for cleanup)
let eventListeners = {
	// Button handlers
	raiseHandBtn: null,
	askQuestionBtn: null,
	needBreakBtn: null,

	// Activity tracking handlers
	keydown: null,
	visibilitychange: null,
	mousemove: null,
	copy: null,
	paste: null,
	scroll: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
	console.log('🎓 DigiEdu Student Interface Loaded');

	// Initialize session
	initializeSession();

	// Initialize tab monitor to detect duplicates
	tabMonitor = new TabMonitor(studentId, {
		onDuplicateDetected: handleDuplicateTab
	});

	// Initialize form submitter with rate limiting
	formSubmitter = new FormSubmitter(CONFIG.FORM_URL, CONFIG.FORM_FIELDS, {
		maxSubmissionsPerWindow: 10,  // Max 10 submissions per minute
		rateLimitWindow: 60000         // 1 minute window
	});

	// Set up event listeners
	setupEventListeners();

	// Start activity tracking
	startActivityTracking();

	// Start periodic submissions
	startPeriodicSubmission();

	// Update UI
	updateConnectionStatus('connected');
});

// Initialize session from URL parameters
function initializeSession() {
	const urlParams = new URLSearchParams(window.location.search);

	sessionId = urlParams.get('session') || generateRandomId('session');
	classTitle = urlParams.get('title') || CONFIG.CLASS_DEFAULTS.title;
	subjectName = urlParams.get('subject') || CONFIG.CLASS_DEFAULTS.subject;
	const totalStudents = urlParams.get('totalStudents') || CONFIG.CLASS_DEFAULTS.totalStudents;

	// Generate or retrieve student ID (store in sessionStorage to persist across refreshes)
	// Namespaced with 'student_' prefix to avoid conflicts with dashboard
	if (sessionStorage.getItem('student_studentId')) {
		studentId = sessionStorage.getItem('student_studentId');
	} else {
		studentId = generateRandomId('student');
		sessionStorage.setItem('student_studentId', studentId);
	}

	// Store session info (namespaced to avoid conflicts)
	sessionStorage.setItem('student_sessionId', sessionId);
	sessionStorage.setItem('student_classTitle', classTitle);
	sessionStorage.setItem('student_subjectName', subjectName);

	// Update UI
	document.getElementById('classTitle').textContent = classTitle;
	document.getElementById('subjectName').textContent = 'Subject: ' + subjectName;

	console.log('✅ Session initialized:', { sessionId, studentId, classTitle, subjectName, totalStudents });
}

// Generate random ID using crypto.randomUUID for better anonymity
// No timestamp included to prevent correlation-based identification
function generateRandomId(prefix) {
	// Use crypto.randomUUID if available (modern browsers)
	if (crypto && crypto.randomUUID) {
		return `${prefix}_${crypto.randomUUID()}`;
	}

	// Fallback for older browsers: use crypto.getRandomValues
	if (crypto && crypto.getRandomValues) {
		const array = new Uint8Array(16);
		crypto.getRandomValues(array);
		const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
		return `${prefix}_${hex}`;
	}

	// Final fallback (should rarely happen): multiple random values
	// Still avoid timestamp to prevent timing correlation
	const random1 = Math.random().toString(36).substring(2, 15);
	const random2 = Math.random().toString(36).substring(2, 15);
	const random3 = Math.random().toString(36).substring(2, 15);
	return `${prefix}_${random1}${random2}${random3}`;
}

// Set up all event listeners
function setupEventListeners() {
	// Store button handler references
	eventListeners.raiseHandBtn = handleRaiseHand;
	eventListeners.askQuestionBtn = handleAskQuestion;
	eventListeners.needBreakBtn = handleNeedBreak;

	// Button actions
	document.getElementById('raiseHandBtn').addEventListener('click', eventListeners.raiseHandBtn);
	document.getElementById('askQuestionBtn').addEventListener('click', eventListeners.askQuestionBtn);
	document.getElementById('needBreakBtn').addEventListener('click', eventListeners.needBreakBtn);

	// Store activity tracking handler references
	eventListeners.keydown = trackKeystrokes;
	eventListeners.visibilitychange = trackTabSwitches;
	eventListeners.copy = trackCopyPaste;
	eventListeners.paste = trackCopyPaste;

	// Activity tracking listeners
	document.addEventListener('keydown', eventListeners.keydown);
	document.addEventListener('visibilitychange', eventListeners.visibilitychange);
	document.addEventListener('copy', eventListeners.copy);
	document.addEventListener('paste', eventListeners.paste);

	// Store throttled function references (must store to remove later)
	// Mouse moves ~60 times/second - throttle to once per 100ms (10x/second)
	eventListeners.mousemove = throttle(trackMouseVelocity, 100);
	document.addEventListener('mousemove', eventListeners.mousemove);

	// Scroll events can fire 60+ times/second - throttle to once per 100ms
	eventListeners.scroll = throttle(trackScrollSpeed, 100);
	document.addEventListener('scroll', eventListeners.scroll);

	console.log('✅ Event listeners set up (with throttling for performance)');
}

// Start activity tracking
function startActivityTracking() {
	console.log('📊 Activity tracking started');
}

// Track keystrokes
function trackKeystrokes(event) {
	keystrokeCount++;
}

// Track tab switches
function trackTabSwitches() {
	if (document.hidden) {
		tabSwitches++;
		console.log('👁️ Tab switch detected. Total:', tabSwitches);
	}
}

// Track mouse velocity
function trackMouseVelocity(event) {
	const now = Date.now();
	const dt = (now - lastMouseTime) / 1000; // Convert to seconds

	if (dt > 0) {
		const dx = event.clientX - lastMousePos.x;
		const dy = event.clientY - lastMousePos.y;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const velocity = distance / dt;

		// Update rolling average (automatically maintains window of 10)
		mouseVelocity = mouseVelocityTracker.push(velocity);

		lastMousePos = { x: event.clientX, y: event.clientY };
		lastMouseTime = now;
	}
}

// Track copy/paste events
function trackCopyPaste(event) {
	copyPasteEvents++;
	console.log('📋 Copy/Paste detected. Total:', copyPasteEvents);
}

// Track scroll speed
function trackScrollSpeed() {
	const now = Date.now();
	const dt = (now - lastScrollTime) / 1000; // Convert to seconds

	if (dt > 0) {
		const currentScrollPos = window.scrollY;
		const ds = Math.abs(currentScrollPos - lastScrollPos);
		const speed = ds / dt;

		// Update rolling average (automatically maintains window of 10)
		scrollSpeed = scrollSpeedTracker.push(speed);

		lastScrollPos = currentScrollPos;
		lastScrollTime = now;
	}
}

// Start periodic data submission with jitter to prevent thundering herd
function startPeriodicSubmission() {
	// Guard against multiple intervals (zombie interval prevention)
	if (submissionInterval) {
		console.warn('⚠️ Submission interval already running, clearing old one');
		clearInterval(submissionInterval);
		submissionInterval = null;
	}

	// Add random jitter (±10% of interval) to prevent all students submitting at once
	const jitter = () => {
		const baseInterval = CONFIG.SETTINGS.UPDATE_INTERVAL;
		const jitterRange = baseInterval * 0.1; // 10% jitter (±3 seconds for 30s interval)
		return baseInterval + (Math.random() * jitterRange * 2 - jitterRange);
	};

	// Submit after initial delay with jitter (prevents everyone submitting at page load)
	const initialDelay = 2000 + Math.random() * 3000; // 2-5 seconds random delay
	setTimeout(() => {
		submitDataToGoogleForm();
	}, initialDelay);

	// Then submit every ~30 seconds with jitter
	const scheduleNextSubmission = () => {
		submissionInterval = setTimeout(() => {
			submitDataToGoogleForm();
			scheduleNextSubmission(); // Schedule next submission with new jitter
		}, jitter());
	};

	scheduleNextSubmission();

	console.log('✅ Periodic submission started (~30s with jitter to prevent thundering herd)');
}

// Submit data to Google Form using FormSubmitter
async function submitDataToGoogleForm() {
	// NOTE: timestamp is NOT included - Google Forms adds it automatically
	const data = {
		sessionId: sessionId,
		studentId: studentId,
		keystrokeCount: keystrokeCount,
		tabSwitches: tabSwitches,
		mouseVelocity: Math.round(mouseVelocity * 100) / 100, // Round to 2 decimals
		copyPasteEvents: copyPasteEvents,
		scrollSpeed: Math.round(scrollSpeed * 100) / 100, // Round to 2 decimals
		raiseHand: raiseHandActive ? 'Yes' : 'No',
		question: pendingQuestion || '',
		needBreak: needBreakActive ? 'Yes' : 'No'
	};

	console.log('📤 Submitting data:', data);

	try {
		// Submit using FormSubmitter (with automatic retry)
		await formSubmitter.submit(data, {
			timeout: 10000,
			retries: 1,
			onSuccess: () => {
				console.log('✅ Data submitted successfully');
				updateConnectionStatus('connected');
			},
			onError: (error) => {
				console.error('❌ Submission failed:', error);
				updateConnectionStatus('disconnected');
				showToast('Data submission failed - will retry', 'error');
			}
		});

		// Reset counters after successful submission
		// (All counters reset to ensure consistent data collection each interval)
		keystrokeCount = 0;
		// Note: tabSwitches and copyPasteEvents accumulate over session
		// mouseVelocity and scrollSpeed are rolling averages (managed by RollingAverage class)

	} catch (error) {
		console.error('❌ Submission error:', error);
		updateConnectionStatus('disconnected');
		showToast('Connection issue - will retry automatically', 'error');
		// Don't reset counters on failure - will retry next interval
	}
}

// Handle Raise Hand button
function handleRaiseHand() {
	console.log('✋ Raise hand clicked');

	// Toggle raise hand status
	raiseHandActive = !raiseHandActive;

	const btn = document.getElementById('raiseHandBtn');

	if (raiseHandActive) {
		btn.classList.add('btn-active');
		showToast('Hand raised! Teacher will be notified.');
	} else {
		btn.classList.remove('btn-active');
		showToast('Hand lowered.');
	}

	// Immediately submit to inform teacher
	submitDataToGoogleForm();
}

// Handle Ask Question button
function handleAskQuestion() {
	const question = document.getElementById('questionText').value.trim();

	if (!question) {
		showToast('Please type your question first.', 'error');
		return;
	}

	console.log('💬 Question submitted:', question);

	// Store the question for submission
	pendingQuestion = question;

	// Clear textarea
	document.getElementById('questionText').value = '';

	showToast('Question sent to teacher!');

	// Immediately submit to inform teacher
	submitDataToGoogleForm();

	// Clear pending question after submission
	setTimeout(() => {
		pendingQuestion = '';
	}, 1000);
}

// Handle Need Break button
function handleNeedBreak() {
	console.log('🚻 Break requested');

	// Toggle need break status
	needBreakActive = !needBreakActive;

	const btn = document.getElementById('needBreakBtn');

	if (needBreakActive) {
		btn.classList.add('btn-active');
		showToast('Break request sent to teacher.');
	} else {
		btn.classList.remove('btn-active');
		showToast('Break request canceled.');
	}

	// Immediately submit to inform teacher
	submitDataToGoogleForm();
}

// Show toast notification
function showToast(message, type = 'success') {
	const toast = document.getElementById('toast');
	const toastMessage = document.getElementById('toastMessage');

	toastMessage.textContent = message;
	toast.className = 'toast toast-' + type + ' toast-show';

	setTimeout(() => {
		toast.className = 'toast';
	}, 3000);
}

// Handle duplicate tab detection
function handleDuplicateTab(info) {
	console.warn('⚠️ Duplicate tab detected:', info);

	// Show warning to user
	showToast('⚠️ Multiple tabs detected! Only one tab per student is allowed. This tab has been disabled.', 'error');

	// Stop all activity tracking and submissions
	if (submissionInterval) {
		clearTimeout(submissionInterval); // Changed from clearInterval since we now use setTimeout
		submissionInterval = null;
	}

	// Update status
	updateConnectionStatus('disconnected');

	// Disable all action buttons
	document.getElementById('raiseHandBtn').disabled = true;
	document.getElementById('askQuestionBtn').disabled = true;
	document.getElementById('needBreakBtn').disabled = true;
	document.getElementById('questionText').disabled = true;

	// Show a permanent warning message
	const topBar = document.querySelector('.top-bar');
	const warningBanner = document.createElement('div');
	warningBanner.style.cssText = 'background: #f44336; color: white; padding: 10px; margin-top: 10px; border-radius: 4px; font-weight: bold; text-align: center;';
	warningBanner.textContent = '⚠️ DUPLICATE TAB DETECTED - This tab has been disabled. Please close extra tabs.';
	if (topBar) {
		topBar.appendChild(warningBanner);
	}
}

// Update connection status
function updateConnectionStatus(status) {
	const statusIndicator = document.querySelector('.status-indicator');
	const statusText = document.getElementById('statusText');

	if (!statusIndicator || !statusText) {
		console.warn('Status elements not found');
		return;
	}

	// Update status indicator color
	switch (status) {
		case 'connected':
			statusIndicator.style.background = '#10b981'; // green
			statusText.textContent = 'Connected to Lecture';
			break;
		case 'disconnected':
			statusIndicator.style.background = '#ef4444'; // red
			statusText.textContent = 'Disconnected - Retrying...';
			break;
		case 'connecting':
			statusIndicator.style.background = '#f59e0b'; // orange
			statusText.textContent = 'Connecting...';
			break;
		default:
			statusText.textContent = status;
	}
}

// Remove all event listeners to prevent memory leaks
function cleanupEventListeners() {
	// Remove button event listeners
	const raiseHandBtn = document.getElementById('raiseHandBtn');
	const askQuestionBtn = document.getElementById('askQuestionBtn');
	const needBreakBtn = document.getElementById('needBreakBtn');

	if (raiseHandBtn && eventListeners.raiseHandBtn) {
		raiseHandBtn.removeEventListener('click', eventListeners.raiseHandBtn);
	}
	if (askQuestionBtn && eventListeners.askQuestionBtn) {
		askQuestionBtn.removeEventListener('click', eventListeners.askQuestionBtn);
	}
	if (needBreakBtn && eventListeners.needBreakBtn) {
		needBreakBtn.removeEventListener('click', eventListeners.needBreakBtn);
	}

	// Remove document-level event listeners
	if (eventListeners.keydown) {
		document.removeEventListener('keydown', eventListeners.keydown);
	}
	if (eventListeners.visibilitychange) {
		document.removeEventListener('visibilitychange', eventListeners.visibilitychange);
	}
	if (eventListeners.mousemove) {
		document.removeEventListener('mousemove', eventListeners.mousemove);
	}
	if (eventListeners.copy) {
		document.removeEventListener('copy', eventListeners.copy);
	}
	if (eventListeners.paste) {
		document.removeEventListener('paste', eventListeners.paste);
	}
	if (eventListeners.scroll) {
		document.removeEventListener('scroll', eventListeners.scroll);
	}

	// Clear references
	eventListeners = {
		raiseHandBtn: null,
		askQuestionBtn: null,
		needBreakBtn: null,
		keydown: null,
		visibilitychange: null,
		mousemove: null,
		copy: null,
		paste: null,
		scroll: null
	};

	console.log('✅ Event listeners cleaned up (memory leak prevention)');
}

// Clean up on page unload
window.addEventListener('beforeunload', function () {
	// Clean up event listeners to prevent memory leaks
	cleanupEventListeners();

	if (submissionInterval) {
		clearTimeout(submissionInterval); // Changed from clearInterval since we now use setTimeout
	}

	// Submit final data (synchronous for beforeunload)
	submitDataToGoogleForm();

	// Clean up form submitter
	if (formSubmitter) {
		formSubmitter.destroy();
	}

	// Clean up tab monitor
	if (tabMonitor) {
		tabMonitor.destroy();
	}
});

// Error handling
window.addEventListener('error', function (event) {
	console.error('❌ Error:', event.error);
	updateConnectionStatus('disconnected');
});
