// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const closeDuplicatesButton = document.getElementById('close-duplicates');
  const ungroupTabsButton = document.getElementById('ungroup-tabs');
  const muteTabsButton = document.getElementById('mute-tabs');
  const unmuteTabsButton = document.getElementById('unmute-tabs');
  const groupByDomainButton = document.getElementById('group-by-domain');
  const groupByTypeButton = document.getElementById('group-by-keyword'); // Reuse the button for type grouping
  const tabSearchInput = document.getElementById('tab-search');
  const clearSearchButton = document.getElementById('clear-search');
  const searchResultsContainer = document.getElementById('search-results');
  const body = document.body;

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

      // Create favicon element
      const favicon = document.createElement('img');
      favicon.className = 'favicon';
      favicon.src = tab.favIconUrl || 'icons/icon16.png';
      favicon.onerror = () => { favicon.src = 'icons/icon16.png'; };

      // Create title element with highlighted match
      const title = document.createElement('div');
      title.className = 'tab-title';
      title.innerHTML = highlightMatch(tab.title, query);

      // Add elements to result item
      resultItem.appendChild(favicon);
      resultItem.appendChild(title);

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
    tabSearchInput.value = '';
    searchResultsContainer.style.display = 'none';
    clearSearchButton.style.display = 'none';
    tabSearchInput.focus();
  });

  // Hide clear button initially
  clearSearchButton.style.display = 'none';

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
          console.log(`Closed ${tabsToClose.length} duplicate tabs.`);
        });
      } else {
        console.log('No duplicate tabs found to close.');
      }
    });
  });

  // Ungroup All Tabs
  ungroupTabsButton.addEventListener('click', () => {
    chrome.tabs.query({}, (tabs) => {
      const tabIds = tabs.map(tab => tab.id);
      chrome.tabs.ungroup(tabIds, () => {
        console.log('All tabs ungrouped.');
      });
    });
  });

  // Mute All Tabs
  muteTabsButton.addEventListener('click', () => {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
        if (!tab.mutedInfo || !tab.mutedInfo.muted) {
          chrome.tabs.update(tab.id, {muted: true});
        }
      });
    });
  });

  // Unmute All Tabs
  unmuteTabsButton.addEventListener('click', () => {
    chrome.tabs.query({currentWindow: true}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.mutedInfo && tab.mutedInfo.muted) {
          chrome.tabs.update(tab.id, {muted: false});
        }
      });
    });
  });

  // Group Tabs by Domain
  groupByDomainButton.addEventListener('click', () => {
    const groupColors = [
      'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey', 'teal'
    ];
    chrome.windows.getAll({populate: true}, (windows) => {
      windows.forEach(win => {
        const domainMap = new Map();
        win.tabs.forEach(tab => {
          try {
            const urlObj = new URL(tab.url);
            let domain = urlObj.hostname;
            // Remove 'www.' prefix if present
            if (domain.startsWith('www.')) domain = domain.substring(4);
            // Remove '.com' suffix if present
            if (domain.endsWith('.com')) domain = domain.slice(0, -4);
            // Special case for Gmail and other Google services
            if (domain === 'mail.google') domain = 'gmail';
            if (domain === 'drive.google') domain = 'gdrive';
            if (domain === 'docs.google') domain = 'gdocs';
            if (!domainMap.has(domain)) {
              domainMap.set(domain, []);
            }
            domainMap.get(domain).push(tab.id);
          } catch (e) {
            // Ignore tabs with invalid URLs (e.g., chrome://, about:blank)
          }
        });
        let colorIdx = 0;
        domainMap.forEach((tabIds, domain) => {
          if (tabIds.length > 1) {
            const color = groupColors[colorIdx % groupColors.length];
            colorIdx++;
            chrome.tabs.group({ tabIds: tabIds }, (groupId) => {
              if (chrome.runtime.lastError) {
                console.error('Error grouping tabs by domain:', chrome.runtime.lastError.message);
              } else {
                chrome.tabGroups.update(groupId, {
                  title: domain,
                  color: color
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('Error naming group:', chrome.runtime.lastError.message);
                  } else {
                    console.log(`Grouped tabs by domain in window ${win.id} with groupId: ${groupId}, name: ${domain}, color: ${color}`);
                  }
                });
              }
            });
          }
        });
      });
    });
  });

  // Group Tabs by Type (e.g., Social, Work, Shopping, News, Video, Mail, Docs, etc.)
  groupByTypeButton.addEventListener('click', () => {
    // Define type categories and their matching rules (by domain or URL pattern)
    const typeGroups = [
      { type: 'Social', color: 'pink', match: url => /facebook|twitter|instagram|linkedin|reddit|tiktok/.test(url) },
      { type: 'Work', color: 'blue', match: url => /office|slack|teams|zoom|asana|notion|trello|work|jira/.test(url) },
      { type: 'Shopping', color: 'yellow', match: url => /amazon|ebay|flipkart|shop|cart|walmart|aliexpress/.test(url) },
      { type: 'News', color: 'green', match: url => /news|cnn|bbc|nytimes|guardian|reuters/.test(url) },
      { type: 'Video', color: 'purple', match: url => /youtube|netflix|primevideo|hulu|hotstar|vimeo|twitch/.test(url) },
      { type: 'Mail', color: 'red', match: url => /mail\.google|outlook|mail\.yahoo|protonmail|zoho/.test(url) },
      { type: 'Docs', color: 'cyan', match: url => /docs\.google|drive\.google|dropbox|onedrive/.test(url) },
      // Add more as needed
    ];
    chrome.windows.getAll({populate: true}, (windows) => {
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
        Object.entries(groupTabs).forEach(([type, data]) => {
          if (data.tabIds.length > 1) {
            chrome.tabs.group({ tabIds: data.tabIds }, (groupId) => {
              if (chrome.runtime.lastError) {
                console.error('Error grouping tabs by type:', chrome.runtime.lastError.message);
              } else {
                chrome.tabGroups.update(groupId, {
                  title: type,
                  color: data.color
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('Error naming group:', chrome.runtime.lastError.message);
                  } else {
                    console.log(`Grouped tabs by type '${type}' in window ${win.id} with groupId: ${groupId}`);
                  }
                });
              }
            });
          }
        });
      });
    });
  });
});
