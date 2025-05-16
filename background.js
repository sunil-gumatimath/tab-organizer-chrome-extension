// background.js - Auto Tab Grouping Feature

// Store active group information
let domainGroups = {};
let isAutoGroupingEnabled = true;
const groupColors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey', 'teal'];
let colorIndex = 0;

// Load settings when extension starts
chrome.storage.sync.get(['autoGroupingEnabled'], (result) => {
  if (result.hasOwnProperty('autoGroupingEnabled')) {
    isAutoGroupingEnabled = result.autoGroupingEnabled;
  }
});

// Listen for changes to settings
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoGroupingEnabled) {
    isAutoGroupingEnabled = changes.autoGroupingEnabled.newValue;
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
  if (!isAutoGroupingEnabled) return;

  // Skip tabs that don't have a URL yet
  if (!tab.url || tab.url === '') {
    // For tabs without URLs, we'll wait for them to get a URL
    return;
  }

  autoGroupTab(tab);
});

// Handle tab updates (for when tabs change URLs)
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  if (!isAutoGroupingEnabled) return;

  // Only process if the URL has changed and is complete
  if (changeInfo.status === 'complete' && changeInfo.url) {
    autoGroupTab(tab);
  }
});

// Auto-group a tab based on its domain
function autoGroupTab(tab) {
  // Skip chrome:// and other special URLs
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url === 'about:blank') {
    return;
  }

  const domain = extractDomain(tab.url);
  if (!domain) return;

  const windowId = tab.windowId;

  // Initialize window groups if not exists
  if (!domainGroups[windowId]) {
    domainGroups[windowId] = {};
  }

  // If this domain already has a group in this window
  if (domainGroups[windowId][domain]) {
    const groupId = domainGroups[windowId][domain];

    // Add the tab to the existing group
    chrome.tabs.group({ tabIds: [tab.id], groupId: groupId }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error adding tab to group:', chrome.runtime.lastError.message);
      }
    });
  } else {
    // Check if there are other tabs with the same domain to create a new group
    chrome.tabs.query({ windowId: windowId }, (tabs) => {
      const sameDomainTabs = tabs.filter(t => {
        // Skip the current tab as we already have it
        if (t.id === tab.id) return false;

        // Check if this tab has the same domain
        return extractDomain(t.url) === domain;
      });

      // Add the current tab to the list
      sameDomainTabs.push(tab);

      // Only create a group if there are at least 2 tabs with the same domain
      if (sameDomainTabs.length >= 2) {
        const tabIds = sameDomainTabs.map(t => t.id);

        // Create a new group
        chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
          if (chrome.runtime.lastError) {
            console.error('Error creating group:', chrome.runtime.lastError.message);
            return;
          }

          // Store the group ID for this domain
          domainGroups[windowId][domain] = groupId;

          // Set the group title and color
          const color = groupColors[colorIndex % groupColors.length];
          colorIndex++;

          chrome.tabGroups.update(groupId, {
            title: domain,
            color: color
          });
        });
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
