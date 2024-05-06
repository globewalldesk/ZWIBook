let currentBookId;

function loadFont() {
    // Load the font choice from local storage
    const selectedFont = localStorage.getItem('selectedFont') || 'Arial';  // Default font
    
    // If there's a font saved, apply it
    document.body.style.fontFamily = selectedFont;
}

document.addEventListener('DOMContentLoaded', async () => {
    loadFont();
    const bookContentDiv = document.getElementById('book-content');
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    console.log(`Opening book Project Gutenberg number: ${bookId}`)
    currentBookId = bookId; 
    
    let bookshelfData = await window.electronAPI.requestBookshelfData();

    // Find last read position for current book
    const lastReadData = bookshelfData.readingPositions.find(pos => pos.PG_ID === currentBookId);
    const lastReadPosition = lastReadData ? lastReadData.lastReadPosition : null;

    const bookshelfAddRemove = document.querySelector('#bookshelfAddRemove');
    
    bookshelfAddRemove.style.display = 'flex';

    const currentBookMetadata = JSON.parse(localStorage.getItem('currentBookMetadata'));

    async function showSavedState(bookId) {
        const icon = bookshelfAddRemove.querySelector('img');
        // If the book is in the savedBooks list, show the right icon.
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
    showSavedState(bookId); // Initially loads saved state from currentBookMetadata.

    // Listener for adding or removing a book from saved list
    bookshelfAddRemove.addEventListener("click", async () => {
        // Determine the action based on the current class
        let isAdding = bookshelfAddRemove.classList.contains('bi-journal-plus');
        let action = isAdding ? 'addSaved' : 'removeSaved';

        // Update the bookshelf with the appropriate action
        await window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: action });

        // Re-fetch the updated bookshelf data to ensure the UI can correctly reflect the new state
        bookshelfData = await window.electronAPI.requestBookshelfData();

        // Show the updated saved state based on the newly fetched data
        showSavedState(currentBookId);

    });

    let resourceMap = {};
    let zwiData;

    try {
        const buffer = await window.electronAPI.fetchZWI(bookId);
        if (!buffer) {
            bookContentDiv.textContent = 'Failed to load book: no buffer.';
            return;
        }
        // Convert Buffer to Uint8Array directly
        zwiData = new Uint8Array(buffer);
        // Now use zwiData as needed for further processing/display
    } catch (error) {
        bookContentDiv.textContent = 'Failed to load book: error.';
        console.error('Failed to fetch book data:', error);
    }

    function processText(text) {
        return text.replace(/_(.+?)_/g, (match, p1) => {
            if (p1.length <= 100) {
                return `<i>${p1}</i>`;
            }
            return match; // Return the original text if it's too long
        });
    }

    function prepPlainText(text, isPoetry) {
        const lines = text.split(/\r\n|\r|\n/);
        const paragraphs = [];
        let paragraphIndex = 0;
    
        if (isPoetry) {
            // If the text is poetry, preserve the line breaks and handle empty lines
            lines.forEach(line => {
                if (line.trim() === '') {
                    // Handle empty lines by inserting a placeholder paragraph
                    paragraphs.push('<p class="single-spaced">&nbsp;</p>');
                } else {
                    // Wrap each line in a paragraph tag to preserve formatting
                    paragraphs.push(`<div class="paragraph single-spaced" id="p${paragraphIndex}">
                        <img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${paragraphIndex}" onclick="toggleBookmark(${paragraphIndex})">
                        <p>${line}</p>
                    </div>`);
                    paragraphIndex++;
                }
            });
        } else {
            // Non-poetry text handling
            let tempParagraph = [];
            function flushParagraph() {
                if (tempParagraph.length > 0) {
                    let combinedText = tempParagraph.join(' ').replace(/ {2,}/g, ' ');
                    combinedText = combinedText.replace(/(\w)  (\w)/g, '$1 $2');
                    paragraphs.push(`
                        <div class="paragraph" id="p${paragraphIndex}">
                            <img src="images/icons/bookmark.svg" class="bookmark-icon" id="bookmark-${paragraphIndex}" onclick="toggleBookmark(${paragraphIndex})">
                            <p>${combinedText}</p>
                        </div>
                    `);
                    paragraphIndex++;
                    tempParagraph = [];
                }
            }
    
            // Process each line individually
            lines.forEach(line => {
                if (line.trim() === '') {
                    flushParagraph();
                } else {
                    tempParagraph.push(line);
                }
            });
    
            flushParagraph();
        }
    
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
            console.error('Unzip error:', err);
            return;
        }

        const primaryFilename = currentBookMetadata.Primary;
        const rawContent = unzipped[primaryFilename];
        const preliminaryContent = new TextDecoder("utf-8").decode(rawContent);
    
        let decoder;  
        if (preliminaryContent.toLowerCase().includes("utf-8")) {
            decoder = new TextDecoder("utf-8");
        } else if (preliminaryContent.toLowerCase().includes("language: serbian")) {
            decoder = new TextDecoder("cp1251");
        } else if (preliminaryContent.toLowerCase().includes("iso-8859-2")) {
            decoder = new TextDecoder("iso88592");
        } else if (preliminaryContent.toLowerCase().includes("unicode")) {
            decoder = new TextDecoder("utf-8");
        } else if (preliminaryContent.toLowerCase().includes("language: chinese")) {
            decoder = new TextDecoder("utf-8");
        } else {
            decoder = new TextDecoder("ISO-8859-1");
        }
    
        let bookContent = decoder.decode(rawContent);
        bookContent = processText(bookContent);

        // Define a regular expression that includes the root words for "poet" or "poem" in various languages
        // Words: poet, poem, poète, poème, dichter, gedicht, poeta, poema, poet, dikt, поэт, стих, 诗人, 诗
        const pattern = /poet|poem|poète|poème|dichter|gedicht|poeta|poema|dikt|поэт|стих|诗人|诗/i;

        // Fetch the title from the metadata and test it against the regular expression
        const isPoetry = pattern.test(currentBookMetadata.Title);
        
        // Set content in the appropriate format
        // Call prepPlainText with the isPoetry flag to adjust processing accordingly
        bookContentDiv.innerHTML = primaryFilename.endsWith(".txt") ? prepPlainText(bookContent, isPoetry) : bookContent;
        
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

    const bookmarksBtn = document.getElementById('bookmarksBtn');
    const bookmarksDropdown = document.getElementById('bookmarksDropdown');

    bookmarksBtn.addEventListener('click', function(event) {
        event.preventDefault();
        const isDisplayed = bookmarksDropdown.style.display === 'flex';
        bookmarksDropdown.style.display = isDisplayed ? 'none' : 'flex';
        
        if (!isDisplayed) {
            displayBookmarks();
        }
    });

    document.addEventListener('click', function(event) {
        if (!bookmarksDropdown.contains(event.target) && !bookmarksBtn.contains(event.target)) {
            bookmarksDropdown.style.display = 'none';
        }
    });

    // Prevent clicks inside the dropdown from propagating
    bookmarksDropdown.addEventListener('click', function(event) {
        event.stopPropagation();
    });
    
    async function displayBookmarks() {
        try {
            const bookmarks = await window.electronAPI.requestBookmarks(currentBookId);
            const docHeight = document.documentElement.scrollHeight;
            if (bookmarks && bookmarks.length > 0) {
                const bookmarksHtml = bookmarks.map(id => {
                    const paragraphElement = document.getElementById(id);
                    let snippet = paragraphElement ? paragraphElement.textContent.slice(0, 150) + '...' : 'No preview available';
                    let position = paragraphElement ? (paragraphElement.offsetTop / docHeight) * 100 : 0;
                    position = position.toFixed(0); // Format to 2 decimal places
                    return `
                    <div class="dropdown-btn bookmark-item" data-bookmark-id="${id}">
                        <div class="bookmark-column" onclick='goToBookmark(${id});'">
                            <img src="images/icons/bookmark-fill.svg">
                            <div class="bookmark-percentage">${position}%</div>
                        </div>
                        <span class="bookmark-snippet" onclick='goToBookmark(${id});'>${snippet}</span>
                        <img src="images/icons/trash.svg" class="delete-bookmark" onclick="deleteBookmark('${id}')" title="Delete">
                    </div>
                    `;
                }).join('');
                bookmarksDropdown.innerHTML = bookmarksHtml;
            } else {
                bookmarksDropdown.innerHTML = '<i>No bookmarks yet.<br>To add some, click next to a paragraph.</i>';
            }
            // Ensure the dropdown remains visible
            bookmarksDropdown.style.display = 'flex';
        } catch (error) {
            console.error('Failed to fetch bookmarks:', error);
            bookmarksDropdown.innerHTML = '<i>Error loading bookmarks.</i>';
            // Ensure the dropdown remains visible even on error
            bookmarksDropdown.style.display = 'flex';
        }
    }       
     
    /////////////////////////////
    // Find on page functionality
    const inputField = document.getElementById('searchText');
    const findButton = document.getElementById('findButton');
    const modal = document.getElementById('myModal');
    
    /* HENRY TO FINISH LATER
    // Modify the keypress listener to use the search counter
    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent form submission
            window.electronAPI.performFind(inputField.value.trim());
            setTimeout(() => inputField.focus(), 100); // Refocus after a delay
        }
    });
    */
    
    // Reset the search counter explicitly when the "Find" button is clicked
    findButton.addEventListener('click', function() {
        performSearch(true); // Explicitly treat button clicks as new searches to reset the process
    });

    // This function listens for the toggle command from the main process
    window.electronAPI.onToggleFindModal(() => {
        modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
        if (modal.style.display === 'block') {
            inputField.focus();  // Automatically focus on the input when the modal is shown
        }
    });

    // Handling closing modal when clicking outside the modal
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        } else if (event.target === fontModal) {
            closeFontModal(); // Close the modal if the click was outside the modal content
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };

    function updateBooksViewed() {
        try {
            // First, check if book metadata is correctly loaded
            if (!currentBookMetadata) {
                console.error("No current book metadata available.");
                return;
            }
    
            // Retrieve the viewed books list from local storage
            const viewedBooks = JSON.parse(localStorage.getItem('booksViewed')) || [];
            
            // Find if the current book is already in the viewed books list
            const existingIndex = viewedBooks.findIndex(book => book.PG_ID === currentBookMetadata.PG_ID);
    
            // If it exists, remove it to avoid duplicates and to update its position
            if (existingIndex > -1) {
                viewedBooks.splice(existingIndex, 1);
            }
    
            // Add the current book to the front of the list
            viewedBooks.unshift(currentBookMetadata);
    
            // Update local storage with the new viewed books list
            localStorage.setItem('booksViewed', JSON.stringify(viewedBooks));
    
            // Update the bookshelf in the backend via IPC
            window.electronAPI.updateBookshelf({ bookMetadata: currentBookMetadata, action: 'addViewed' });
    
        } catch (e) {
            console.error("Error updating Books Viewed: ", e);
        }
    }
    
    updateBooksViewed();
    
    // Listen for the 'export-zwi' message from the main process
    window.electronAPI.startZWIExport(() => {
        console.log("Received 'export-zwi' message in reader.js");
        console.log(`Exporting ZWI for book ID: ${currentBookId}`);
        window.electronAPI.finishZwiExport(currentBookId);  // This should now work as intended
    });


    // Definition of the exportZwiFunction, which handles exporting a ZWI file
    function exportZwiFunction(bookId) {
        console.log(`Initiating export for book ID: ${bookId}`);
        // Send the book ID back to the main process for exporting the ZWI
        window.electronAPI.finishZwiExport(bookId);
    }    

    // Menu management
    window.electronAPI.updateGutenbergMenu(currentBookId);
    window.electronAPI.refreshMenu();
});

async function deleteBookmark(bookmarkId) {
    // Remove bookmark visually from the dropdown
    const bookmarkElement = document.querySelector(`.bookmark-item[data-bookmark-id="${bookmarkId}"]`);
    if (bookmarkElement) {
        bookmarkElement.remove();
    }

    // Update the filled icon to the empty state if the bookmark is currently visible
    const bookmarkIcon = document.getElementById(`bookmark-${bookmarkId.split('p')[1]}`);
    if (bookmarkIcon && bookmarkIcon.classList.contains('filled')) {
        bookmarkIcon.classList.remove('filled');
        bookmarkIcon.src = 'images/icons/bookmark.svg';
    }

    // Send the update to the main process to update the storage
    await window.electronAPI.sendBookmarkUpdate({
        bookId: currentBookId,
        bookmarkId: bookmarkId,
        isAdd: false // Set to false to indicate removal
    });

    // Re-display the bookmarks to refresh the list and keep the dropdown open
//    await displayBookmarks();
}


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

// This function might be defined to scroll to the specific paragraph
function goToBookmark(paragraphId) {
    const element = document.getElementById(paragraphId.id);
    if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.scrollBy(0,-120);
    }
}

//////////////////////
// Font modal logic
const fontModal = document.getElementById('fontModal');

// Function to display the font chooser modal
function showFontModal() {
    fontModal.style.display = 'block'; // Make the modal visible
}

function setFont(fontName) {
    // Apply the font to the body or specific element
    document.body.style.fontFamily = fontName;
    
    // Save the font choice to local storage
    localStorage.setItem('selectedFont', fontName);
}

function applyFont(fontName) {
    const contentArea = document.body;
    contentArea.style.fontFamily = fontName;  // Apply the font
    setFont(fontName);
    closeFontModal();  // Close the modal
}

function closeFontModal() {
    fontModal.style.display = 'none';
}

// Listen for the choose-font event to open the modal
electronAPI.onChooseFont(() => {
    showFontModal(); // Call function to display the font modal
});

// Keydown event to close modal on pressing the Escape key
window.onkeydown = function(event) {
    if (event.key === "Escape") {
        closeFontModal();
    }
};