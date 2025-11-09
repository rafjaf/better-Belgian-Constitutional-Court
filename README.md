# Constitutional Court - Enhanced Viewer

Chrome extension for optimized consultation of Belgian Constitutional Court judgments.

![[Screenshot.png]]

## ✨ Features

### Full PDF.js Viewer
- **Professional interface** with complete toolbar (zoom, search, navigation, rotation, presentation mode)
- **Annotation and highlighting**: ability to highlight text and save annotated PDFs
- **In-document search** (Ctrl/Cmd+F)
- **Thumbnails and bookmarks** for quick navigation
- **Print and download** with advanced options

### Automatic Reference Detection
- **Smart extraction** of the judgement date from PDF content
- **Bilingual support**: French (fr.const-court.be) and Dutch (nl.const-court.be)
- **Historical recognition**: automatically uses "C.A." / "Arbitragehof" for judgments before May 2007
- **Formatted display**: 
  - French: `C.C., 23 octobre 2025, n° 135/2025`
  - Dutch: `GwH 19 juli 2007, nr. 106/2007`

### Enhanced Copy with Automatic Citation
- **B paragraph detection**: automatically identifies the B point where the copied passage comes from
- **Automatic formatting**: text copied to clipboard will be formatted as `"selected text" (C.C., 23 octobre 2025, n° 135/2025, point B.5)`
- **Multilingual handling**: adapts "point B." / "punt B." according to language
- **HTML and plain text copy** for maximum compatibility

### Smart Download
- **Automatic naming**: `C.C. 2025-135.pdf` or `Arbitragehof 2006-42.pdf`
- **Dedicated button** in top banner
- **Annotations included** in the downloaded file

## 🎯 Usage

The extension will automatically activate on:
- `https://fr.const-court.be/public/f/*`
- `https://nl.const-court.be/public/n/*`

1. **Open a judgment** on the Constitutional Court website
2. **View** the PDF with all PDF.js viewer features
3. **Copy** a passage: the complete reference with B point will be automatically added
4. **Download**: the file will have a formatted and standardized name

## Treatment of personal data
No personal data whatsoever is treated by this extension.

## 📝 Credits

- **Author**: Rafaël Jafferali
- **PDF.js**: Mozilla Foundation (Apache License 2.0)
- **Vibe-coded** with the help of Claude Sonnet 4.5 (Anthropic)
