// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const closeDuplicatesButton = document.getElementById('close-duplicates');
  const ungroupTabsButton = document.getElementById('ungroup-tabs');
  const muteTabsButton = document.getElementById('mute-tabs');
  const unmuteTabsButton = document.getElementById('unmute-tabs');
  const groupByDomainButton = document.getElementById('group-by-domain');
  const groupByTypeButton = document.getElementById('group-by-keyword');
  const tabSearchInput = document.getElementById('tab-search');
  const clearSearchButton = document.getElementById('clear-search');
  const searchResultsContainer = document.getElementById('search-results');
  const notificationElement = document.getElementById('notification');
  const notificationMessage = document.querySelector('.notification-message');
  const toggleAutoGroupingBtn = document.getElementById('toggle-auto-grouping');
  const toggleStatusEl = document.getElementById('toggle-status');
  const body = document.body;

  // Notification system
  function showNotification(message, type = 'info', duration = 3000) {
    // Set message
    notificationMessage.textContent = message;

    // Reset classes
    notificationElement.classList.remove('show', 'loading', 'success', 'error');

    // Add appropriate classes
    notificationElement.classList.add('show');
    if (type !== 'info') {
      notificationElement.classList.add(type);
    }

    // Auto-hide after duration (if not loading)
    if (type !== 'loading') {
      setTimeout(() => {
        notificationElement.classList.remove('show');
      }, duration);
    }

    return {
      // Method to update the notification
      update: (newMessage, newType) => {
        notificationMessage.textContent = newMessage;

        if (newType && newType !== type) {
          notificationElement.classList.remove('loading', 'success', 'error');
          if (newType !== 'info') {
            notificationElement.classList.add(newType);
          }
        }
      },
      // Method to hide the notification
      hide: () => {
        notificationElement.classList.remove('show');
      }
    };
  }

  // Always enable dark mode
  body.classList.add('dark-mode');

  // Tab Count Display
  function updateTabCount() {
    chrome.tabs.query({}, (tabs) => {
      const groupIds = new Set();
      tabs.forEach(tab => {
        if (tab.groupId && tab.groupId !== -1) groupIds.add(tab.groupId);
      });
      const tabCountDiv = document.getElementById('tab-count');
      tabCountDiv.textContent = `Open Tabs: ${tabs.length} | Tab Groups: ${groupIds.size}`;
    });
  }
  updateTabCount();

  // Update tab count when popup is opened and after actions
  [closeDuplicatesButton, ungroupTabsButton, muteTabsButton, unmuteTabsButton, groupByDomainButton, groupByTypeButton].forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(updateTabCount, 500);
    });
  });

  // Tab Search Functionality
  let allTabs = [];

  // Get all tabs when popup opens
  function loadAllTabs() {
    chrome.tabs.query({}, (tabs) => {
      allTabs = tabs;
    });
  }
  loadAllTabs();

  // Highlight matching text in search results
  function highlightMatch(text, query) {
    if (!query) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  // Search tabs based on input
  function searchTabs(query) {
    if (!query) {
      searchResultsContainer.style.display = 'none';
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchingTabs = allTabs.filter(tab => {
      return tab.title.toLowerCase().includes(lowerQuery) ||
             tab.url.toLowerCase().includes(lowerQuery);
    });

    renderSearchResults(matchingTabs, lowerQuery);
  }

  // Render search results
  function renderSearchResults(tabs, query) {
    searchResultsContainer.innerHTML = '';

    if (tabs.length === 0) {
      searchResultsContainer.innerHTML = '<div class="no-results">No matching tabs found</div>';
      searchResultsContainer.style.display = 'block';
      return;
    }

    tabs.forEach(tab => {
      const resultItem = document.createElement('div');
      resultItem.className = 'search-result';
      resultItem.dataset.tabId = tab.id;
      resultItem.dataset.windowId = tab.windowId;
      resultItem.tabIndex = 0; // Make focusable for keyboard navigation

      // Create favicon element
      const favicon = document.createElement('img');
      favicon.className = 'favicon';
      favicon.src = tab.favIconUrl || 'icons/icon16.png';
      favicon.onerror = () => { favicon.src = 'icons/icon16.png'; };

      // Create title element with highlighted match
      const title = document.createElement('div');
      title.className = 'tab-title';
      title.innerHTML = highlightMatch(tab.title, query);

      // Create URL element with highlighted match
      const url = document.createElement('div');
      url.className = 'tab-url';

      // Format URL for display (truncate and highlight)
      let displayUrl = tab.url;
      // Remove protocol for cleaner display
      displayUrl = displayUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
      // Truncate if too long
      if (displayUrl.length > 50) {
        displayUrl = displayUrl.substring(0, 47) + '...';
      }
      url.innerHTML = highlightMatch(displayUrl, query);

      // Create content wrapper for title and URL
      const content = document.createElement('div');
      content.className = 'result-content';
      content.appendChild(title);
      content.appendChild(url);

      // Add elements to result item
      resultItem.appendChild(favicon);
      resultItem.appendChild(content);

      // Add click event to switch to tab
      resultItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      });

      searchResultsContainer.appendChild(resultItem);
    });

    searchResultsContainer.style.display = 'block';
  }

  // Event listeners for search functionality
  tabSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    searchTabs(query);

    // Show/hide clear button based on input
    if (query.length > 0) {
      clearSearchButton.style.display = 'flex';
    } else {
      clearSearchButton.style.display = 'none';
    }
  });

  // Clear search button
  clearSearchButton.addEventListener('click', () => {
    clearSearch();
  });

  // Function to clear search
  function clearSearch() {
    tabSearchInput.value = '';
    searchResultsContainer.style.display = 'none';
    clearSearchButton.style.display = 'none';
    tabSearchInput.focus();
  }

  // Keyboard shortcuts for search
  document.addEventListener('keydown', (e) => {
    // If Escape key is pressed and search is active, clear it
    if (e.key === 'Escape' && tabSearchInput.value.trim().length > 0) {
      clearSearch();
      e.preventDefault();
    }

    // If Enter key is pressed in search input, focus first result
    if (e.key === 'Enter' && document.activeElement === tabSearchInput) {
      const firstResult = searchResultsContainer.querySelector('.search-result');
      if (firstResult) {
        // Get the tab ID from the data attribute
        const tabId = parseInt(firstResult.dataset.tabId);
        // Get the window ID from the data attribute or use the current window
        const windowId = firstResult.dataset.windowId ?
                         parseInt(firstResult.dataset.windowId) :
                         chrome.windows.WINDOW_ID_CURRENT;

        // Switch to the tab
        chrome.tabs.update(tabId, { active: true });
        chrome.windows.update(windowId, { focused: true });

        e.preventDefault();
      }
    }

    // Arrow key navigation for search results
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        searchResultsContainer.style.display === 'block') {
      const results = Array.from(searchResultsContainer.querySelectorAll('.search-result'));
      if (results.length === 0) return;

      // Find the currently focused result
      const focusedResult = document.activeElement.closest('.search-result');
      let nextIndex = 0;

      if (focusedResult) {
        const currentIndex = results.indexOf(focusedResult);
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % results.length;
        } else {
          nextIndex = (currentIndex - 1 + results.length) % results.length;
        }
      } else if (e.key === 'ArrowDown') {
        nextIndex = 0; // First result if none is focused
      } else {
        nextIndex = results.length - 1; // Last result if none is focused and ArrowUp
      }

      results[nextIndex].focus();
      e.preventDefault();
    }
  });

  // Hide clear button initially
  clearSearchButton.style.display = 'none';

  // Simple direct toggle functionality
  let autoGroupingEnabled = true; // Default state

  // Update UI to reflect current state
  function updateToggleUI(enabled) {
    if (enabled) {
      toggleStatusEl.textContent = 'ON';
      toggleStatusEl.classList.remove('off');
    } else {
      toggleStatusEl.textContent = 'OFF';
      toggleStatusEl.classList.add('off');
    }
  }

  // Toggle the auto-grouping state
  function toggleAutoGrouping() {
    // Toggle the state
    autoGroupingEnabled = !autoGroupingEnabled;

    // Update UI
    updateToggleUI(autoGroupingEnabled);

    // Save to storage
    chrome.storage.sync.set({ autoGroupingEnabled: autoGroupingEnabled }, () => {
      console.log('Auto-grouping set to:', autoGroupingEnabled);

      // Show notification
      showNotification(
        autoGroupingEnabled ? 'Auto-grouping enabled' : 'Auto-grouping disabled',
        'info',
        2000
      );
    });
  }

  // Load the current setting
  chrome.storage.sync.get(['autoGroupingEnabled'], (result) => {
    if (result.hasOwnProperty('autoGroupingEnabled')) {
      // Convert to boolean
      autoGroupingEnabled = result.autoGroupingEnabled === true;
      console.log('Loaded auto-grouping setting:', autoGroupingEnabled);
    } else {
      // Default to true if not set
      autoGroupingEnabled = true;
      chrome.storage.sync.set({ autoGroupingEnabled: true });
      console.log('Initialized auto-grouping to true');
    }

    // Update UI to match loaded state
    updateToggleUI(autoGroupingEnabled);
  });

  // Add click handler to toggle button
  toggleAutoGroupingBtn.addEventListener('click', toggleAutoGrouping);

  // Update search results when tabs change
  chrome.tabs.onUpdated.addListener((_, changeInfo) => {
    if (changeInfo.status === 'complete') {
      loadAllTabs();
      // Re-run search if there's an active query
      const query = tabSearchInput.value.trim();
      if (query) {
        searchTabs(query);
      }
    }
  });

  chrome.tabs.onRemoved.addListener(() => {
    loadAllTabs();
    // Re-run search if there's an active query
    const query = tabSearchInput.value.trim();
    if (query) {
      searchTabs(query);
    }
  });

  // Close Duplicate Tabs
  closeDuplicatesButton.addEventListener('click', () => {
    const notification = showNotification('Finding duplicate tabs...', 'loading');

    chrome.tabs.query({}, (tabs) => {
      const urlMap = new Map();
      const tabsToClose = [];
      tabs.forEach(tab => {
        const url = tab.url.split('#')[0];
        if (urlMap.has(url)) {
          tabsToClose.push(tab.id);
        } else {
          urlMap.set(url, [tab]);
        }
      });

      if (tabsToClose.length > 0) {
        chrome.tabs.remove(tabsToClose, () => {
          notification.update(`Closed ${tabsToClose.length} duplicate tabs.`, 'success');
          setTimeout(notification.hide, 2000);
        });
      } else {
        notification.update('No duplicate tabs found.', 'info');
        setTimeout(notification.hide, 2000);
      }
    });
  });

  // Ungroup All Tabs
  ungroupTabsButton.addEventListener('click', () => {
    const notification = showNotification('Ungrouping tabs...', 'loading');

    chrome.tabs.query({}, (tabs) => {
      const tabIds = tabs.map(tab => tab.id);
      chrome.tabs.ungroup(tabIds, () => {
        if (chrome.runtime.lastError) {
          notification.update('Error ungrouping tabs.', 'error');
        } else {
          notification.update('All tabs ungrouped.', 'success');
        }
        setTimeout(notification.hide, 2000);
      });
    });
  });

  // Mute All Tabs
  muteTabsButton.addEventListener('click', () => {
    const notification = showNotification('Muting all tabs...', 'loading');

    chrome.tabs.query({currentWindow: true}, (tabs) => {
      let mutedCount = 0;
      const promises = [];

      tabs.forEach(tab => {
        if (!tab.mutedInfo || !tab.mutedInfo.muted) {
          mutedCount++;
          promises.push(new Promise(resolve => {
            chrome.tabs.update(tab.id, {muted: true}, resolve);
          }));
        }
      });

      // Wait for all tabs to be muted
      Promise.all(promises).then(() => {
        if (mutedCount > 0) {
          notification.update(`Muted ${mutedCount} tabs.`, 'success');
        } else {
          notification.update('All tabs were already muted.', 'info');
        }
        setTimeout(notification.hide, 2000);
      });
    });
  });

  // Unmute All Tabs
  unmuteTabsButton.addEventListener('click', () => {
    const notification = showNotification('Unmuting all tabs...', 'loading');

    chrome.tabs.query({currentWindow: true}, (tabs) => {
      let unmutedCount = 0;
      const promises = [];

      tabs.forEach(tab => {
        if (tab.mutedInfo && tab.mutedInfo.muted) {
          unmutedCount++;
          promises.push(new Promise(resolve => {
            chrome.tabs.update(tab.id, {muted: false}, resolve);
          }));
        }
      });

      // Wait for all tabs to be unmuted
      Promise.all(promises).then(() => {
        if (unmutedCount > 0) {
          notification.update(`Unmuted ${unmutedCount} tabs.`, 'success');
        } else {
          notification.update('All tabs were already unmuted.', 'info');
        }
        setTimeout(notification.hide, 2000);
      });
    });
  });

  // Group Tabs by Domain
  groupByDomainButton.addEventListener('click', () => {
    const notification = showNotification('Grouping tabs by domain...', 'loading');

    const groupColors = [
      'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey', 'teal'
    ];
    chrome.windows.getAll({populate: true}, (windows) => {
      let totalGroups = 0;
      let processedWindows = 0;
      let hasError = false;

      windows.forEach(win => {
        const domainMap = new Map();
        win.tabs.forEach(tab => {
          try {
            const urlObj = new URL(tab.url);
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

            if (!domainMap.has(groupName)) {
              domainMap.set(groupName, []);
            }
            domainMap.get(groupName).push(tab.id);
          } catch (e) {
            // Ignore tabs with invalid URLs (e.g., chrome://, about:blank)
            // No need to log these errors as they're expected for certain tab types
          }
        });

        // Count potential groups
        let groupsToCreate = 0;
        domainMap.forEach((tabIds) => {
          if (tabIds.length > 1) groupsToCreate++;
        });

        // If no groups to create in this window, mark it as processed
        if (groupsToCreate === 0) {
          processedWindows++;
          if (processedWindows === windows.length) {
            if (totalGroups === 0) {
              notification.update('No domain groups created. Try grouping by names instead.', 'info');
            } else {
              notification.update(`Created ${totalGroups} tab groups by domain.`, hasError ? 'error' : 'success');
            }
            setTimeout(notification.hide, 2000);
          }
          return;
        }

        let colorIdx = 0;
        let groupsCreated = 0;

        domainMap.forEach((tabIds, domain) => {
          if (tabIds.length > 1) {
            const color = groupColors[colorIdx % groupColors.length];
            colorIdx++;

            chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
              if (chrome.runtime.lastError) {
                console.error('Error grouping tabs by domain:', chrome.runtime.lastError.message);
                hasError = true;
              } else {
                chrome.tabGroups.update(groupId, {
                  title: domain,
                  color: color
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('Error naming group:', chrome.runtime.lastError.message);
                    hasError = true;
                  } else {
                    totalGroups++;
                  }

                  // Check if all groups in this window have been processed
                  groupsCreated++;
                  if (groupsCreated === groupsToCreate) {
                    processedWindows++;

                    // If all windows have been processed, show final notification
                    if (processedWindows === windows.length) {
                      notification.update(`Created ${totalGroups} tab groups by domain.`, hasError ? 'error' : 'success');
                      setTimeout(notification.hide, 2000);
                    }
                  }
                });
              }
            });
          }
        });
      });

      // If no windows or all windows were empty, show notification
      if (windows.length === 0) {
        notification.update('No windows found to group tabs.', 'info');
        setTimeout(notification.hide, 2000);
      }
    });
  });

  // Group Tabs by Type (e.g., Social, Work, Shopping, News, Video, Mail, Docs, etc.)
  groupByTypeButton.addEventListener('click', () => {
    const notification = showNotification('Grouping tabs by category...', 'loading');
    // Define type categories and their matching rules (by domain or URL pattern)
    const typeGroups = [
      {
        type: 'Social',
        color: 'pink',
        match: url => /facebook|twitter|x\.com|instagram|linkedin|reddit|tiktok|pinterest|snapchat|whatsapp|telegram|discord|messenger|tumblr|quora|threads\.net/.test(url)
      },
      {
        type: 'Work',
        color: 'blue',
        match: url => /office|microsoft|slack|teams|zoom|asana|notion|trello|work|jira|atlassian|basecamp|monday|clickup|airtable|figma|miro|github|gitlab|bitbucket/.test(url)
      },
      {
        type: 'Shopping',
        color: 'yellow',
        match: url => /amazon|ebay|flipkart|shop|cart|walmart|aliexpress|etsy|bestbuy|target|ikea|wayfair|newegg|homedepot|costco|wish|zalando|shopify|paypal|checkout/.test(url)
      },
      {
        type: 'News',
        color: 'green',
        match: url => /news|cnn|bbc|nytimes|guardian|reuters|washingtonpost|wsj|bloomberg|cnbc|foxnews|huffpost|usatoday|time|economist|apnews|aljazeera|politico|nbcnews|abcnews/.test(url)
      },
      {
        type: 'Video',
        color: 'purple',
        match: url => /youtube|netflix|primevideo|hulu|hotstar|vimeo|twitch|disney|hbomax|peacock|paramount|crunchyroll|dailymotion|tiktok|youku|iqiyi|plex|appletv|vudu|roku/.test(url)
      },
      {
        type: 'Mail',
        color: 'red',
        match: url => /mail\.google|gmail|outlook|hotmail|mail\.yahoo|protonmail|zoho|aol\.com|icloud\.com|mail\.com|gmx|tutanota|fastmail|yandex\.mail|thunderbird/.test(url)
      },
      {
        type: 'Docs',
        color: 'cyan',
        match: url => /docs\.google|drive\.google|sheets\.google|slides\.google|dropbox|onedrive|sharepoint|office365|evernote|onenote|box\.com|gdrive|word|excel|powerpoint|pdf|document/.test(url)
      },
      {
        type: 'Dev',
        color: 'grey',
        match: url => /github|gitlab|bitbucket|stackoverflow|jsfiddle|codepen|replit|codesandbox|vercel|netlify|heroku|aws|azure|gcp|digitalocean|npm|yarn|webpack|babel|react|vue|angular/.test(url)
      },
      {
        type: 'Travel',
        color: 'orange',
        match: url => /booking|airbnb|expedia|hotels|tripadvisor|kayak|skyscanner|trivago|agoda|priceline|hotwire|vrbo|travelocity|orbitz|trip|flight|airline|delta|united|southwest/.test(url)
      },
      {
        type: 'Finance',
        color: 'teal',
        match: url => /bank|chase|wellsfargo|bankofamerica|citibank|capitalone|paypal|venmo|robinhood|fidelity|vanguard|schwab|mint|creditcard|finance|invest|stock|crypto|coinbase|binance/.test(url)
      }
      // Add more as needed
    ];
    chrome.windows.getAll({populate: true}, (windows) => {
      let totalGroups = 0;
      let processedWindows = 0;
      let hasError = false;

      windows.forEach(win => {
        const groupTabs = {};
        win.tabs.forEach(tab => {
          const url = tab.url.toLowerCase();
          typeGroups.forEach(group => {
            if (group.match(url)) {
              if (!groupTabs[group.type]) groupTabs[group.type] = { tabIds: [], color: group.color };
              groupTabs[group.type].tabIds.push(tab.id);
            }
          });
        });

        // Count potential groups
        const typesToGroup = Object.entries(groupTabs).filter(([_, data]) => data.tabIds.length > 1);
        const groupsToCreate = typesToGroup.length;

        // If no groups to create in this window, mark it as processed
        if (groupsToCreate === 0) {
          processedWindows++;
          if (processedWindows === windows.length) {
            if (totalGroups === 0) {
              notification.update('No category groups created.', 'info');
            } else {
              notification.update(`Created ${totalGroups} tab groups by category.`, hasError ? 'error' : 'success');
            }
            setTimeout(notification.hide, 2000);
          }
          return;
        }

        let groupsCreated = 0;

        typesToGroup.forEach(([type, data]) => {
          chrome.tabs.group({ tabIds: data.tabIds }, (groupId) => {
            if (chrome.runtime.lastError) {
              console.error('Error grouping tabs by type:', chrome.runtime.lastError.message);
              hasError = true;

              // Count as processed even if there was an error
              groupsCreated++;
              checkIfDone();
            } else {
              chrome.tabGroups.update(groupId, {
                title: type,
                color: data.color
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error naming group:', chrome.runtime.lastError.message);
                  hasError = true;
                } else {
                  totalGroups++;
                }

                // Count this group as processed
                groupsCreated++;
                checkIfDone();
              });
            }
          });
        });

        // Helper function to check if all groups in this window are done
        function checkIfDone() {
          if (groupsCreated === groupsToCreate) {
            processedWindows++;

            // If all windows have been processed, show final notification
            if (processedWindows === windows.length) {
              notification.update(`Created ${totalGroups} tab groups by category.`, hasError ? 'error' : 'success');
              setTimeout(notification.hide, 2000);
            }
          }
        }
      });

      // If no windows or all windows were empty, show notification
      if (windows.length === 0) {
        notification.update('No windows found to group tabs.', 'info');
        setTimeout(notification.hide, 2000);
      }
    });
  });
});
