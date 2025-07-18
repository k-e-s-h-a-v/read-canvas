// Background script for handling extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
    try {
      // Inject and execute the canvas reading functionality
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: triggerCanvasRead
      });
    } catch (error) {
      console.error('Error executing script:', error);
    }
  });
  
  // Function to be injected into the page
  function triggerCanvasRead() {
    // Check if canvasTextReader exists and trigger auto-read
    if (window.canvasTextReader) {
      window.canvasTextReader.autoReadCanvas();
    } else {
      console.log('Canvas Text Reader not initialized');
    }
  }
  
  // Handle messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'storeText') {
      // Store the extracted text for popup access
      chrome.storage.local.set({ 
        extractedText: request.text,
        timestamp: Date.now()
      });
      sendResponse({ status: 'success' });
    }
  });
  