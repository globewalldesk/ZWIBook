document.addEventListener('DOMContentLoaded', async () => {
    const bookContentDiv = document.getElementById('book-content');
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    const currentBookId = bookId;

    const bookshelfAddRemove = document.querySelector('#bookshelfAddRemove');
    bookshelfAddRemove.style.display = 'flex';

    const bookshelfData = await window.electronAPI.requestBookshelfData();
    
    const currentBookMetadata = JSON.parse(localStorage.getItem('currentBookMetadata'));
    
    async function toggleSaved(bookId) {
        const bookshelfData = await window.electronAPI.requestBookshelfData();
        const icon = bookshelfAddRemove.querySelector('img');
        if (bookshelfData.savedBooks.some(book => book.PG_ID === currentBookId)) {
            bookshelfAddRemove.classList.add("bi-journal-minus");
            bookshelfAddRemove.classList.remove("bi-journal-plus");
            icon.src = "images/icons/remove-book.svg";
        } else {
            bookshelfAddRemove.classList.remove("bi-journal-minus");
            bookshelfAddRemove.classList.add("bi-journal-plus");
            icon.src = "images/icons/add-book.svg";
        }
    }
    toggleSaved(bookId);

    bookshelfAddRemove.addEventListener("click", async () => {
        const action = bookshelfAddRemove.classList.contains('bi-journal-plus') ? 'addSaved' : 'removeSaved';
        await window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: action });
        await toggleSaved(currentBookId);
    });

    let resourceMap = {};

    const response = await fetch(`book_zwis/${bookId}.zwi`);
    if (!response.ok) {
        bookContentDiv.textContent = 'Failed to load book.';
        return;
    }
    const zwiData = new Uint8Array(await response.arrayBuffer());

    function processText(text) {
        return text.replace(/_(.+?)_/g, (match, p1) => {
            if (p1.length <= 100) {
                return `<i>${p1}</i>`;
            }
            return match; // Return the original text if it's too long
        });
    }

    function prepPlainText(text) {
        // Split the text on any newline character sequence (\r\n, \r, or \n)
        const lines = text.split(/\r\n|\r|\n/);
    
        // Array to hold the final paragraphs
        const paragraphs = [];
    
        // Temporary array to hold lines of a potential paragraph
        let tempParagraph = [];
    
        // Function to flush the current paragraph into the main paragraphs array
        function flushParagraph() {
            if (tempParagraph.length > 0) {
                // Join lines into a single paragraph and replace multiple consecutive spaces
                let combinedText = tempParagraph.join(' ').replace(/ {2,}/g, match => '&nbsp;'.repeat(match.length));
    
                // Additional replacements for specific two-space scenarios
                combinedText = combinedText.replace(/(\w)&nbsp;&nbsp;(\w)/g, '$1&nbsp;$2')
                                           .replace(/(\.)&nbsp;&nbsp;(\w)/g, '$1&nbsp;$2')
                                           .replace(/(\.)&nbsp;&nbsp;(")/g, '$1&nbsp;$2')
                                           .replace(/(\.)&nbsp;&nbsp;(<)/g, '$1&nbsp;$2');
    
                // Replace underscores with italic tags when they occur in pairs
                combinedText = combinedText.replace(/_([^_]+)_/g, '<i>$1</i>');
    
                paragraphs.push(`<p>${combinedText}</p>`);
                tempParagraph = []; // Reset the temporary paragraph
            }
        }
    
        // Iterate through each line to determine paragraph breaks
        lines.forEach((line, index) => {
            if (line === '') {
                // When encountering a blank line, flush current paragraph
                flushParagraph();
                paragraphs.push('<p>&nbsp;</p>'); // Add a visible blank line
            } else {
                // Add the current line to the paragraph buffer
                tempParagraph.push(line);
    
                // Check if the current line and the next line form part of a paragraph
                if (line.length < 60 || (lines[index + 1] && lines[index + 1].length < 60 && !/\w/.test(lines[index + 1]))) {
                    flushParagraph(); // This line and the next don't meet the criteria, flush what we have
                }
            }
        });
    
        // Make sure to flush the last paragraph if any
        flushParagraph();
    
        // Join all paragraphs into a single string
        const formattedText = paragraphs.join('');
    
        // Wrap the formatted text in a <div> with the specified class
        const finalHTML = `<div class="from-plaintext">${formattedText}</div>`;
    
        return finalHTML;
    }

        
    function assignParagraphIDs(container) {
        const paragraphs = container.querySelectorAll('p');
        paragraphs.forEach((p, index) => {
            p.id = 'p' + index; // Assign ID like 'para0', 'para1', etc.
        });
    }

    function saveCurrentPosition() {
        const paragraphs = document.querySelectorAll('p');
        let closest = null;
        let minDistance = Infinity;
    
        paragraphs.forEach(paragraph => {
            const rect = paragraph.getBoundingClientRect();
            const distance = Math.abs(rect.top);
            if (distance < minDistance) {
                minDistance = distance;
                closest = paragraph;
            }
        });
    
        if (closest) {
            localStorage.setItem('lastReadPosition', closest.id);
            // Optionally, send this to main process to save in bookshelf.json
            window.electronAPI.sendLastReadPosition({ bookId: currentBookId, position: closest.id });
        }
    }

    // Event listener to save position on page unload
    window.addEventListener('beforeunload', saveCurrentPosition);
    
    // Optionally, save position periodically or on specific user actions
    setInterval(saveCurrentPosition, 5000);  // Save every 5 seconds

       
    fflate.unzip(zwiData, async (err, unzipped) => {
        if (err) {
            bookContentDiv.textContent = 'Failed to unzip book.';
            console.error(err);
            return;
        }
    
        const primaryFilename = currentBookMetadata.Primary;
        const rawContent = unzipped[primaryFilename];
        const utf8Decoder = new TextDecoder("utf-8");
        const preliminaryContent = utf8Decoder.decode(rawContent);
        const useUTF8 = preliminaryContent.includes("UTF-8");
        const decoder = new TextDecoder(useUTF8 ? "utf-8" : "ISO-8859-1");
        let bookContent = decoder.decode(rawContent);
        bookContent = processText(bookContent);
    
        // Set content in the appropriate format
        bookContentDiv.innerHTML = primaryFilename.endsWith(".txt") ? prepPlainText(bookContent) : bookContent;
        
        // Assign IDs to each paragraph
        assignParagraphIDs(bookContentDiv);

        // After setting the book content and IDs
        const lastReadPosition = localStorage.getItem('lastReadPosition');
        if (lastReadPosition) {
            const paragraphToScroll = document.getElementById(lastReadPosition);
            if (paragraphToScroll) {
                paragraphToScroll.scrollIntoView();
                // Optionally, animate the scroll or adjust position slightly for better UX
            }
        }

        // Update image sources within the loaded content immediately after setting innerHTML
        Array.from(bookContentDiv.querySelectorAll('img')).forEach(img => {
            const originalSrc = img.getAttribute('src');
            if (resourceMap[originalSrc]) {
                console.log('Updating src for:', originalSrc); // Log updating action
                img.setAttribute('src', resourceMap[originalSrc]);
            } else {
                console.log('No Blob URL found for:', originalSrc); // Log missing mapping
            }
        });
    
        // Function to clean up file paths
        function cleanPath(path) {
            return path.replace(/<\/?[^>]+>/gi, ''); // Strip out HTML tags
        }

        // When creating Blob URLs and storing them in the resourceMap:
        Object.keys(unzipped).forEach(filename => {
            if (filename !== primaryFilename && (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.gif'))) {
                const fileBlob = new Blob([unzipped[filename]], {type: 'image/' + filename.split('.').pop()});
                const fileUrl = URL.createObjectURL(fileBlob);
                // Normalize and clean filename to match the expected src format in HTML
                const normalizedFilename = cleanPath(filename.replace('data/media/images/', ''));
                resourceMap[normalizedFilename] = fileUrl;
                console.log('Mapped', normalizedFilename, 'to', fileUrl); // Log normalized mapping
            }
        });

        // When replacing src in HTML:
        document.querySelectorAll('#book-content img').forEach(img => {
            const originalSrc = img.getAttribute('src');
            const normalizedSrc = cleanPath(originalSrc.replace('data/media/images/', '')); // Ensure this matches the normalization used above
            console.log('Trying to update src for:', originalSrc, 'with', normalizedSrc); // Debugging log
            if (resourceMap[normalizedSrc]) {
                console.log('Updating src for:', originalSrc, 'to', resourceMap[normalizedSrc]); // Successful update log
                img.setAttribute('src', resourceMap[normalizedSrc]);
            } else {
                console.log('No Blob URL found for:', originalSrc); // Log missing mapping
            }
        });

    });
    
    // Helper for title-setter
    function setMoretext(more, headTitle, wholeTitle, truncatedTitle, space) {
        more.addEventListener('click', function (event) {
            event.preventDefault();
            if (more.textContent === "more") {
                headTitle.textContent = wholeTitle; // Expand to show full title
                more.textContent = "less"
                headTitle.appendChild(space);
                headTitle.appendChild(more);
            } else {
                headTitle.textContent = truncatedTitle;
                more.textContent = "more";
                headTitle.appendChild(space);
                headTitle.appendChild(more);
            }
        });
    }

    // Set the title
    console.log(currentBookMetadata.PG_ID);
    if (currentBookMetadata && currentBookMetadata.Title) {
        let headTitle = document.getElementById('headTitle');
        const wholeTitle = currentBookMetadata.Title;
        let truncatedTitle = wholeTitle;
        let more = document.createElement('a');
        more.classList.add("more");
        const space = document.createTextNode(" ");
        if (wholeTitle.length > 50) {
            truncatedTitle = truncatedTitle.substring(0, 75) + "…";
            more.textContent = "more";
            more.href = "#";
            setMoretext(more, headTitle, wholeTitle, truncatedTitle, space)
        }
        headTitle.textContent = truncatedTitle;
        headTitle.appendChild(space);
        headTitle.appendChild(more);
    } else {
        headTitle.textContent = wholeTitle;
    }

});


    function toggleBookmark() {
        const bookmarkIcon = document.getElementById('bookmarkIcon');
        if (bookmarkIcon.src.includes('bookmark.svg')) { // If currently showing the unfilled icon
            bookmarkIcon.src = 'images/icons/bookmark-fill.svg'; // Change to filled icon
        } else {
            bookmarkIcon.src = 'images/icons/bookmark.svg'; // Change back to unfilled icon
        }
    }    
