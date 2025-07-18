// Enhanced popup script with text display and copy functionality
document.addEventListener("DOMContentLoaded", function () {
    const readNowBtn = document.getElementById("readNowBtn");
    const textDisplay = document.getElementById("textDisplay");
    const copyBtn = document.getElementById("copyBtn");
    const clearBtn = document.getElementById("clearBtn");
    const statusDiv = document.getElementById("status");

    let isManualMode = false;
    let currentText = "";

    // Load initial state
    loadStoredText();

    // Event listeners
    readNowBtn.addEventListener("click", triggerAutoRead);
    copyBtn.addEventListener("click", copyTextToClipboard);
    clearBtn.addEventListener("click", clearText);

    // Auto-refresh text display every 2 seconds
    setInterval(loadStoredText, 2000);

    // Remove all manual mode logic and references
    // Loader control functions for popup
    function showPopupLoader(progress, message) {
        const loader = document.getElementById('tesseract-popup-loader');
        const bar = document.getElementById('tesseract-popup-loader-bar');
        const label = document.getElementById('tesseract-popup-loader-label');
        if (loader && bar && label) {
            loader.style.display = '';
            bar.style.width = `${progress}%`;
            label.textContent = `${message} (${progress}%)`;
        }
    }
    function hidePopupLoader() {
        const loader = document.getElementById('tesseract-popup-loader');
        if (loader) loader.style.display = 'none';
    }

    async function triggerAutoRead() {
        updateStatus("Triggering canvas read...", "info");
        readNowBtn.disabled = true;
        showPopupLoader(0, 'Loading Tesseract.js...');
        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            // Listen for progress events from content script
            chrome.runtime.onMessage.addListener(function loaderListener(request, sender, sendResponse) {
                if (request.action === 'tesseractProgress') {
                    showPopupLoader(request.progress, request.status);
                }
                if (request.action === 'tesseractDone' || request.action === 'tesseractError') {
                    hidePopupLoader();
                    chrome.runtime.onMessage.removeListener(loaderListener);
                }
            });
            try {
                await chrome.tabs.sendMessage(tab.id, { action: "autoReadCanvas" });
            } catch (error) {
                // Fallback: inject content script and try again
                if (error && error.message && error.message.includes('Could not establish connection')) {
                    updateStatus('Content script not found. Injecting...', 'info');
                    await injectContentScript(tab.id);
                    // Retry after injection
                    try {
                        await chrome.tabs.sendMessage(tab.id, { action: "autoReadCanvas" });
                        updateStatus("Canvas read triggered after injection! Check for extracted text.", "success");
                        setTimeout(loadStoredText, 1500);
                    } catch (err2) {
                        hidePopupLoader();
                        updateStatus("Failed to trigger canvas read after injection.", "error");
                    }
                    return;
                } else {
                    hidePopupLoader();
                    throw error;
                }
            }
            updateStatus(
                "Canvas read triggered! Check for extracted text.",
                "success"
            );
            setTimeout(loadStoredText, 1500);
        } catch (error) {
            hidePopupLoader();
            console.error("Error triggering auto read:", error);
            updateStatus(
                "Error: Could not read canvas. Make sure you're on a page with canvas elements.",
                "error"
            );
        } finally {
            readNowBtn.disabled = false;
        }
    }

    // Fallback: inject content script and tesseract if missing
    async function injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                files: ["libs/tesseract.min.js", "content.js"],
            });
            updateStatus("Content script injected. Retrying...", "success");
        } catch (error) {
            updateStatus("Cannot inject script on this page type.", "error");
        }
    }

    async function copyTextToClipboard() {
        if (!currentText) return;

        try {
            await navigator.clipboard.writeText(currentText);
            updateStatus("Text copied to clipboard!", "success");

            // Visual feedback
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
                copyBtn.textContent = "Copy Text";
            }, 2000);
        } catch (error) {
            console.error("Error copying text:", error);
            updateStatus("Error copying text to clipboard.", "error");
        }
    }

    function clearText() {
        currentText = "";
        document.getElementById('textContent').textContent =
            'No text extracted yet. Click "Read Canvas Now".';
        textDisplay.classList.add("empty");
        copyBtn.disabled = true;

        // Clear stored text
        chrome.storage.local.remove("extractedText");

        updateStatus("Text cleared.", "info");
    }

    async function loadStoredText() {
        try {
            const result = await chrome.storage.local.get([
                "extractedText",
                "timestamp",
            ]);

            if (result.extractedText && result.extractedText.trim()) {
                currentText = result.extractedText.trim();
                document.getElementById('textContent').textContent = currentText;
                textDisplay.classList.remove("empty");
                copyBtn.disabled = false;

                // Show timestamp if recent (within last 30 seconds)
                const now = Date.now();
                if (result.timestamp && now - result.timestamp < 30000) {
                    const timeAgo = Math.floor((now - result.timestamp) / 1000);
                    updateStatus(
                        `Text extracted ${timeAgo} seconds ago.`,
                        "success"
                    );
                }
            } else {
                if (currentText) {
                    // Only update if we currently have text (to avoid overwriting)
                    clearText();
                }
            }
        } catch (error) {
            console.error("Error loading stored text:", error);
        }
    }

    function updateStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
    }
});
