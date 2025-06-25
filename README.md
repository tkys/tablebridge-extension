# CSV Export for AI Chats

Export CSV/TSV data from AI platforms to spreadsheets with one click.

WebページのCSV/TSVコードブロックをGoogleスプレッドシート、クリップボード、Excelファイルに簡単に転送するChrome拡張機能です。

## 🚀 Features

- **Multi-Platform Support**: ChatGPT, Gemini, Gemini AI Studio (PWA), Claude
- **Hover-Triggered UI**: Lightweight detection without performance impact
- **Multiple Export Options**: Google Sheets, Clipboard (TSV), Excel/CSV download
- **Smart Detection**: Automatic CSV/TSV format recognition
- **Cross-Platform Compatibility**: Works across all major AI platforms

## 📋 Supported Formats

- **CSV**: Comma-separated values in code blocks
- **TSV**: Tab-separated values in code blocks  
- **Language Classes**: `language-csv`, `language-tsv`
- **Content Analysis**: Automatic pattern detection

## 🎯 How to Use

1. **Hover** over CSV/TSV code blocks (800ms delay)
2. **Choose** from floating action buttons:
   - 📊 Export to Google Sheets
   - 📋 Copy as TSV (Excel-compatible)
   - 📥 Download as CSV file
3. **Auto-hide** after 1500ms when mouse leaves

## 🛠 Technical Specifications

### Architecture
- **Event-Driven**: User-initiated hover actions
- **Scroll-Following**: UI moves with content
- **PWA Compatible**: Works in standalone apps
- **Extension Context Safe**: Manifest v3 compliant

### File Structure
```
├── manifest.json          # Extension configuration
├── background.js           # Service Worker (API handling)
├── content_script.js       # Main logic (hover-triggered)
├── style.css              # Floating UI styles
├── popup.html/popup.js     # Settings interface
└── icons/                  # Extension icons
```

### Detection Algorithm
- **Target Elements**: `code`, `pre` elements only
- **Language Class Priority**: Explicit `language-csv/tsv`
- **Content Validation**: Consistent comma/tab patterns
- **False Positive Prevention**: Minimum content requirements

## 🌐 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| ChatGPT | ✅ | chat.openai.com, chatgpt.com |
| Gemini | ✅ | gemini.google.com |
| Gemini AI Studio | ✅ | aistudio.google.com (browser + PWA) |
| Claude | ✅ | claude.ai |

## 📦 Installation

1. Download or clone this repository
2. Open Chrome Extensions (`chrome://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

## 🔧 Development

### v1.0 → v2.0 Improvements
- **No Polling**: Eliminated heavy MutationObserver + setInterval
- **Stable UI Control**: Predictable show/hide timing
- **Performance**: Significant resource usage reduction
- **Precision**: Focused CSV/TSV detection only

### Known Limitations
- HTML table elements not supported (intentional)
- Large datasets (10k+ rows) performance untested
- Complex CSV escaping (newlines in cells) limited support

## 🚦 Development Status

### Completed ✅
- hover-triggered architecture
- Multi-platform support (ChatGPT, Gemini, Claude)
- PWA compatibility fixes
- Extension context validation
- Service Worker data: URL downloads

### User Feedback & Future Improvements
Based on real usage patterns:
1. **Header Duplication**: Option to skip headers on consecutive exports
2. **Export Destination Visibility**: Show current spreadsheet info
3. **Multiple Destinations**: Quick switching between spreadsheets

## 📄 Legal

- **License**: MIT License - see [LICENSE](LICENSE) file for details
- **Privacy Policy**: [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
- **Terms of Service**: [TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md)

---

**Development Log**: 2024/06/24 - CSV Export for AI Chats v2.0 released with hover-triggered architecture and multi-platform support.
