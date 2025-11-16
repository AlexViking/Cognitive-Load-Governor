/**
 * Tab Monitor Utility
 * Detects duplicate tabs/windows for the same student session
 * Prevents gaming the system by opening multiple tabs
 */

class TabMonitor {
	constructor(studentId, options = {}) {
		this.studentId = studentId;
		this.tabId = this.generateTabId();
		this.storageKey = `digiEdu_activeTabs_${studentId}`;
		this.heartbeatInterval = options.heartbeatInterval || 5000; // 5 seconds
		this.tabTimeout = options.tabTimeout || 15000; // 15 seconds
		this.onDuplicateDetected = options.onDuplicateDetected || null;
		this.heartbeatTimer = null;
		this.broadcastChannel = null;

		// Initialize monitoring
		this.init();
	}

	/**
	 * Generate unique tab ID
	 */
	generateTabId() {
		if (crypto && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Initialize tab monitoring
	 */
	init() {
		// Clean up stale tabs first (from previous sessions/refreshes)
		this.cleanupStaleTabs();

		// Register this tab
		this.registerTab();

		// Start heartbeat
		this.startHeartbeat();

		// Listen for other tabs via BroadcastChannel (if supported)
		if (typeof BroadcastChannel !== 'undefined') {
			this.broadcastChannel = new BroadcastChannel('digiEdu_tab_sync');
			this.broadcastChannel.addEventListener('message', (event) => {
				this.handleBroadcastMessage(event.data);
			});

			// Announce this tab
			this.broadcastChannel.postMessage({
				type: 'tab_announce',
				tabId: this.tabId,
				studentId: this.studentId
			});
		}

		// Clean up on page unload
		window.addEventListener('beforeunload', () => {
			this.cleanup();
		});

		// Also clean up on visibility change (tab closed/hidden)
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.updateHeartbeat(); // Update one last time before hiding
			}
		});

		console.log('✅ Tab monitor initialized:', { tabId: this.tabId, studentId: this.studentId });
	}

	/**
	 * Register this tab in localStorage
	 */
	registerTab() {
		const tabs = this.getActiveTabs();
		const existingTab = tabs.find(tab => tab.tabId === this.tabId);

		if (!existingTab) {
			const now = Date.now();
			tabs.push({
				tabId: this.tabId,
				studentId: this.studentId,
				createdAt: now,          // Track when tab was created
				lastHeartbeat: now
			});
			this.saveActiveTabs(tabs);
		}
	}

	/**
	 * Start heartbeat to keep tab registered
	 */
	startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			this.updateHeartbeat();
			this.checkForDuplicates();
		}, this.heartbeatInterval);
	}

	/**
	 * Update heartbeat timestamp
	 */
	updateHeartbeat() {
		const tabs = this.getActiveTabs();
		const thisTab = tabs.find(tab => tab.tabId === this.tabId);

		if (thisTab) {
			thisTab.lastHeartbeat = Date.now();
			this.saveActiveTabs(tabs);
		} else {
			// Re-register if somehow removed
			this.registerTab();
		}
	}

	/**
	 * Clean up stale tabs (called on init to remove leftover tabs from previous sessions)
	 */
	cleanupStaleTabs() {
		const tabs = this.getActiveTabs();
		const now = Date.now();

		// Remove stale tabs (no heartbeat for > tabTimeout)
		const activeTabs = tabs.filter(tab => now - tab.lastHeartbeat < this.tabTimeout);

		const removedCount = tabs.length - activeTabs.length;
		if (removedCount > 0) {
			console.log(`🗑️ Cleaned up ${removedCount} stale tab(s) from previous sessions`);
			this.saveActiveTabs(activeTabs);
		}
	}

	/**
	 * Check for duplicate tabs
	 */
	checkForDuplicates() {
		const tabs = this.getActiveTabs();
		const now = Date.now();

		// Remove stale tabs (no heartbeat for > tabTimeout)
		const activeTabs = tabs.filter(tab => now - tab.lastHeartbeat < this.tabTimeout);
		this.saveActiveTabs(activeTabs);

		// Count tabs for this student (excluding stale ones)
		const studentTabs = activeTabs.filter(tab => tab.studentId === this.studentId);

		if (studentTabs.length > 1) {
			// Multiple active tabs detected
			const duplicateCount = studentTabs.length - 1;
			console.warn(`⚠️ Duplicate tab detected! ${studentTabs.length} active tabs for student ${this.studentId}`);
			console.warn('Tab details:', studentTabs.map(t => ({
				tabId: t.tabId,
				createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : 'unknown',
				lastHeartbeat: new Date(t.lastHeartbeat).toISOString(),
				isCurrent: t.tabId === this.tabId
			})));

			// Check if this is the oldest tab (only oldest tab gets to stay)
			// Sort by createdAt (when tab was opened), not lastHeartbeat
			const sortedTabs = studentTabs.sort((a, b) => (a.createdAt || a.lastHeartbeat) - (b.createdAt || b.lastHeartbeat));
			const isOldestTab = sortedTabs[0].tabId === this.tabId;

			if (!isOldestTab && this.onDuplicateDetected) {
				// This is a duplicate tab (not the oldest)
				this.onDuplicateDetected({
					duplicateCount,
					isOldestTab,
					activeTabs: studentTabs
				});
			}

			return {
				isDuplicate: !isOldestTab,
				duplicateCount,
				activeTabs: studentTabs
			};
		}

		return {
			isDuplicate: false,
			duplicateCount: 0,
			activeTabs: studentTabs
		};
	}

	/**
	 * Handle broadcast messages from other tabs
	 */
	handleBroadcastMessage(data) {
		if (data.type === 'tab_announce' && data.studentId === this.studentId && data.tabId !== this.tabId) {
			console.warn('⚠️ Another tab detected via BroadcastChannel:', data.tabId);
			this.checkForDuplicates();
		}
	}

	/**
	 * Get active tabs from localStorage
	 */
	getActiveTabs() {
		try {
			const data = localStorage.getItem(this.storageKey);
			return data ? JSON.parse(data) : [];
		} catch (error) {
			console.error('Error reading active tabs:', error);
			return [];
		}
	}

	/**
	 * Save active tabs to localStorage
	 */
	saveActiveTabs(tabs) {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(tabs));
		} catch (error) {
			console.error('Error saving active tabs:', error);
		}
	}

	/**
	 * Get duplicate tab status
	 */
	getDuplicateStatus() {
		return this.checkForDuplicates();
	}

	/**
	 * Clean up this tab's registration
	 */
	cleanup() {
		// Stop heartbeat
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}

		// Remove this tab from active tabs
		const tabs = this.getActiveTabs();
		const filtered = tabs.filter(tab => tab.tabId !== this.tabId);
		this.saveActiveTabs(filtered);

		// Close broadcast channel
		if (this.broadcastChannel) {
			this.broadcastChannel.close();
		}

		console.log('🗑️ Tab monitor cleaned up:', this.tabId);
	}

	/**
	 * Destroy tab monitor
	 */
	destroy() {
		this.cleanup();
	}
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
	module.exports = TabMonitor;
}
