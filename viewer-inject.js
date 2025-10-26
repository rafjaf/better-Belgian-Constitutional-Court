// This script is injected into the PDF.js viewer to hijack copy events and extract date
(function() {
    'use strict';

    console.log('Copy hijack script loaded');
    
    // Function to extract and send PDF text for date extraction
    async function extractAndSendText() {
        console.log('Attempting to extract PDF text...');
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
                console.log('PDFViewerApplication not ready yet');
            }
        } catch (e) {
            console.error('Error extracting PDF text:', e);
        }
    }
    
    // Try multiple events to catch when PDF is loaded
    document.addEventListener('pagesinit', function() {
        console.log('pagesinit event fired');
        extractAndSendText();
    });
    
    document.addEventListener('pagesloaded', function() {
        console.log('pagesloaded event fired');
        extractAndSendText();
    });
    
    // Also try after a delay as fallback
    setTimeout(function() {
        console.log('Timeout fallback - checking if PDF is loaded');
        if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
            extractAndSendText();
        }
    }, 2000);
    
    // Intercept copy events in the viewer
    document.addEventListener('copy', async function(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
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
            
            // Check if selection starts with "B.X" pattern
            const normalizedSelection = selectedText.replace(/\s+/g, ' ');
            const selectionBPointMatch = normalizedSelection.match(/^B\.\s*(\d+(?:[\s.]*\d+)*)/);
            
            if (selectionBPointMatch) {
                // Selection includes the B. heading itself
                pointNumber = selectionBPointMatch[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
                console.log('Selection starts with B. point:', pointNumber);
            } else {
                // Extract text from all pages up to current page
                let fullText = '';
                let selectionStartPos = -1;
                
                for (let pageNum = 1; pageNum <= currentPageNum; pageNum++) {
                    const page = await pdfDocument.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    
                    // Only search for selection in current and previous page (for performance)
                    if (selectionStartPos === -1 && pageNum >= currentPageNum - 1) {
                        const normalizedPageText = pageText.replace(/\s+/g, ' ');
                        const normalizedFullTextSoFar = fullText.replace(/\s+/g, ' ');
                        
                        // Try exact match first
                        let pos = normalizedPageText.indexOf(normalizedSelection);
                        if (pos !== -1) {
                            selectionStartPos = normalizedFullTextSoFar.length + pos;
                            console.log('Found selection (exact) in page', pageNum);
                        } else {
                            // Try with first 30 words
                            const words30 = normalizedSelection.split(' ').slice(0, 30).join(' ');
                            pos = normalizedPageText.indexOf(words30);
                            if (pos !== -1) {
                                selectionStartPos = normalizedFullTextSoFar.length + pos;
                                console.log('Found selection (30 words) in page', pageNum);
                            } else {
                                // Try with first 10 words as last resort
                                const words10 = normalizedSelection.split(' ').slice(0, 10).join(' ');
                                pos = normalizedPageText.indexOf(words10);
                                if (pos !== -1) {
                                    selectionStartPos = normalizedFullTextSoFar.length + pos;
                                    console.log('Found selection (10 words) in page', pageNum);
                                }
                            }
                        }
                    }
                    
                    fullText += pageText + ' ';
                }
                
                console.log('Full text length:', fullText.length, 'Selection found at:', selectionStartPos);
                
                if (selectionStartPos !== -1) {
                    // Normalize and search for B. points
                    const normalizedFullText = fullText.replace(/\s+/g, ' ');
                    const textBeforeSelection = normalizedFullText.substring(0, selectionStartPos);
                    
                    console.log('Text before selection (last 200 chars):', textBeforeSelection.substring(Math.max(0, textBeforeSelection.length - 200)));
                    
                    // Pattern: B. followed by digits with optional spaces/dots between them
                    // Matches: "B.5", "B. 5", "B.5.1", "B. 5. 1.", etc.
                    const pointPattern = /\bB\.\s*(\d+(?:[\s.]*\d+)*)/g;
                    let matches = [];
                    let match;
                    
                    while ((match = pointPattern.exec(textBeforeSelection)) !== null) {
                        const cleanNumber = match[1].replace(/\s+/g, '').replace(/\.+/g, '.').replace(/\.$/, '');
                        matches.push({
                            number: cleanNumber,
                            position: match.index
                        });
                    }
                    
                    // If we only found B.1.x, also look for standalone numbers
                    if (matches.length > 0 && !matches.some(m => parseInt(m.number) > 1)) {
                        console.log('Only found B.1.x, searching for standalone section numbers');
                        const recentText = textBeforeSelection.substring(Math.max(0, textBeforeSelection.length - 2000));
                        const offset = Math.max(0, textBeforeSelection.length - 2000);
                        const standalonePattern = /\b(\d+)\.\s/g;
                        let standaloneMatch;
                        
                        while ((standaloneMatch = standalonePattern.exec(recentText)) !== null) {
                            const num = parseInt(standaloneMatch[1]);
                            if (num >= 2 && num <= 20) {
                                matches.push({
                                    number: standaloneMatch[1],
                                    position: offset + standaloneMatch.index
                                });
                            }
                        }
                        
                        // Sort by position
                        matches.sort((a, b) => a.position - b.position);
                    }
                    
                    console.log('All B. points found:', matches.map(m => 'B.' + m.number).join(', '));
                    
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
