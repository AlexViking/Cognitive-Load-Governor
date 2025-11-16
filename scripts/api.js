// API Helper Functions for Google Sheets Integration
// This script provides functions to interact with Google Sheets API

/**
 * Fetch data from publicly shared Google Sheets (published as web)
 * @param {string} spreadsheetId - The Google Sheets spreadsheet ID
 * @param {string} sheetName - The sheet tab name (default: 'Sheet1')
 * @returns {Promise<Array>} - Array of rows from the sheet
 */
async function fetchSheetData(spreadsheetId, sheetName = 'Sheet1') {
	try {
		// IMPORTANT: The sheet must be published to web for this to work!
		// File → Share → Publish to web → Publish
		const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;

		console.log('📡 Fetching data from Google Sheets...');
		console.log('   Make sure sheet is published: File → Share → Publish to web');

		const response = await fetch(url, {
			method: 'GET',
			mode: 'cors'
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const text = await response.text();

		// Google returns JSONP, need to extract JSON
		// Format: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
		const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);

		if (!jsonMatch) {
			console.warn('⚠️  Could not parse response. Make sure sheet is published to web!');
			console.warn('   Go to: File → Share → Publish to web → Publish');
			return [];
		}

		const jsonData = JSON.parse(jsonMatch[1]);

		if (jsonData.status === 'error') {
			throw new Error(jsonData.errors[0].detailed_message);
		}

		if (!jsonData.table || !jsonData.table.rows || jsonData.table.rows.length === 0) {
			console.warn('⚠️  No data found in spreadsheet');
			return [];
		}

		// Convert to array of arrays
		const rows = jsonData.table.rows.map(row => {
			return row.c.map(cell => {
				if (!cell || cell.v === null || cell.v === undefined) return '';
				return String(cell.v);
			});
		});

		console.log(`✅ Fetched ${rows.length} rows from Google Sheets`);
		return rows;

	} catch (error) {
		console.error('❌ Error fetching sheet data:', error);
		console.error('');
		console.error('🔧 HOW TO FIX:');
		console.error('   1. Open your Google Sheet');
		console.error('   2. Click File → Share → Publish to web');
		console.error('   3. Click "Publish" button');
		console.error('   4. Make sure "Entire Document" is selected');
		console.error('   5. Try again!');
		console.error('');

		throw error;
	}
}

/**
 * Parse sheet data and extract relevant information
 * @param {Array} rawData - Raw data from Google Sheets
 * @returns {Object} - Parsed data with metadata
 */
function parseSheetData(rawData) {
	if (!rawData || rawData.length === 0) {
		return {
			headers: [],
			rows: [],
			rowCount: 0,
			lastUpdated: null
		};
	}

	// First row is headers
	const headers = rawData[0];
	const rows = rawData.slice(1); // Skip header row

	// Find most recent timestamp using unified parsing
	let lastUpdated = null;
	if (rows.length > 0) {
		const timestamps = rows
			.map(row => parseTimestamp(row[0]))
			.filter(ts => !isNaN(ts));

		if (timestamps.length > 0) {
			lastUpdated = Math.max(...timestamps);
		}
	}

	return {
		headers: headers,
		rows: rows,
		rowCount: rows.length,
		lastUpdated: lastUpdated
	};
}


/**
 * Validate API configuration
 * @returns {Object} - {valid: boolean, errors: Array}
 */
function validateAPIConfig() {
	const errors = [];

	if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
		errors.push('SPREADSHEET_ID not configured');
	}

	if (!CONFIG.FORM_URL || CONFIG.FORM_URL.includes('YOUR_FORM_ID')) {
		errors.push('FORM_URL not configured');
	}

	return {
		valid: errors.length === 0,
		errors: errors
	};
}


/**
 * Create session URL for students
 * @param {string} sessionId - The session ID
 * @param {string} title - Class title (optional)
 * @param {string} subject - Subject name (optional)
 * @param {number} totalStudents - Total number of students (optional)
 * @returns {string} - Full URL for students to join
 */
function createSessionURL(sessionId, title = '', subject = '', totalStudents = null) {
	const baseURL = window.location.origin + window.location.pathname.replace('dashboard.html', '');
	let url = `${baseURL}classLink.html?session=${sessionId}`;

	if (title) {
		url += `&title=${encodeURIComponent(title)}`;
	}

	if (subject) {
		url += `&subject=${encodeURIComponent(subject)}`;
	}

	if (totalStudents) {
		url += `&totalStudents=${totalStudents}`;
	}

	return url;
}

// Export functions if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		fetchSheetData,
		parseSheetData,
		validateAPIConfig,
		createSessionURL
	};
}
