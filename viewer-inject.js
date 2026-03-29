// This script is injected into the PDF.js viewer to hijack copy events and extract date
(function() {
    'use strict';

    console.log('Copy hijack script loaded');
    
    // Listen for save requests from parent window
    window.addEventListener('message', async function(event) {
        if (event.data.type === 'SAVE_PDF') {
            console.log('Save PDF request received');
            
            // Trigger PDF.js save function
            if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
                try {
                    // Use the reference short as filename (e.g., "GwH, nr. 123/2024.pdf")
                    const filename = `${event.data.filename}.pdf`;
                    
                    console.log('Saving PDF as:', filename);
                    
                    // Get the PDF data with annotations
                    const data = await window.PDFViewerApplication.pdfDocument.saveDocument();
                    
                    // Create a blob and download it with the custom filename
                    const blob = new Blob([data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    console.log('PDF saved successfully with annotations as:', filename);
                } catch (error) {
                    console.error('Error saving PDF:', error);
                    // Fallback to regular download if save fails
                    try {
                        await window.PDFViewerApplication.download();
                    } catch (fallbackError) {
                        console.error('Fallback download also failed:', fallbackError);
                    }
                }
            }
        }
    });
    
    // Function to extract and send PDF text for date extraction
    async function extractAndSendText(attempt = 1) {
        console.log(`Attempting to extract PDF text (attempt ${attempt}/10)...`);
        try {
            if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
                console.log('PDFViewerApplication found, getting first page...');
                const pdf = window.PDFViewerApplication.pdfDocument;
                const firstPage = await pdf.getPage(1);
                const textContent = await firstPage.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                
                console.log('Extracted text (first 100 chars):', text.substring(0, 100));
                
                // Send first page text to parent for date extraction
                window.parent.postMessage({
                    type: 'PDF_TEXT',
                    text: text
                }, '*');
                console.log('Sent PDF_TEXT message to parent');
            } else {
                throw new Error('PDFViewerApplication not ready yet');
            }
        } catch (e) {
            console.log('PDF not ready:', e.message);
            if (attempt < 10) {
                setTimeout(() => extractAndSendText(attempt + 1), 100);
            } else {
                console.error('Failed to extract PDF text after 10 attempts');
            }
        }
    }
    
    // Start extraction immediately
    extractAndSendText();
    
    // Intercept copy events in the viewer
    document.addEventListener('copy', async function(event) {
        const selection = window.getSelection();
        let selectedText = selection.toString().trim();
        
        if (!selectedText) return;
        
        console.log('Copy event intercepted, selected text:', selectedText.substring(0, 50));
        
        // Prevent default copy immediately
        event.preventDefault();
        
        let pointNumber = '';
        let currentPageNum = 1;
        
        try {
            if (!window.PDFViewerApplication || !window.PDFViewerApplication.pdfDocument) {
                throw new Error('PDF not loaded');
            }
            
            const pdfDocument = window.PDFViewerApplication.pdfDocument;
            currentPageNum = window.PDFViewerApplication.pdfViewer.currentPageNumber;
            
            // Clean the selected text (remove zero-width spaces, normalize whitespace)
            selectedText = selectedText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
            
            // Check if selection starts with "B.X" pattern
            const normalizedSelection = selectedText
                .replace(/\s+/g, ' ')           // Normalize whitespace
                .replace(/\s*-\s*/g, '-');      // Normalize hyphens (remove spaces around them)
            const selectionBPointMatch = normalizedSelection.match(/^B\.\s*(\d+(?:[\s.]*\d+)*)/);
            
            if (selectionBPointMatch) {
                // Selection includes the B. heading itself
                pointNumber = selectionBPointMatch[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
                console.log('Selection starts with B. point:', pointNumber);
            } else {
                // Extract text from pages 1 up to currentPageNum + 1 (extra page as buffer
                // in case the viewer's reported page number is off by one when copying near
                // the top of a page).
                const pagesToExtract = Math.min(pdfDocument.numPages, currentPageNum + 1);
                let fullText = '';
                
                for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
                    const page = await pdfDocument.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' ';
                }
                
                // Normalize full text consistently (same normalization as normalizedSelection)
                const normalizedFullText = fullText
                    .replace(/[\u200B-\u200D\uFEFF]/g, '')
                    .replace(/\s+/g, ' ')
                    .replace(/\s*-\s*/g, '-')
                    .trim();
                
                // Additional normalization that collapses curly/smart quotes with their
                // surrounding spaces into a plain ASCII apostrophe. PDF.js often renders
                // « d'État » as « d ' État » (U+2019 with spaces), while the browser's
                // selection.toString() may return « d'État » (plain apostrophe, no spaces).
                const quoteNormFullText = normalizedFullText
                    .replace(/\s*[\u2018\u2019\u0027]\s*/g, "'")
                    .replace(/\s*[\u201C\u201D\u0022]\s*/g, '"');
                const quoteNormSelection = normalizedSelection
                    .replace(/\s*[\u2018\u2019\u0027]\s*/g, "'")
                    .replace(/\s*[\u201C\u201D\u0022]\s*/g, '"');
                
                // Find the selection in the normalized text (use lastIndexOf to get 
                // the occurrence closest to the current page).
                // Try plain normalized first, then quote-normalized, then word-truncated.
                let selectionStartPos = normalizedFullText.lastIndexOf(normalizedSelection);
                let textForSearch = normalizedFullText;
                
                if (selectionStartPos !== -1) {
                    console.log('Found selection (exact) at position', selectionStartPos);
                } else {
                    // Try with quote-normalized text
                    selectionStartPos = quoteNormFullText.lastIndexOf(quoteNormSelection);
                    textForSearch = quoteNormFullText;
                    if (selectionStartPos !== -1) {
                        console.log('Found selection (quote-normalized) at position', selectionStartPos);
                    }
                }
                if (selectionStartPos === -1) {
                    // Try with first 30 words (quote-normalized)
                    const words30 = quoteNormSelection.split(' ').slice(0, 30).join(' ');
                    selectionStartPos = quoteNormFullText.lastIndexOf(words30);
                    textForSearch = quoteNormFullText;
                    if (selectionStartPos !== -1) {
                        console.log('Found selection (30 words, quote-norm) at position', selectionStartPos);
                    }
                }
                if (selectionStartPos === -1) {
                    // Try with first 10 words as last resort
                    const words10 = quoteNormSelection.split(' ').slice(0, 10).join(' ');
                    selectionStartPos = quoteNormFullText.lastIndexOf(words10);
                    textForSearch = quoteNormFullText;
                    if (selectionStartPos !== -1) {
                        console.log('Found selection (10 words, quote-norm) at position', selectionStartPos);
                    }
                }
                
                console.log('Full text length:', textForSearch.length, 'Selection found at:', selectionStartPos);
                
                if (selectionStartPos !== -1) {
                    const textBeforeSelection = textForSearch.substring(0, selectionStartPos);
                    
                    console.log('Text before selection (last 200 chars):', textBeforeSelection.substring(Math.max(0, textBeforeSelection.length - 200)));
                    
                    // Pattern: B. followed by digits with optional spaces/dots between them
                    // Matches: "B.5", "B. 5", "B.5.1", "B. 5. 1.", etc.
                    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
                    let matches = [];
                    let match;
                    
                    // Cross-reference filter: when "B.X" appears mid-sentence as a
                    // reference to another section (e.g. "comme il est dit en B.1.2"),
                    // it is preceded by characteristic legal connector phrases. We check
                    // the 80 characters before each "B." match against this pattern.
                    // Only full phrases are matched — bare articles like "le", "de", "en"
                    // are NOT matched on their own to avoid false positives on words
                    // ending in those letters (e.g. "préjudicielle ").
                    const XREF_PRECURSOR = /(?:(?:comme|ainsi qu['\u2019]?)?\s*il est (?:dit|expos\u00e9|mentionn\u00e9|indiqu\u00e9|constat\u00e9|pr\u00e9cis\u00e9|rappel\u00e9|relev\u00e9|\u00e9nonc\u00e9|soulign\u00e9|observ\u00e9|expliqu\u00e9)\s+(?:au point|en)\s*$|(?:mentionn\u00e9e?s?|vis\u00e9e?s?|cit\u00e9e?s?|\u00e9nonc\u00e9e?s?|indiqu\u00e9e?s?|expos\u00e9e?s?|constat\u00e9e?s?|d\u00e9crite?s?|pr\u00e9vue?s?|d\u00e9finie?s?|pr\u00e9cis\u00e9e?s?|rappel\u00e9e?s?|relev\u00e9e?s?|soulign\u00e9e?s?|trait\u00e9e?s?|examin\u00e9e?s?|analys\u00e9e?s?)\s+(?:au point|aux points|en|au|sous)\s*$|(?:au(?:x)?\s+points?|les?\s+points?|du\s+point|des?\s+points?|voir\s+(?:le\s+point|les\s+points)?|voy\.\s+(?:le\s+point|les\s+points|\u00e9galement)?|cf\.\s*|aux?\s+points?)\s*$|(?:punt(?:en)?|zie\s+(?:punt|de\s+punt(?:en)?)?|het\s+punt|van\s+punt)\s*$|(?:dit en|est dit en|cit\u00e9 en|vis\u00e9 en|d\u00e9crit en|pr\u00e9vu en|d\u00e9fini en|mentionn\u00e9 en|indiqu\u00e9 en|expos\u00e9 en|constat\u00e9 en|pr\u00e9cis\u00e9 en|rappel\u00e9 en|relev\u00e9 en|soulign\u00e9 en|\u00e9nonc\u00e9 en|observ\u00e9 en|expliqu\u00e9 en|examin\u00e9 en)\s*$|(?:dit (?:au point|aux points|sous|au))\s*$|(?:et (?:en|au point|aux points))\s*$)/i;
                    
                    while ((match = pointPattern.exec(textBeforeSelection)) !== null) {
                        const cleanNumber = match[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
                        
                        // Guard: skip matches that are cross-references, not section headings
                        const preceding = textBeforeSelection.substring(Math.max(0, match.index - 80), match.index);
                        if (XREF_PRECURSOR.test(preceding)) {
                            console.log('Skipping cross-reference B.' + cleanNumber + ' at position', match.index);
                            continue;
                        }
                        
                        matches.push({
                            number: cleanNumber,
                            position: match.index
                        });
                    }
                    
                    console.log('All B. section headings found:', matches.map(m => 'B.' + m.number).join(', '));
                    
                    if (matches.length > 0) {
                        pointNumber = matches[matches.length - 1].number;
                        console.log('Selected point: B.' + pointNumber);
                    }
                }
            }
        } catch (e) {
            console.error('Error extracting point number:', e);
        }
        
        // Send message to parent
        window.parent.postMessage({
            type: 'COPY_TEXT',
            text: selectedText,
            page: currentPageNum,
            point: pointNumber
        }, '*');
        
        console.log('Sent COPY_TEXT message with point:', pointNumber || '(none)');
        
    }, true);
})();
