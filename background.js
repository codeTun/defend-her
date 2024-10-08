chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.clear();
});

chrome.tabs.onCreated.addListener((tab) => {
    chrome.storage.local.set({ [`tab_${tab.id}`]: { blurEnabled: false, userWords: [] } });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_${tabId}`);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabId = activeInfo.tabId;
    chrome.storage.local.get(`tab_${tabId}`, (result) => {
        const { blurEnabled, userWords } = result[`tab_${tabId}`] || { blurEnabled: false, userWords: [] };
        chrome.tabs.sendMessage(tabId, { action: blurEnabled ? 'blur' : 'unblur', userWords });
    });
});

chrome.runtime.onMessage.addListener((message, sender) => {
    const tabId = sender.tab.id;
    if (message.action === 'toggleBlur') {
        chrome.storage.local.get(`tab_${tabId}`, (result) => {
            const currentState = result[`tab_${tabId}`] || { blurEnabled: false, userWords: [] };
            const blurEnabled = !currentState.blurEnabled;
            chrome.storage.local.set({ [`tab_${tabId}`]: { ...currentState, blurEnabled } });
            chrome.tabs.sendMessage(tabId, { action: blurEnabled ? 'blur' : 'unblur', userWords: currentState.userWords });
        });
    }
});
