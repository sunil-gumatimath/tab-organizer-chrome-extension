// background.js - Auto Tab Grouping Feature

// Store active group information
let domainGroups = {};
let isAutoGroupingEnabled = true; // Default state
const groupColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey', 'teal'];
let colorIndex = 0;

/**
 * Load the auto-grouping setting from storage
 */
function loadAutoGroupingSetting() {
  chrome.storage.sync.get(['autoGroupingEnabled'], (result) => {
    if (result.hasOwnProperty('autoGroupingEnabled')) {
      // Explicitly convert to boolean to avoid type issues
      isAutoGroupingEnabled = result.autoGroupingEnabled === true;
      console.log('[Background] Auto-grouping setting loaded:', isAutoGroupingEnabled,
                  'Type:', typeof isAutoGroupingEnabled);
    } else {
      // Initialize setting if it doesn't exist
      isAutoGroupingEnabled = true;
      chrome.storage.sync.set({ autoGroupingEnabled: true });
      console.log('[Background] Auto-grouping setting initialized to true');
    }
  });
}

// Load settings when extension starts
loadAutoGroupingSetting();

// Listen for changes to settings
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoGroupingEnabled) {
    const oldValue = isAutoGroupingEnabled;
    // Explicitly convert to boolean
    isAutoGroupingEnabled = changes.autoGroupingEnabled.newValue === true;

    console.log('[Background] Auto-grouping setting changed from', oldValue, 'to', isAutoGroupingEnabled);
    console.log('[Background] Raw value:', changes.autoGroupingEnabled.newValue,
                'Type:', typeof changes.autoGroupingEnabled.newValue);
  }
});

// Extract domain name from URL for grouping
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // Extract the main domain for grouping
    let groupName = '';

    // Handle special cases first
    if (domain.includes('google')) {
      // Google services
      if (domain.startsWith('mail.')) groupName = 'Gmail';
      else if (domain.startsWith('drive.')) groupName = 'Google Drive';
      else if (domain.startsWith('docs.')) groupName = 'Google Docs';
      else if (domain.startsWith('sheets.')) groupName = 'Google Sheets';
      else if (domain.startsWith('slides.')) groupName = 'Google Slides';
      else if (domain.startsWith('calendar.')) groupName = 'Google Calendar';
      else if (domain.startsWith('meet.')) groupName = 'Google Meet';
      else if (domain.startsWith('chat.')) groupName = 'Google Chat';
      else if (domain.startsWith('photos.')) groupName = 'Google Photos';
      else if (domain.startsWith('keep.')) groupName = 'Google Keep';
      else groupName = 'Google';
    } else if (domain.includes('youtube')) {
      groupName = 'YouTube';
    } else if (domain.includes('github')) {
      groupName = 'GitHub';
    } else if (domain.includes('microsoft') || domain.includes('office') || domain.includes('live.com')) {
      groupName = 'Microsoft';
    } else if (domain.includes('amazon')) {
      groupName = 'Amazon';
    } else if (domain.includes('facebook') || domain.includes('fb.com') || domain.includes('messenger')) {
      groupName = 'Facebook';
    } else if (domain.includes('twitter') || domain.includes('x.com')) {
      groupName = 'Twitter';
    } else if (domain.includes('instagram')) {
      groupName = 'Instagram';
    } else if (domain.includes('linkedin')) {
      groupName = 'LinkedIn';
    } else if (domain.includes('reddit')) {
      groupName = 'Reddit';
    } else {
      // General domain extraction
      // Remove 'www.' prefix if present
      if (domain.startsWith('www.')) domain = domain.substring(4);

      // Extract the main domain without TLD
      const domainParts = domain.split('.');
      if (domainParts.length >= 2) {
        // Use the second-to-last part as the main domain name
        // This handles domains like example.com, example.co.uk, etc.
        groupName = domainParts[domainParts.length - 2];

        // Capitalize the first letter
        groupName = groupName.charAt(0).toUpperCase() + groupName.slice(1);
      } else {
        groupName = domain;
      }
    }

    return groupName;
  } catch (e) {
    // Return null for invalid URLs (e.g., chrome://, about:blank)
    return null;
  }
}

// Handle tab creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log('[Background] Tab created, auto-grouping enabled:', isAutoGroupingEnabled);

  // Check if auto-grouping is enabled
  if (isAutoGroupingEnabled !== true) {
    console.log('[Background] Auto-grouping is disabled, skipping tab creation handling');
    return;
  }

  // Skip tabs that don't have a URL yet
  if (!tab.url || tab.url === '') {
    console.log('[Background] Tab has no URL yet, waiting for URL update');
    return;
  }

  console.log('[Background] Processing new tab for auto-grouping:', tab.id, tab.url);
  autoGroupTab(tab);
});

// Handle tab updates (for when tabs change URLs)
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  // Only process if the tab is complete and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('[Background] Tab updated, auto-grouping enabled:', isAutoGroupingEnabled);

    // Check if auto-grouping is enabled
    if (isAutoGroupingEnabled !== true) {
      console.log('[Background] Auto-grouping is disabled, skipping tab update handling');
      return;
    }

    console.log('[Background] Processing updated tab for auto-grouping:', tab.id, tab.url);
    autoGroupTab(tab);
  }
});

// Auto-group a tab based on its domain
function autoGroupTab(tab) {
  console.log('Auto-grouping tab:', tab.id, tab.url);

  // Skip chrome:// and other special URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url === 'about:blank') {
    console.log('Skipping special URL:', tab.url);
    return;
  }

  const domain = extractDomain(tab.url);
  console.log('Extracted domain:', domain);
  if (!domain) return;

  const windowId = tab.windowId;

  // Initialize window groups if not exists
  if (!domainGroups[windowId]) {
    domainGroups[windowId] = {};
  }

  // If this domain already has a group in this window
  if (domainGroups[windowId][domain]) {
    const groupId = domainGroups[windowId][domain];
    console.log('Found existing group for domain:', domain, 'Group ID:', groupId);

    // Verify the group still exists
    chrome.tabGroups.get(groupId, (_) => {
      if (chrome.runtime.lastError) {
        console.log('Group no longer exists, creating new group');
        delete domainGroups[windowId][domain];
        checkForSameDomainTabs();
        return;
      }

      // Add the tab to the existing group
      chrome.tabs.group({ tabIds: [tab.id], groupId: groupId }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error adding tab to group:', chrome.runtime.lastError.message);
          // If there was an error, try creating a new group
          delete domainGroups[windowId][domain];
          checkForSameDomainTabs();
        } else {
          console.log('Added tab to existing group:', groupId);
        }
      });
    });
  } else {
    checkForSameDomainTabs();
  }

  // Function to check for tabs with the same domain and create a group if needed
  function checkForSameDomainTabs() {
    // Check if there are other tabs with the same domain to create a new group
    chrome.tabs.query({ windowId: windowId }, (tabs) => {
      console.log('Checking all tabs in window for domain:', domain);
      const sameDomainTabs = tabs.filter(t => {
        // Skip the current tab as we already have it
        if (t.id === tab.id) return false;

        // Skip tabs without URLs
        if (!t.url) return false;

        // Check if this tab has the same domain
        const tabDomain = extractDomain(t.url);
        const isMatch = tabDomain === domain;
        if (isMatch) {
          console.log('Found matching tab:', t.id, t.url);
        }
        return isMatch;
      });

      // Add the current tab to the list
      sameDomainTabs.push(tab);

      // Only create a group if there are at least 2 tabs with the same domain
      if (sameDomainTabs.length >= 2) {
        console.log('Creating group for domain:', domain, 'with tabs:', sameDomainTabs.map(t => t.id));
        const tabIds = sameDomainTabs.map(t => t.id);

        // Create a new group
        chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
          if (chrome.runtime.lastError) {
            console.error('Error creating group:', chrome.runtime.lastError.message);
            return;
          }

          console.log('Group created with ID:', groupId);

          // Store the group ID for this domain
          domainGroups[windowId][domain] = groupId;

          // Set the group title and color
          const color = groupColors[colorIndex % groupColors.length];
          colorIndex++;

          chrome.tabGroups.update(groupId, {
            title: domain,
            color: color
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error updating group:', chrome.runtime.lastError.message);
            } else {
              console.log('Group updated with title:', domain, 'and color:', color);
            }
          });
        });
      } else {
        console.log('Not enough tabs for domain:', domain, 'Count:', sameDomainTabs.length);
      }
    });
  }
}

// Clean up when a window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (domainGroups[windowId]) {
    delete domainGroups[windowId];
  }
});
