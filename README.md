# Read Canvas

<div style="display: flex; align-items: center; gap: 16px;">
  <img src="icons/icon128.png" alt="Read Canvas Icon" width="64" height="64" />
  <div>
    <b>Read Canvas</b> is a Chrome extension that reads text from HTML canvas elements using <a href="https://tesseract.projectnaptha.com/">Tesseract.js</a> OCR and automatically fills the nearest input field, making it easy to extract and use text from images, CAPTCHAs, or custom-drawn text on web pages.
  </div>
</div>

---

## Features

- **One-click OCR**: Extracts text from the largest visible canvas on the page with a single click.
- **Smart Auto-fill**: Automatically finds and fills the nearest text input, email, password, search field, or textarea with the recognized text. The `findNearestInputField` method uses DOM proximity (ancestor depth) and visual proximity (Euclidean distance) to intelligently select the most relevant input field.
- **Popup UI**: View, copy, or clear the last extracted text from the extension popup.
- **Status feedback**: Visual status indicator overlays on the page during OCR and auto-fill actions.
- **No server required**: All OCR is performed locally in your browser using Tesseract.js WebAssembly.

---

## How It Works

1. **Triggering OCR**: Click the extension icon or the "Read Canvas Now" button in the popup. The extension scans for visible `<canvas>` elements and selects the largest one.
2. **Text Extraction**: The selected canvas is converted to an image and processed by Tesseract.js, which recognizes and extracts any text content.
3. **Auto-Fill**: The extension attempts to find the most relevant input field near the canvas and fills it with the recognized text.
4. **Popup Access**: The last extracted text is stored and can be viewed, copied, or cleared from the popup.



## Installation & Usage

1. **Clone the repository**:
   ```bash
   git clone git@github.com:k-e-s-h-a-v/read-canvas.git
   cd read-canvas
   ```

2. **Install**: Load the extension in Chrome via `chrome://extensions` (Developer Mode > Load unpacked > select this folder).
3. **Usage**:
   - Navigate to a page with a canvas (e.g., CAPTCHA, drawing, or game).
   - Click the extension icon or use the popup to trigger OCR.
   - The recognized text will be auto-filled into the nearest input field, and also available in the popup for copying.

---

## Project Structure

- `background.js` – Handles extension icon clicks and message passing.
- `content.js` – Main logic for canvas detection, OCR, auto-fill, and status overlays.
- `popup.html`, `popup.js`, `popup.css` – Extension popup UI for manual OCR, viewing, copying, and clearing text.
- `icons/` – Extension icons (main icon: `icons/icon128.png`).
- `libs/` – Contains Tesseract.js and language data (do not modify; see [Tesseract.js](https://tesseract.projectnaptha.com/) for details).
- `manifest.json` – Chrome extension manifest (permissions, scripts, resources).

---

## Known Issues

- **Symbol Detection**: Special symbols and characters may not be detected correctly by the OCR engine.
- **Case Sensitivity**: The OCR engine sometimes gets confused between capital and lowercase letters.

---

## Credits & Acknowledgements

- **OCR Engine**: [Tesseract.js](https://tesseract.projectnaptha.com/) ([GitHub](https://github.com/naptha/tesseract.js)) – Apache-2.0 License


---

## License

This project is licensed under the MIT License for original code. However, it bundles and depends on Tesseract.js, which is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details and attribution.
