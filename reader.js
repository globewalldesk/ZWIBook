let currentBookId;

document.addEventListener('DOMContentLoaded', async () => {
    const bookContentDiv = document.getElementById('book-content');
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    currentBookId = bookId; 
    
    const bookshelfData = await window.electronAPI.requestBookshelfData();

    // Find last read position for current book
    const lastReadData = bookshelfData.readingPositions.find(pos => pos.PG_ID === currentBookId);
    const lastReadPosition = lastReadData ? lastReadData.lastReadPosition : null;

    const bookshelfAddRemove = document.querySelector('#bookshelfAddRemove');
    
    bookshelfAddRemove.style.display = 'flex';

    const currentBookMetadata = JSON.parse(localStorage.getItem('currentBookMetadata'));
    
    async function toggleSaved(bookId) {
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
        // Split the incoming text by any type of newline characters to process it line by line
        const lines = text.split(/\r\n|\r|\n/);
        // This array will store all the paragraph HTML after processing
        const paragraphs = [];
        // A temporary array to hold lines until they're ready to be joined into a paragraph
        let tempParagraph = [];
        // An index to keep track of paragraph numbers for assigning unique IDs
        let paragraphIndex = 0;
    
        // Function to handle the end of a paragraph and push it into the paragraphs array
        function flushParagraph() {
            if (tempParagraph.length > 0) {
                // Join all collected lines into a single string and handle multiple consecutive spaces
                let combinedText = tempParagraph.join(' ').replace(/ {2,}/g, ' ');
    
                // Correct handling of spacing around punctuation and words
                combinedText = combinedText.replace(/(\w)  (\w)/g, '$1 $2');
    
                // Construct the paragraph HTML with a bookmark icon
                paragraphs.push(`
                    <div class="paragraph" id="p${paragraphIndex}">
                        <img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${paragraphIndex}" onclick="toggleBookmark(${paragraphIndex})">
                        <p>${combinedText}</p>
                    </div>
                `);
                // Increment the paragraph index for the next paragraph
                paragraphIndex++;
                // Reset the temporary paragraph storage for the next flush
                tempParagraph = [];
            }
        }
    
        // Process each line individually
        lines.forEach((line, index) => {
            if (line.trim() === '') {
                // Flush the current paragraph if the line is empty, indicating a paragraph break
                flushParagraph();
            } else {
                // Add non-empty lines to the temporary paragraph array
                tempParagraph.push(line);
            }
        });
    
        // Make sure to flush the last paragraph if the text doesn't end with a newline
        flushParagraph();
    
        // Return all processed paragraphs joined into a single HTML string
        return paragraphs.join('');
    }
    
    
        
    function saveCurrentPosition() {
        const paragraphs = document.querySelectorAll('p, div'); // Including div.paragraph based on your previous setup
        let closest = null;
        let minDistance = Infinity;
        const viewportHeight = window.innerHeight;
    
        paragraphs.forEach(paragraph => {
            const rect = paragraph.getBoundingClientRect();
            let distance = Math.abs(rect.top - (viewportHeight / 2)); // Distance from the center of the viewport
    
            // Check if the paragraph is below the middle but still visible in the viewport
            if (rect.top > viewportHeight / 2 && rect.bottom < viewportHeight) {
                distance = Math.abs(rect.bottom - viewportHeight);
            }
    
            if (distance < minDistance) {
                minDistance = distance;
                closest = paragraph;
            }
        });
    
        if (closest) {
            localStorage.setItem('lastReadPosition', JSON.stringify({ bookId: currentBookId, position: closest.id }));
            window.electronAPI.sendLastReadPosition({ bookId: currentBookId, position: closest.id });
        }
    }
        
    // Periodic save setup and other event listeners...
    window.addEventListener('beforeunload', saveCurrentPosition);
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
        
        function addBookmarkIcon(element, index) {
            // Ensure the inner HTML of the element wraps its current content with a paragraph and includes the bookmark icon
            element.innerHTML = `<img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${index}" onclick="toggleBookmark(${index})">${element.tagName === 'P' ? '<p>' + element.innerHTML + '</p>' : element.innerHTML}`;
            element.classList.add("paragraph"); // Ensure it has the 'paragraph' class for consistent styling and behavior
        }

        function assignIDsToContentElements(content) {
            let paragraphIndex = 0;
            // Target both <p> and <div> tags
            let elements = content.querySelectorAll('p, div');
            
            elements.forEach(element => {
                // Ensure that <div> tags that do not contain <p> tags and have non-empty text content
                // as well as <p> tags get properly processed for bookmark icons and IDs
                if ((element.tagName === 'DIV' && !element.querySelector('p') && element.textContent.trim().length > 0) || element.tagName === 'P') {
                    if (!element.id) {  // Only assign an ID if none exists
                        element.id = `p${paragraphIndex}`; // Assign ID
                        addBookmarkIcon(element, paragraphIndex); // Add bookmark icon and other necessary HTML modifications
                        paragraphIndex++;
                    }
                }
            });
            return content;
        }
                
        // Usage after setting the innerHTML for bookContentDiv
        if (primaryFilename.endsWith(".html") || primaryFilename.endsWith(".htm")) {
            bookContentDiv.innerHTML = bookContent;
            assignIDsToContentElements(bookContentDiv);
            applyBookmarks();  // Ensure to call applyBookmarks after IDs are assigned
        }        

        async function applyBookmarks() {
            try {
                const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
                bookmarks.forEach(bookmarkId => {
                    const elem = document.getElementById(bookmarkId);
                    if (elem) {
                        const icon = elem.querySelector('.bookmark-icon');
                        if (icon) {
                            icon.classList.add('filled');
                            icon.src = 'images/icons/bookmark-fill.svg';
                            icon.style.visibility = 'visible'; // Ensure it is always visible
                        } else {
                            console.log('Bookmark icon not found for:', bookmarkId);
                        }
                    } else {
                        console.log('Element not found for bookmark:', bookmarkId); // Log missing elements
                    }
                });
            } catch (error) {
                console.error('Error fetching bookmarks:', error);
            }
        }
                
        applyBookmarks();

        // After setting the book content and IDs
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
            if (originalSrc.startsWith('images/icons/')) {
                // These are static assets and should not be processed like dynamic content images
                return;
            }
            if (resourceMap[originalSrc]) {
                img.setAttribute('src', resourceMap[originalSrc]);
            } else {
                console.log('No Blob URL found for:', originalSrc);
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
            }
        });

        // When replacing src in HTML:
        document.querySelectorAll('#book-content img').forEach(img => {
            const originalSrc = img.getAttribute('src');
            // Skip processing for known static assets to avoid unnecessary errors
            if (originalSrc.startsWith('images/icons/')) {
                return; // Skip this image as it's a static asset
            }
            const normalizedSrc = cleanPath(originalSrc.replace('data/media/images/', ''));
            if (resourceMap[normalizedSrc]) {
                img.setAttribute('src', resourceMap[normalizedSrc]);
            } else {
                console.log('No Blob URL found for:', originalSrc);
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


    try {
        const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
        bookmarks.forEach(bookmarkId => {
            const elem = document.getElementById(bookmarkId);
            if (elem) {
                const icon = elem.querySelector('.bookmark-icon');
                icon.classList.add('filled');
                icon.src = 'images/icons/bookmark-fill.svg';
                icon.style.visibility = 'visible'; // Ensure it is always visible
            }
        });
    } catch (error) {
        console.error('Error fetching bookmarks:', error);
    }


});


function toggleBookmark(index) {
    const bookmarkIcon = document.getElementById(`bookmark-${index}`);
    const isAdding = !bookmarkIcon.classList.contains('filled');

    if (isAdding) {
        bookmarkIcon.classList.add('filled');
        bookmarkIcon.src = 'images/icons/bookmark-fill.svg';
    } else {
        bookmarkIcon.classList.remove('filled');
        bookmarkIcon.src = 'images/icons/bookmark.svg';
    }

    window.electronAPI.sendBookmarkUpdate({
        bookId: currentBookId,
        bookmarkId: `p${index}`,
        isAdd: isAdding
    });
}    