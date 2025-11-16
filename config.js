/**
 * Configuration file for DigiEdu Hackathon Project
 *
 * ENVIRONMENT CONFIGURATION SYSTEM:
 * For local development or different deployments, create a file named `config.local.js`
 * (see config.example.js as template) and load it AFTER this file:
 *
 * <script src="config.js"></script>
 * <script src="config.local.js"></script> <!-- Optional local overrides -->
 *
 * config.local.js should define CONFIG_LOCAL object with overrides.
 * It's gitignored, so your local config won't be committed.
 */

const CONFIG = {
	// Google Sheets Configuration
	SPREADSHEET_ID: '1lqMoIFBX4mOtUdMlkztgVqXE924FgagCkjbL3gNeSaw', // Found in the URL of your Google Sheet
	SHEET_NAME: 'Form Responses 2', // Name of the sheet tab (usually "Sheet1")

	// Google Form Configuration
	FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSehJNCbt9oqZVu5L4nsr94PyojiNXKiLBrEQTSnNkuRxbzwrQ/formResponse',

	// Form field IDs - Extract these from Google Form source code
	// NOTE: timestamp is automatically added by Google Forms, don't need an entry for it
	FORM_FIELDS: {
		sessionId: 'entry.57614039',
		studentId: 'entry.2080623105',
		keystrokeCount: 'entry.1646748143',
		tabSwitches: 'entry.2141866985',
		mouseVelocity: 'entry.1597841422',
		copyPasteEvents: 'entry.1034689961',
		scrollSpeed: 'entry.1944880520',
		raiseHand: 'entry.371752430',        // Valid entry ID (verified in production form)
		question: 'entry.1086710132',         // Valid entry ID (verified in production form)
		needBreak: 'entry.2010854256'         // Valid entry ID (verified in production form)
	},

	// Application Settings
	SETTINGS: {
		UPDATE_INTERVAL: 30000,  // 30 seconds - how often to send student data
		DATA_WINDOW: 300000,     // 300 seconds (5 minutes) - time window for calculating CLS [TEMPORARILY INCREASED FOR TESTING]
		POLL_INTERVAL: 30000,    // 30 seconds - how often dashboard refreshes
		SESSION_TIMEOUT: 3600000 // 1 hour - session expiration time
	},

	// Cognitive Load Score (CLS) Calculation Weights
	// These determine how much each metric contributes to the overall score
	WEIGHTS: {
		tabSwitch: 15,      // High impact - indicates searching for help
		mouseVelocity: 0.1, // Scaled down - pixels per second
		copyPaste: 12,      // High impact - indicates panic saving
		scroll: 0.05,       // Scaled down - pixels per second
		keystroke: 0.5      // Medium impact - keystrokes per 30s
	},

	// CLS Thresholds for color coding
	THRESHOLDS: {
		GREEN: 50,   // 0-50: Normal cognitive load
		YELLOW: 75   // 50-75: Moderate, 75-100: Overload
	},

	// Class Configuration (can be overridden by teacher)
	CLASS_DEFAULTS: {
		title: 'Live Class Session',
		subject: 'General',
		totalStudents: 30
	}
};

// Validation function to check if config is set up
CONFIG.isConfigured = function () {
	if (!this.SPREADSHEET_ID || this.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
		console.error('❌ CONFIG ERROR: SPREADSHEET_ID not set');
		return false;
	}
	if (!this.FORM_URL || this.FORM_URL.includes('YOUR_FORM_ID')) {
		console.error('❌ CONFIG ERROR: FORM_URL not set');
		return false;
	}
	console.log('✅ Configuration validated');
	return true;
};

// Merge local configuration if it exists (loaded from config.local.js)
if (typeof CONFIG_LOCAL !== 'undefined') {
	console.log('🔧 Loading local configuration overrides...');
	Object.assign(CONFIG, CONFIG_LOCAL);
	console.log('✅ Configuration merged successfully');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
	module.exports = CONFIG;
}
