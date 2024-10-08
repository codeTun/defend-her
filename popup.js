document.addEventListener('DOMContentLoaded', () => {
    const toggleBlur = document.getElementById('toggleBlur');
    const toggleText = document.getElementById('toggle-text');
    const wordInput = document.getElementById('wordInput');
    const addWordButton = document.getElementById('addWordButton');
    const wordList = document.getElementById('wordList');
    const wordListContainer = document.getElementById('wordListContainer');
    const extensionOffMessage = document.getElementById('extensionOffMessage');
    const removeAllButton = document.getElementById('removeAllButton');

    // Load default words from words.json (These words will not be shown to the user)
    let defaultWords = [];
    fetch(chrome.runtime.getURL('words.json'))
        .then((response) => response.json())
        .then((data) => {
            defaultWords = data.words || [];
        })
        .catch((error) => console.error('Error loading default words:', error));

    // Initialize the extension status for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.storage.local.get(`tab_${tabId}`, (result) => {
            const { blurEnabled, userWords } = result[`tab_${tabId}`] || { blurEnabled: false, userWords: [] };
            toggleBlur.checked = blurEnabled;
            toggleText.textContent = blurEnabled ? 'Disable Blur' : 'Enable Blur';
            updateWordList(userWords);
            toggleWordControls(blurEnabled);
            if (blurEnabled) {
                sendMessageToContentScript({ action: 'blur', userWords: [...defaultWords, ...userWords] });
            }
        });
    });

    // Toggle blur functionality for the current tab
    toggleBlur.addEventListener('change', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            chrome.storage.local.get(`tab_${tabId}`, (result) => {
                const currentState = result[`tab_${tabId}`] || { blurEnabled: false, userWords: [] };
                const blurEnabled = toggleBlur.checked;
                chrome.storage.local.set({ [`tab_${tabId}`]: { ...currentState, blurEnabled } }, () => {
                    if (blurEnabled) {
                        sendMessageToContentScript({ action: 'blur', userWords: [...defaultWords, ...currentState.userWords] });
                    } else {
                        sendMessageToContentScript({ action: 'unblur' });
                    }
                    toggleWordControls(blurEnabled);
                    toggleText.textContent = blurEnabled ? 'Disable Blur' : 'Enable Blur';
                });
            });
        });
    });

    // Add word to blur list
    addWordButton.addEventListener('click', addWordToList);
    wordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addWordToList();
        }
    });

    removeAllButton.addEventListener('click', removeAllWords);

    function addWordToList() {
        const word = wordInput.value.trim();
        if (!word) {
            // Show alert if the input is empty
            alert("Enter a word to blur it.");
            return;
        }

        if (word && !defaultWords.includes(word.toLowerCase())) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0].id;
                chrome.storage.local.get(`tab_${tabId}`, (result) => {
                    const userWords = result[`tab_${tabId}`]?.userWords || [];
                    if (!userWords.includes(word)) {
                        userWords.push(word);
                        chrome.storage.local.set({ [`tab_${tabId}`]: { ...result[`tab_${tabId}`], userWords } }, () => {
                            updateWordList(userWords);
                            wordInput.value = '';
                            sendMessageToContentScript({ action: 'blur', userWords: [...defaultWords, ...userWords] });
                        });
                    }
                });
            });
        } else {
            alert("This word is already blurred or is in the default list.");
            wordInput.value = ''; // Clear input after alert
        }
    }

    function updateWordList(words) {
        wordList.innerHTML = '';
        words.forEach((word) => {
            const li = document.createElement('li');
            li.classList.add('word-list-item');
            li.textContent = word;

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-button';
            removeButton.innerHTML = '<i class="fas fa-trash"></i>';
            removeButton.addEventListener('click', () => {
                removeWord(word);
            });

            li.appendChild(removeButton);
            wordList.appendChild(li);
        });

        wordList.style.overflowY = words.length > 2 ? 'auto' : 'hidden';
    }

    function removeWord(word) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            chrome.storage.local.get(`tab_${tabId}`, (result) => {
                const userWords = result[`tab_${tabId}`]?.userWords || [];
                const updatedWords = userWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
                chrome.storage.local.set({ [`tab_${tabId}`]: { ...result[`tab_${tabId}`], userWords: updatedWords } }, () => {
                    updateWordList(updatedWords);
                    sendMessageToContentScript({ action: 'unblurWord', word });
                });
            });
        });
    }

    function removeAllWords() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            chrome.storage.local.get(`tab_${tabId}`, (result) => {
                const userWords = result[`tab_${tabId}`]?.userWords || [];
                
                // Update storage to remove all user-added words
                chrome.storage.local.set({ [`tab_${tabId}`]: { ...result[`tab_${tabId}`], userWords: [] } }, () => {
                    updateWordList([]);
                    // Unblur all user-added words immediately
                    userWords.forEach((word) => {
                        sendMessageToContentScript({ action: 'unblurWord', word });
                    });
                });
            });
        });
    }

    function sendMessageToContentScript(message, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message, () => {
                    if (callback) {
                        callback(); // Call the callback after the message is processed
                    }
                });
            }
        });
    }

    function toggleWordControls(isEnabled) {
        wordListContainer.style.display = isEnabled ? 'block' : 'none';
        extensionOffMessage.style.display = isEnabled ? 'none' : 'block';
    }
});
