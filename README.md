# Constitutional Court - Enhanced Viewer

Chrome extension for optimized consultation of Belgian Constitutional Court judgments.

## ✨ Features

### Full PDF.js Viewer
- **Professional interface** with complete toolbar (zoom, search, navigation, rotation, presentation mode)
- **Annotation and highlighting**: ability to highlight text and save annotated PDFs
- **In-document search** (Ctrl/Cmd+F)
- **Thumbnails and bookmarks** for quick navigation
- **Print and download** with advanced options

### Automatic Reference Detection
- **Smart extraction** of date from PDF content
- **Bilingual support**: French (fr.const-court.be) and Dutch (nl.const-court.be)
- **Historical recognition**: automatically uses "C.A." / "Arbitragehof" for judgments before May 2007
- **Formatted display**: 
  - French: `C.C., 23 octobre 2025, n° 135/2025`
  - Dutch: `GwH 19 juli 2007, nr. 106/2007`

### Enhanced Copy with Automatic Citation
- **B paragraph detection**: automatically identifies the B point where the copied passage comes from
- **Automatic formatting**: `"selected text" (C.C., 23 octobre 2025, n° 135/2025, point B.5)`
- **Multilingual handling**: adapts "point B." / "punt B." according to language
- **HTML and plain text copy** for maximum compatibility

### Smart Download
- **Automatic naming**: `C.C. 2025-135.pdf` or `Arbitragehof 2006-42.pdf`
- **Dedicated button** in top banner

## 🚀 Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the extension folder

The extension will automatically activate on:
- `https://fr.const-court.be/public/f/*`
- `https://nl.const-court.be/public/n/*`

## 🎯 Usage

1. **Open a judgment** on the Constitutional Court website
2. **View** the PDF with all PDF.js viewer features
3. **Copy** a passage: the complete reference with B point will be automatically added
4. **Download**: the file will have a formatted and standardized name

## 📋 Example

Judgment: `https://fr.const-court.be/public/f/2025/2025-135f.pdf`

→ Displayed banner: **C.C., 23 octobre 2025, n° 135/2025**

→ Copy excerpt from point B.5: `"[text]" (C.C., 23 octobre 2025, n° 135/2025, point B.5)`

→ Download: `C.C. 2025-135.pdf`

## 🛠️ Technologies

- **PDF.js v4.9.155** by Mozilla Foundation (https://mozilla.github.io/pdf.js/)
- Developed with assistance from **Claude Sonnet 4** (Anthropic)

## 📄 Technical Structure

```
cour-constitutionnelle-extension/
├── manifest.json          # Chrome Extension configuration (Manifest V3)
├── content.js             # Main script
├── viewer-inject.js       # Copy interception and B point detection
├── build/                 # PDF.js core and worker
└── web/                   # Complete PDF.js viewer
```

## 📝 Credits

- **Author**: Rafael Jafferali
- **PDF.js**: Mozilla Foundation (Apache License 2.0)
- **AI Assistant**: Claude Sonnet 4 (Anthropic)
- **Date**: October 2025
