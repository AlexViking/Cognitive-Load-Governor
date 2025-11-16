// Teacher Dashboard Script - Data Fetching and Visualization
// This script manages the teacher dashboard, fetches data, and updates the gauge

// Global variables
let currentSessionId = '';
let refreshInterval = null;
let historicalScores = [];
let isSessionActive = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
	console.log('👨‍🏫 DigiEdu Teacher Dashboard Loaded');

	// Check configuration
	if (!checkConfiguration()) {
		showConfigurationWarning();
		return;
	}

	// Set up event listeners
	setupEventListeners();

	// Check if there's an existing session
	checkExistingSession();
});

// Check if configuration is set up
function checkConfiguration() {
	const validation = validateAPIConfig();

	if (!validation.valid) {
		console.error('❌ Configuration incomplete:', validation.errors);
		return false;
	}

	console.log('✅ Configuration validated');
	updateAPIStatus('connected');
	return true;
}

// Show configuration warning
function showConfigurationWarning() {
	const validation = validateAPIConfig();

	// Show toast with first error
	if (validation.errors.length > 0) {
		showToast('Configuration Error: ' + validation.errors[0], 'error');
	}

	console.error('Configuration errors:', validation.errors);
	updateAPIStatus('disconnected');
}

// Set up event listeners
function setupEventListeners() {
	const generateLinkBtn = document.getElementById('generateLinkBtn');
	if (generateLinkBtn) {
		generateLinkBtn.addEventListener('click', generateSession);
	}

	const copyLinkBtn = document.getElementById('copyLinkBtn');
	if (copyLinkBtn) {
		copyLinkBtn.addEventListener('click', copyLinkToClipboard);
	}

	const navEndSessionBtn = document.getElementById('navEndSessionBtn');
	if (navEndSessionBtn) {
		navEndSessionBtn.addEventListener('click', endSession);
	}

	console.log('✅ Event listeners set up');
}

// Check for existing session in sessionStorage
function checkExistingSession() {
	const savedSessionId = sessionStorage.getItem('dashboardSessionId');

	if (savedSessionId) {
		console.log('📌 Found existing session:', savedSessionId);

		// Restore session
		currentSessionId = savedSessionId;
		const classTitle = sessionStorage.getItem('dashboardClassTitle') || 'Untitled Class';
		const subject = sessionStorage.getItem('dashboardSubject') || 'General';
		const totalStudents = parseInt(sessionStorage.getItem('dashboardTotalStudents')) || 30;

		document.getElementById('classTitle').value = classTitle;
		document.getElementById('subjectName').value = subject;
		document.getElementById('totalStudents').value = totalStudents;

		// Auto-start session
		startSession(classTitle, subject, totalStudents);
	}
}

// Generate new session
function generateSession() {
	const classTitle = document.getElementById('classTitle').value.trim() || 'Untitled Class';
	const subject = document.getElementById('subjectName').value.trim() || 'General';
	const totalStudents = parseInt(document.getElementById('totalStudents').value) || 30;

	if (!classTitle) {
		showToast('Please enter a class title', 'error');
		return;
	}

	// Generate session ID
	currentSessionId = generateRandomId('session');

	// Save to sessionStorage
	sessionStorage.setItem('dashboardSessionId', currentSessionId);
	sessionStorage.setItem('dashboardClassTitle', classTitle);
	sessionStorage.setItem('dashboardSubject', subject);
	sessionStorage.setItem('dashboardTotalStudents', totalStudents);

	console.log('✅ Session generated:', currentSessionId);

	startSession(classTitle, subject, totalStudents);
}

// Start session (show link in sidebar and start monitoring)
function startSession(classTitle, subject, totalStudents) {
	// Generate student link (include totalStudents in URL)
	const studentLink = createSessionURL(currentSessionId, classTitle, subject, totalStudents);
	const studentLinkInput = document.getElementById('studentLinkInput');
	if (studentLinkInput) {
		studentLinkInput.value = studentLink;
	}

	// Show link group in sidebar
	const linkGroup = document.getElementById('linkGroup');
	if (linkGroup) {
		linkGroup.style.display = 'block';
	}

	// Update attendance in nav
	const navAttendance = document.getElementById('navAttendance');
	if (navAttendance) {
		navAttendance.textContent = `0/${totalStudents}`;
	}

	// Store total students for later use
	window.dashboardTotalStudents = totalStudents;

	// Start monitoring automatically
	isSessionActive = true;
	startDataRefresh();

	showToast('Session created! Share the link with students');
}


// End session
function endSession() {
	if (!confirm('Are you sure you want to end this session?')) {
		return;
	}

	isSessionActive = false;

	// Stop refresh
	if (refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}

	// Clear session storage
	sessionStorage.removeItem('dashboardSessionId');
	sessionStorage.removeItem('dashboardClassTitle');
	sessionStorage.removeItem('dashboardSubject');
	sessionStorage.removeItem('dashboardTotalStudents');

	// Hide link group
	const linkGroup = document.getElementById('linkGroup');
	if (linkGroup) {
		linkGroup.style.display = 'none';
	}

	// Clear link input
	const studentLinkInput = document.getElementById('studentLinkInput');
	if (studentLinkInput) {
		studentLinkInput.value = '';
	}

	// Reset attendance
	const navAttendance = document.getElementById('navAttendance');
	if (navAttendance) {
		navAttendance.textContent = '0/30';
	}

	// Reset values
	currentSessionId = '';
	historicalScores = [];

	showToast('Session ended');
	console.log('✅ Session ended');
}

// Copy link to clipboard
function copyLinkToClipboard() {
	const linkInput = document.getElementById('studentLinkInput');
	linkInput.select();
	linkInput.setSelectionRange(0, 99999); // For mobile devices

	try {
		document.execCommand('copy');
		showToast('Link copied to clipboard!');
		console.log('✅ Link copied');
	} catch (error) {
		console.error('❌ Failed to copy link:', error);
		showToast('Failed to copy. Please copy manually.', 'error');
	}
}

// Start data refresh loop
function startDataRefresh() {
	// Guard against multiple intervals (zombie interval prevention)
	if (refreshInterval) {
		console.warn('⚠️ Refresh interval already running, clearing old one');
		clearInterval(refreshInterval);
		refreshInterval = null;
	}

	// Fetch immediately
	fetchAndUpdateData();

	// Then fetch every 30 seconds
	refreshInterval = setInterval(() => {
		fetchAndUpdateData();
	}, CONFIG.SETTINGS.POLL_INTERVAL);

	console.log('✅ Data refresh started (every 30s)');
}

// Fetch and update all dashboard data
async function fetchAndUpdateData() {
	if (!isSessionActive) return;

	try {
		console.log('🔄 Fetching data...');

		// Fetch data from Google Sheets (no API key needed!)
		const rawData = await fetchSheetData(CONFIG.SPREADSHEET_ID, CONFIG.SHEET_NAME);

		// Parse data
		const parsed = parseSheetData(rawData);

		// Filter for current session only (optional - for multi-session support)
		// For now, we'll use all data
		const sessionData = parsed.rows;

		// Calculate CLS (this also counts active students)
		const clsResult = calculateCLS(sessionData);

		// Update UI - use activeStudents from clsResult
		updateAttendance(clsResult.activeStudents);
		updateGauge(clsResult);
		updateMetrics(clsResult.metrics);

		// Update student requests tab
		updateStudentRequests(sessionData);

		// Store score for historical tracking
		if (clsResult.score > 0) {
			historicalScores.push({
				timestamp: new Date(),
				score: clsResult.score
			});
			if (historicalScores.length > 20) {
				historicalScores.shift(); // Keep last 20 scores only
			}

			// Update D3 history chart
			if (typeof window.updateHistoryChart === 'function') {
				window.updateHistoryChart(historicalScores);
			}
		}

		console.log('✅ Data updated:', clsResult);

	} catch (error) {
		console.error('❌ Error fetching data:', error);
		updateAPIStatus('disconnected');
		showToast('Failed to fetch data. Check console for details.', 'error');
	}
}

// Update attendance display
function updateAttendance(activeCount) {
	const totalStudents = window.dashboardTotalStudents || 30;

	// Update nav bar attendance
	document.getElementById('navAttendance').textContent = `${activeCount}/${totalStudents}`;
}


// Update gauge visualization (now updates progress bar)
function updateGauge(clsResult) {
	const score = clsResult.score;

	// Update progress bar
	const progressBar = document.getElementById('progressBar');
	if (progressBar) {
		progressBar.style.width = score + '%';
	}

	// Update score display
	const scoreElement = document.getElementById('gaugeScore');
	if (scoreElement) {
		scoreElement.textContent = Math.round(score);
	}

	// Update status message
	updateStatusMessage(clsResult);
}

// Update status message
function updateStatusMessage(clsResult) {
	const message = clsResult.message;

	// Show notification if overload detected
	if (clsResult.color === 'red') {
		showToast('⚠️ COGNITIVE OVERLOAD DETECTED! Consider slowing down.', 'error');
	}

	console.log('Status:', message);
}

// Update metrics display
function updateMetrics(metrics) {
	if (!metrics) {
		return;
	}

	// Update metrics in the trends card
	const metricTabSwitches = document.getElementById('metricTabSwitches');
	const metricMouseVelocity = document.getElementById('metricMouseVelocity');
	const metricCopyPaste = document.getElementById('metricCopyPaste');
	const metricScrollSpeed = document.getElementById('metricScrollSpeed');

	if (metricTabSwitches) metricTabSwitches.textContent = metrics.avgTabSwitch || '-';
	if (metricMouseVelocity) metricMouseVelocity.textContent = (metrics.avgMouseVelocity || 0).toFixed(2);
	if (metricCopyPaste) metricCopyPaste.textContent = metrics.avgCopyPaste || '-';
	if (metricScrollSpeed) metricScrollSpeed.textContent = (metrics.avgScrollSpeed || 0).toFixed(2);
}


// Update API status indicator
function updateAPIStatus(status) {
	// API status indicator removed in modern design
	// Just log the status for debugging
	console.log('API Status:', status);
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

// Update student requests tab
function updateStudentRequests(sessionData) {
	if (!sessionData || sessionData.length === 0) {
		return;
	}

	// Filter recent data (last 5 minutes)
	const now = Date.now();
	const cutoffTime = now - CONFIG.SETTINGS.DATA_WINDOW;

	const recentData = sessionData.filter(row => {
		const timestamp = parseTimestamp(row[0]);
		return timestamp >= cutoffTime && !isNaN(timestamp);
	});

	// Extract raised hands (column 8)
	// Deduplicate by studentId - only show most recent raise hand per student
	const raisedHandsMap = new Map();
	recentData
		.filter(row => row[8] === 'Yes')
		.forEach(row => {
			const studentId = row[2];
			const timestamp = row[0];
			// Only keep the most recent timestamp for each student
			if (!raisedHandsMap.has(studentId) || timestamp > raisedHandsMap.get(studentId).timestamp) {
				raisedHandsMap.set(studentId, { studentId, timestamp });
			}
		});
	const raisedHands = Array.from(raisedHandsMap.values());

	// Extract questions (column 9)
	// Deduplicate by studentId - only show most recent question per student
	const questionsMap = new Map();
	recentData
		.filter(row => row[9] && row[9].trim() !== '')
		.forEach(row => {
			const studentId = row[2];
			const question = row[9];
			const timestamp = row[0];
			// Only keep the most recent question for each student
			if (!questionsMap.has(studentId) || timestamp > questionsMap.get(studentId).timestamp) {
				questionsMap.set(studentId, { studentId, question, timestamp });
			}
		});
	const questions = Array.from(questionsMap.values());

	// Extract break requests (column 10)
	// Deduplicate by studentId - only show most recent break request per student
	const breakRequestsMap = new Map();
	recentData
		.filter(row => row[10] === 'Yes')
		.forEach(row => {
			const studentId = row[2];
			const timestamp = row[0];
			// Only keep the most recent break request for each student
			if (!breakRequestsMap.has(studentId) || timestamp > breakRequestsMap.get(studentId).timestamp) {
				breakRequestsMap.set(studentId, { studentId, timestamp });
			}
		});
	const breakRequests = Array.from(breakRequestsMap.values());

	// All old UI code removed - using modern design only

	// Update notification count in nav bar
	const totalRequests = raisedHands.length + questions.length + breakRequests.length;

	const navNotifications = document.getElementById('navNotifications');
	if (navNotifications) {
		navNotifications.textContent = totalRequests;
	}

	const totalRequestsCount = document.getElementById('totalRequestsCount');
	if (totalRequestsCount) {
		totalRequestsCount.textContent = totalRequests;
	}

	// Update requests list in modern format
	const requestsList = document.getElementById('requestsList');
	if (!requestsList) {
		return; // Dashboard not visible yet
	}

	requestsList.innerHTML = '';

	if (totalRequests === 0) {
		requestsList.innerHTML = '<p class="empty-message">No pending requests</p>';
		return;
	}

	// Add raised hands
	raisedHands.forEach((hand, index) => {
		const div = document.createElement('div');
		div.className = 'request';
		div.innerHTML = `
            <span class="icon hand-icon">✋</span>
            <span class="text">Raised Hand - <strong>Student ${index + 1}</strong> (${getTimeAgo(hand.timestamp)})</span>
        `;
		requestsList.appendChild(div);
	});

	// Add questions
	questions.forEach((q, index) => {
		const div = document.createElement('div');
		div.className = 'request new';
		const shortQ = escapeHtml(q.question.substring(0, 40));
		div.innerHTML = `
            <span class="icon lost-icon">?</span>
            <span class="text">${shortQ}... - <strong>Student ${index + 1}</strong> (${getTimeAgo(q.timestamp)})</span>
        `;
		requestsList.appendChild(div);
	});

	// Add break requests
	breakRequests.forEach((req, index) => {
		const div = document.createElement('div');
		div.className = 'request';
		div.innerHTML = `
            <span class="icon help-icon">🚻</span>
            <span class="text">Need Break - <strong>Student ${index + 1}</strong> (Pending)</span>
        `;
		requestsList.appendChild(div);
	});
}

// Helper function to get time ago string (uses unified utility)
function getTimeAgo(timestamp) {
	return formatTimeAgo(timestamp);
}

// Helper function to escape HTML
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Calculate Cognitive Load Score (CLS) from student data
 * @param {Array} dataRows - Array of data rows from Google Sheets
 * @param {number} timeWindow - Time window in milliseconds (default: CONFIG.SETTINGS.DATA_WINDOW = 300000ms = 5 minutes)
 * @returns {Object} - {score, activeStudents, metrics, status, color, message}
 */
function calculateCLS(dataRows, timeWindow = CONFIG.SETTINGS.DATA_WINDOW) {
	// Validate input
	if (!dataRows || dataRows.length === 0) {
		return {
			score: 0,
			activeStudents: 0,
			status: 'no-data',
			color: 'gray',
			message: 'Waiting for student data...',
			metrics: null
		};
	}

	const now = Date.now();
	const cutoffTime = now - timeWindow;

	console.log('🕐 Timestamp Debug:', {
		now: now,
		cutoffTime: cutoffTime,
		timeWindow: timeWindow,
		totalRows: dataRows.length
	});

	// Filter for recent data only (within time window)
	const recentData = dataRows.filter(row => {
		// Skip header row
		if (row[0] === 'Timestamp' || row[0] === 'timestamp') return false;

		// Parse timestamp using unified utility
		const timestamp = parseTimestamp(row[0]);

		// Log for debugging
		const age = now - timestamp;
		console.log('   Row:', row[0], '→', timestamp, 'Age:', Math.round(age / 1000) + 's', 'Keep:', timestamp >= cutoffTime);

		return timestamp >= cutoffTime && !isNaN(timestamp);
	});

	console.log('✅ Filtered to', recentData.length, 'recent rows');

	// If no recent data, return waiting state
	if (recentData.length === 0) {
		console.log('⚠️  No recent data within', timeWindow / 1000, 'second window');
		return {
			score: 0,
			activeStudents: 0,
			status: 'waiting',
			color: 'gray',
			message: 'No recent student activity...',
			metrics: null
		};
	}

	// Count unique active students (using Set to deduplicate student IDs)
	// Google Forms column layout: [Timestamp, sessionId, studentId, keystrokeCount, tabSwitches, mouseVelocity, copyPasteEvents, scrollSpeed]
	const STUDENT_ID_COLUMN = 2; // Column 3 (index 2) is studentId
	const uniqueStudentIds = new Set(recentData.map(row => row[STUDENT_ID_COLUMN]));
	const activeStudents = uniqueStudentIds.size;

	// Calculate average metrics across all recent data points
	let totalKeystroke = 0;
	let totalTabSwitch = 0;
	let totalMouseVelocity = 0;
	let totalCopyPaste = 0;
	let totalScroll = 0;

	recentData.forEach(row => {
		// Parse each metric (handle NaN gracefully)
		// Google Forms columns: [0: Timestamp, 1: sessionId, 2: studentId, 3: keystrokeCount, 4: tabSwitches, 5: mouseVelocity, 6: copyPasteEvents, 7: scrollSpeed]
		totalKeystroke += parseFloat(row[3]) || 0;      // Index 3: keystrokeCount
		totalTabSwitch += parseFloat(row[4]) || 0;      // Index 4: tabSwitches
		totalMouseVelocity += parseFloat(row[5]) || 0;  // Index 5: mouseVelocity
		totalCopyPaste += parseFloat(row[6]) || 0;      // Index 6: copyPasteEvents
		totalScroll += parseFloat(row[7]) || 0;         // Index 7: scrollSpeed
	});

	const count = recentData.length;

	// Calculate averages
	const avgKeystroke = totalKeystroke / count;
	const avgTabSwitch = totalTabSwitch / count;
	const avgMouseVelocity = totalMouseVelocity / count;
	const avgCopyPaste = totalCopyPaste / count;
	const avgScroll = totalScroll / count;

	// Apply weighted formula
	// Higher values = higher cognitive load
	const rawScore = (
		(avgTabSwitch * CONFIG.WEIGHTS.tabSwitch) +
		(avgMouseVelocity * CONFIG.WEIGHTS.mouseVelocity) +
		(avgCopyPaste * CONFIG.WEIGHTS.copyPaste) +
		(avgScroll * CONFIG.WEIGHTS.scroll) +
		(avgKeystroke * CONFIG.WEIGHTS.keystroke)
	);

	// Normalize to 0-100 scale
	// Adjust the divisor based on testing to get reasonable ranges
	// For now, assuming max reasonable score is around 500
	const normalizedScore = Math.min(100, Math.max(0, (rawScore / 500) * 100));

	// Determine status and color
	let status, color, message;
	if (normalizedScore < CONFIG.THRESHOLDS.GREEN) {
		status = 'normal';
		color = 'green';
		message = 'Class is keeping up';
	} else if (normalizedScore < CONFIG.THRESHOLDS.YELLOW) {
		status = 'moderate';
		color = 'yellow';
		message = 'Watch carefully - students working hard';
	} else {
		status = 'overload';
		color = 'red';
		message = 'SLOW DOWN - Class is overloaded!';
	}

	// Return comprehensive result
	return {
		score: Math.round(normalizedScore),
		activeStudents: activeStudents,
		status: status,
		color: color,
		message: message,
		metrics: {
			avgKeystroke: Math.round(avgKeystroke * 10) / 10,
			avgTabSwitch: Math.round(avgTabSwitch * 10) / 10,
			avgMouseVelocity: Math.round(avgMouseVelocity * 10) / 10,
			avgCopyPaste: Math.round(avgCopyPaste * 10) / 10,
			avgScroll: Math.round(avgScroll * 10) / 10,
			rawScore: Math.round(rawScore * 10) / 10,
			dataPoints: count
		}
	};
}

// Clean up on page unload
window.addEventListener('beforeunload', function () {
	if (refreshInterval) {
		clearInterval(refreshInterval);
	}
});

// Error handling
window.addEventListener('error', function (event) {
	console.error('❌ Error:', event.error);
	updateAPIStatus('disconnected');
});
