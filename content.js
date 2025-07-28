class CanvasTextReader {
    constructor() {
      this.worker = null;
      this.lastExtractedText = '';
      this.initializeTesseract();
      this.initializeExtension();
      
      // Make instance globally available
      window.canvasTextReader = this;
    }
  
    async initializeTesseract() {
      try {
        // Send initial progress to popup
        chrome.runtime.sendMessage({ action: 'tesseractProgress', progress: 0, status: 'Loading Tesseract.js...' });
        this.worker = await Tesseract.createWorker({
          corePath: chrome.runtime.getURL('libs/tesseract-core.wasm.js'),
          workerPath: chrome.runtime.getURL('libs/worker.min.js'),
          langPath: chrome.runtime.getURL('libs/'),
          workerBlobURL: true,
          logger: m => {
            if (m.status && m.progress !== undefined) {
              chrome.runtime.sendMessage({ action: 'tesseractProgress', progress: Math.round(m.progress * 100), status: m.status });
            }
          }
        });
        
        await this.worker.loadLanguage('eng');
        await this.worker.initialize('eng');
        chrome.runtime.sendMessage({ action: 'tesseractDone' });
        this.showStatusIndicator('Tesseract.js loaded and ready!');
        console.log('Tesseract.js initialized successfully');
      } catch (error) {
        chrome.runtime.sendMessage({ action: 'tesseractError' });
        this.showStatusIndicator('Failed to load Tesseract.js');
        console.error('Failed to initialize Tesseract:', error);
      }
    }
  
    initializeExtension() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
          sendResponse({ status: 'ready' });
          return true;
        }
        if (request.action === 'getLastText') {
          sendResponse({ text: this.lastExtractedText });
          return true;
        }
        if (request.action === 'autoReadCanvas') {
          this.autoReadCanvas();
          sendResponse({ status: 'started' });
          return true;
        }
      });
    }
  
    async ensureTesseractInitialized() {
      if (!this.worker) {
        await this.initializeTesseract();
      }
    }
  
    async autoReadCanvas() {
      await this.ensureTesseractInitialized();
      const canvases = document.querySelectorAll('canvas');
      
      if (canvases.length === 0) {
        this.showStatusIndicator('No canvas elements found on this page');
        return;
      }
  
      // Find the largest visible canvas (most likely to contain text)
      let targetCanvas = null;
      let maxArea = 0;
  
      canvases.forEach(canvas => {
        const rect = canvas.getBoundingClientRect();
        const area = rect.width * rect.height;
        
        // Check if canvas is visible and has reasonable size
        if (area > maxArea && rect.width > 10 && rect.height > 10 && 
            rect.top < window.innerHeight && rect.left < window.innerWidth) {
          maxArea = area;
          targetCanvas = canvas;
        }
      });
  
      if (targetCanvas) {
        this.showStatusIndicator('Reading text from canvas...');
        await this.handleCanvasClick({ target: targetCanvas });
      } else {
        this.showStatusIndicator('No suitable canvas found for text extraction');
      }
    }
  
    async handleCanvasClick(event) {
      await this.ensureTesseractInitialized();
      const canvas = event.target;
      
      try {
        this.showStatusIndicator('Extracting text with Tesseract.js...');
        
        // Extract text using Tesseract.js
        const extractedText = await this.extractTextFromCanvas(canvas);
        
        if (extractedText && extractedText.trim()) {
          this.lastExtractedText = extractedText.trim();
          
          // Store text for popup access
          chrome.runtime.sendMessage({
            action: 'storeText',
            text: this.lastExtractedText
          });
          
          // Try to auto-fill nearest input field
          const nearestInput = this.findNearestInputField(canvas);
          
          if (nearestInput) {
            this.fillInputField(nearestInput, this.lastExtractedText);
            this.showStatusIndicator(`Text filled: "${this.lastExtractedText}"`);
          } else {
            this.showStatusIndicator('Text extracted! Check extension popup for copy option.');
          }
        } else {
          this.showStatusIndicator('No text detected in canvas');
        }
        
      } catch (error) {
        console.error('Error processing canvas:', error);
        this.showStatusIndicator('Error reading canvas text');
      }
    }
  
    async extractTextFromCanvas(canvas) {
      if (!this.worker) {
        throw new Error('Tesseract worker not initialized');
      }

      // Preprocess: upscale and binarize
      function preprocessCanvas(canvas) {
        const scale = 2; // Upscale for better OCR
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width * scale;
        tempCanvas.height = canvas.height * scale;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

        // Binarize: convert to black and white
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
          const value = avg > 128 ? 255 : 0;
          imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = value;
        }
        ctx.putImageData(imageData, 0, 0);

        return tempCanvas.toDataURL('image/png');
      }

      try {
        // Use preprocessed image for OCR
        const preprocessedImage = preprocessCanvas(canvas);
        console.log('Preprocessed image data URL:', preprocessedImage.slice(0, 100)); // Print first 100 chars
        chrome.runtime.sendMessage({ action: 'tesseractProgress', progress: 0, status: 'Recognizing text...' });
        // Use Tesseract.js to perform OCR with config
        const { data: { text } } = await this.worker.recognize(preprocessedImage, 'eng', {
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&',
          tessedit_pageseg_mode: 7 // PSM_SINGLE_LINE
        });
        chrome.runtime.sendMessage({ action: 'tesseractDone' });
        return text;
      } catch (error) {
        chrome.runtime.sendMessage({ action: 'tesseractError' });
        console.error('Error in OCR processing:', error);
        throw error;
      }
    }
  
    findNearestInputField(canvas) {
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], textarea');
      if (inputs.length === 0) return null;

      // Helper to find the closest common ancestor depth
      function getAncestorDepth(el, target) {
        let depth = 0;
        let current = el;
        while (current && current !== document.body) {
          let ancestor = target;
          let ancestorDepth = 0;
          while (ancestor && ancestor !== document.body) {
            if (current === ancestor) return depth + ancestorDepth;
            ancestor = ancestor.parentElement;
            ancestorDepth++;
          }
          current = current.parentElement;
          depth++;
        }
        return Infinity; // No common ancestor found
      }

      const canvasRect = canvas.getBoundingClientRect();
      const canvasCenter = {
        x: canvasRect.left + canvasRect.width / 2,
        y: canvasRect.top + canvasRect.height / 2
      };

      let bestInput = null;
      let bestPriority = Infinity;
      let minDistance = Infinity;

      inputs.forEach(input => {
        const priority = getAncestorDepth(canvas, input);
        const inputRect = input.getBoundingClientRect();
        const inputCenter = {
          x: inputRect.left + inputRect.width / 2,
          y: inputRect.top + inputRect.height / 2
        };
        const distance = Math.sqrt(
          Math.pow(canvasCenter.x - inputCenter.x, 2) +
          Math.pow(canvasCenter.y - inputCenter.y, 2)
        );

        if (
          priority < bestPriority ||
          (priority === bestPriority && distance < minDistance)
        ) {
          bestPriority = priority;
          minDistance = distance;
          bestInput = input;
        }
      });

      return bestInput;
    }
  
    fillInputField(input, text) {
      input.focus();
      input.value = text;
      
      // Trigger events
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Highlight filled field
      const originalStyle = input.style.backgroundColor;
      input.style.backgroundColor = '#90EE90';
      
      setTimeout(() => {
        input.style.backgroundColor = originalStyle;
      }, 2000);
    }
  
  
    showStatusIndicator(message) {
      this.hideStatusIndicator();
      
      const indicator = document.createElement('div');
      indicator.id = 'canvas-reader-status';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 300px;
      `;
      indicator.textContent = message;
      
      document.body.appendChild(indicator);
      
      setTimeout(() => {
        this.hideStatusIndicator();
      }, 3000);
    }
  
    hideStatusIndicator() {
      const indicator = document.getElementById('canvas-reader-status');
      if (indicator) {
        indicator.remove();
      }
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new CanvasTextReader();
    });
  } else {
    new CanvasTextReader();
  }
  