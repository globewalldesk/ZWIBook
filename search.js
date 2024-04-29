function performSearch(query, searchType, isNewSearch) {
    // Ensure searchState includes the query and searchType
    const searchState = { query, searchType };

    // Save the current search state for later use
    sessionStorage.setItem('lastSearch', JSON.stringify(searchState));

    // Only proceed with the search if the query has at least three characters or if it's an explicit new search to clear results
    if (query.length >= 3 || isNewSearch) {
        searchTitles(query, searchType);
        console.log(`Performing search. Query: '${query}'. Type: '${searchType}'`)
    } else {
        // Clear the search results and sessionStorage if the query is shorter than three characters
        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = '';
        sessionStorage.removeItem('searchResultsHTML');
        sessionStorage.removeItem('scrollPosition');
    }
}

function formatTitle(title) {
    // Regex to match ':', ';', or '-' not surrounded by \w characters
    const breakRegex = /([-:;])(?!\w)/;
    // Find the first occurrence of the break character
    const match = title.match(breakRegex);
    if (match) {
        // Insert a break after the matched character and wrap the rest in a span with the 'subtitle' class
        return title.slice(0, match.index + 1) + "<br><span class='subtitle'>" + title.slice(match.index + 1) + "</span>";
    }
    return title;
}


// List of common words to ignore in OR searches
const stopWords = new Set(['the', 'of', 'in', 'on', 'at', 'for', 'with', 'a', 'an', 'and', 'or', 'but', 'is', 'if', 'it', 'as', 'to', 'that', 'which', 'by', 'from', 'up', 'out', 'on', 'off', 'this', 'all']);

function searchTitles(query, searchType) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = ''; // Clear previous results before displaying new ones

    const phrases = [];
    query = query.replace(/['"]([^'"]+)['"]/g, (match, phrase) => {
        phrases.push(phrase.toLowerCase());
        return '';
    }).trim();

    let keywords;
    if (query.length > 0) {
        keywords = query.toLowerCase().split(/\s+/).filter(word => !stopWords.has(word));
    } else {
        keywords = [];
    }

    // Combine keywords and phrases for final searching
    keywords = keywords.concat(phrases);

    if (keywords.length === 0) {
        // If no effective keywords or phrases, do not proceed with any search
        return; // Optionally, you might show a message or clear previous results explicitly here
    }

    let results;
    switch (searchType) {
        case 'title':
            results = metadatabase.filter(book =>
                keywords.every(keyword => book.Title.toLowerCase().includes(keyword))
            );
            break;
        case 'author':
            results = metadatabase.filter(book =>
                Array.isArray(book.CreatorNames) && keywords.every(keyword =>
                    book.CreatorNames.some(author => author.toLowerCase().includes(keyword))
                )
            );
            break;
        case 'both':
        default:
            results = metadatabase.filter(book =>
                keywords.every(keyword =>
                    book.Title.toLowerCase().includes(keyword) ||
                    (Array.isArray(book.CreatorNames) && book.CreatorNames.some(author => author.toLowerCase().includes(keyword)))
                )
            );
            break;
    }

    // Display filtered results
    if (results.length > 0) {
        results.forEach(book => {
            const div = document.createElement('div');
            div.classList.add('searchResultItem');
            const formattedTitle = formatTitle(book.Title);
            const creatorNames = Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : '';
            div.innerHTML = `<a href="javascript:void(0);" class="title" onclick="onBookClick('${book.PG_ID}')">${formattedTitle}</a><div class="author">${creatorNames}</div>`;
            resultsDiv.appendChild(div);
        });
    } else {
        resultsDiv.innerHTML = '<p>No results found.</p>'; // Display a no results message
    }
}


function onBookClick(bookId) {
    const bookMetadata = metadatabase.find(book => book.PG_ID === bookId);

    if (bookMetadata) {
        // Existing functionality to navigate to reader.html
        localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));

        // Use the exposed API from preload.js to communicate with the main process
        // window.electronAPI.updateBookshelf(bookMetadata);
        window.electronAPI.updateBookshelf( {bookMetadata: bookMetadata, action: 'addViewed'});

        // No need for ipcRenderer here because you're using electronAPI
        window.location.href = `reader.html?bookId=${bookId}`;
    } else {
        console.error("Book metadata not found for ID:", bookId);
    }
}

document.addEventListener('DOMContentLoaded', async() => {
    // Retrieve and parse the last search state, providing a fallback if not found
    const lastSearch = JSON.parse(sessionStorage.getItem('lastSearch')) || {};
    // Destructure the last search object, assigning default values if undefined
    const { query = '', searchType = 'both' } = lastSearch;

    // Restore the search input and the selected search option
    document.getElementById('searchBox').value = query;
    document.querySelector(`input[name="searchOption"][value="${searchType}"]`).checked = true;

    // Perform the search again using the saved query and type, if any
    if (query) {
        performSearch(query, searchType, false); // Use false because we're restoring state, not initiating a new search
    }

    // Set up event listeners for search input changes and search option changes
    setupEventListeners('both');


    /////////////////////////////
    // Find on page functionality
    const inputField = document.getElementById('searchText');
    const findButton = document.getElementById('findButton');
    const modal = document.getElementById('myModal');
    let lastFind = '';  // Variable to store the last searched term

    // Helper function to perform search or find next
    function searchOnPage(newSearch = false) {
        const currentSearchTerm = inputField.value;
        if (newSearch || currentSearchTerm !== lastFind) {
            window.electronAPI.performFind(currentSearchTerm);
            lastFind = currentSearchTerm;  // Update last search term
        } else {
            window.electronAPI.findNext();
        }
    }

    // Event listener for keypress in the search input to handle the Enter key
    inputField.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            window.requestAnimationFrame(() => inputField.focus());  // Refocus on the input field to allow continuous 'Enter' presses
            searchOnPage();
        }
    });

    // Event listener for the Find button click
    findButton.addEventListener('click', () => searchOnPage(true));

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
        }
    };

    // Handling closing modal on pressing the 'Escape' key
    document.onkeydown = function(event) {
        if (event.key === 'Escape') {
            modal.style.display = 'none';
        }
    };
});

// Debounce function to delay execution
function debounce(func, delay) {
    let debounceTimer;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
}

function setupEventListeners(defaultSearchType) {
    const debouncedSearch = debounce(function(query, searchType) {
        performSearch(query, searchType, true);
    }, 2000); // 2000 milliseconds delay

    // Event listener for search input changes
    document.getElementById('searchBox').oninput = (e) => {
        const query = e.target.value;
        const searchType = document.querySelector('input[name="searchOption"]:checked').value;

        // Delay search until 2s after the last keypress or until "Enter" or "Go" is clicked
        debouncedSearch(query, searchType);
    };

    // Event listener for the "Go" button or "Enter" key press
    document.getElementById('searchButton').onclick = () => {
        const query = document.getElementById('searchBox').value;
        const searchType = document.querySelector('input[name="searchOption"]:checked').value;
        performSearch(query, searchType, true); // Immediate execution on button click
    };

    document.getElementById('searchBox').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            const query = event.target.value;
            const searchType = document.querySelector('input[name="searchOption"]:checked').value;
            performSearch(query, searchType, true); // Immediate execution on enter press
        }
    });
}


// Save scroll position before leaving the page
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
});
