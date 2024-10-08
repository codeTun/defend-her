let defaultWords = [];
let blurEnabled = false;
let userWords = [];

// Load default words from words.json
fetch(chrome.runtime.getURL('words.json'))
    .then((response) => response.json())
    .then((data) => {
        defaultWords = data.words || [];
        initializeBlur(); // Initialize blur after default words are loaded
    })
    .catch((error) => console.error('Error loading default words:', error));

// Initialize blur whenever the page is loaded or a new message is received
function initializeBlur() {
    chrome.storage.local.get(null, (result) => {
        // Loop through all keys to find the current tab's state
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                const tabId = `tab_${tabs[0].id}`;
                const tabState = result[tabId] || { blurEnabled: false, userWords: [] };
                blurEnabled = tabState.blurEnabled;
                userWords = tabState.userWords;

                if (blurEnabled) {
                    applyBlur();
                }
            }
        });
    });
}

// Apply blur effect whenever the page is loaded
document.addEventListener('DOMContentLoaded', initializeBlur);

// Set up MutationObserver for dynamic content changes with debounce
let blurTimeout;
const observer = new MutationObserver((mutations) => {
    if (blurEnabled) {
        clearTimeout(blurTimeout);
        blurTimeout = setTimeout(() => {
            applyBlur(); // Reapply blur to new content after all mutations are done
        }, 300); // Debounce time
    }
});

// Start observing the document body for changes
observer.observe(document.body, {
    childList: true,
    subtree: true,
});

// Listen to messages from the popup
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'blur') {
        blurEnabled = true;
        userWords = message.userWords;
        applyBlur();
    } else if (message.action === 'unblur') {
        blurEnabled = false;
        removeBlur();
    } else if (message.action === 'blurWord') {
        userWords.push(message.word);
        applyBlur();
    } else if (message.action === 'unblurWord') {
        userWords = userWords.filter((w) => w !== message.word);
        removeSpecificBlur(message.word);
    } else if (message.action === 'unblurAllUserWords') {
        removeSpecificBlur(message.userWords);
    }
});

function applyBlur() {
    const allWords = [...new Set([...defaultWords, ...userWords])];
    traverseAndBlur(document.body, allWords);
}

function removeBlur() {
    const allWords = [...new Set([...defaultWords, ...userWords])];
    traverseAndRestore(document.body, allWords);
}

function removeSpecificBlur(words) {
    if (Array.isArray(words)) {
        words.forEach((word) => traverseAndRestore(document.body, [word]));
    } else {
        traverseAndRestore(document.body, [words]);
    }
}

function traverseAndBlur(node, words) {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        words.forEach((word) => {
            const regex = new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'gi');
            const newText = text.replace(regex, (match) => `<span class="blurred-word" data-original="${match}">████</span>`);
            if (newText !== text) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newText;
                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                node.replaceWith(fragment);
            }
        });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
            node.childNodes.forEach((child) => traverseAndBlur(child, words));
        }
    }
}

function traverseAndRestore(node, words) {
    if (node.nodeType === Node.TEXT_NODE) {
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('blurred-word')) {
        const originalText = node.getAttribute('data-original');
        if (words.some((word) => originalText && originalText.match(new RegExp(`\\b(${escapeRegExp(word)})\\b`, 'gi')))) {
            node.replaceWith(document.createTextNode(originalText));
        }
    } else if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
        node.childNodes.forEach((child) => traverseAndRestore(child, words));
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
