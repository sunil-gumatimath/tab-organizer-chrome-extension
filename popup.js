// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const closeDuplicatesButton = document.getElementById('close-duplicates');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const ungroupTabsButton = document.getElementById('ungroup-tabs');
  const muteTabsButton = document.getElementById('mute-tabs');
  const unmuteTabsButton = document.getElementById('unmute-tabs');
  const groupByDomainButton = document.getElementById('group-by-domain');
  const groupByTypeButton = document.getElementById('group-by-keyword'); // Reuse the button for type grouping
  const body = document.body;

  // Load dark mode preference from storage
  chrome.storage.sync.get('darkMode', (data) => {
    if (data.darkMode) {
      body.classList.add('dark-mode');
      darkModeToggle.checked = true;
    }
  });

  // Toggle dark mode and save preference
  darkModeToggle.addEventListener('change', () => {
    if (darkModeToggle.checked) {
      body.classList.add('dark-mode');
      chrome.storage.sync.set({ darkMode: true });
    } else {
      body.classList.remove('dark-mode');
      chrome.storage.sync.set({ darkMode: false });
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
