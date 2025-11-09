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
                // Extract text from all pages up to current page
                let fullText = '';
                let selectionStartPos = -1;
                
                for (let pageNum = 1; pageNum <= currentPageNum; pageNum++) {
                    const page = await pdfDocument.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    
                    // Only search for selection in current and previous page (for performance)
                    if (selectionStartPos === -1 && pageNum >= currentPageNum - 1) {
                        // Clean and normalize both texts the same way
                        const cleanPageText = pageText
                            .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width spaces
                            .replace(/\s+/g, ' ')                    // Normalize whitespace
                            .replace(/\s*-\s*/g, '-')                // Normalize hyphens
                            .trim();
                        const cleanFullTextSoFar = fullText
                            .replace(/[\u200B-\u200D\uFEFF]/g, '')
                            .replace(/\s+/g, ' ')
                            .replace(/\s*-\s*/g, '-');
                        
                        // Try exact match first
                        let pos = cleanPageText.indexOf(normalizedSelection);
                        if (pos !== -1) {
                            selectionStartPos = cleanFullTextSoFar.length + pos;
                            console.log('Found selection (exact) in page', pageNum);
                        } else {
                            // Try with first 30 words
                            const words30 = normalizedSelection.split(' ').slice(0, 30).join(' ');
                            pos = cleanPageText.indexOf(words30);
                            if (pos !== -1) {
                                selectionStartPos = cleanFullTextSoFar.length + pos;
                                console.log('Found selection (30 words) in page', pageNum);
                            } else {
                                // Try with first 10 words as last resort
                                const words10 = normalizedSelection.split(' ').slice(0, 10).join(' ');
                                pos = cleanPageText.indexOf(words10);
                                if (pos !== -1) {
                                    selectionStartPos = cleanFullTextSoFar.length + pos;
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
