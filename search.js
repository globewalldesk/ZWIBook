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

function searchTitles(query, searchType) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = ''; // Clear previous results before displaying new ones

    let results;
    switch (searchType) {
        case 'title':
            results = metadatabase.filter(book => book.Title.toLowerCase().includes(query.toLowerCase()));
            break;
        case 'author':
            results = metadatabase.filter(book =>
                Array.isArray(book.CreatorNames) && book.CreatorNames.some(author => author.toLowerCase().includes(query.toLowerCase()))
            );
            break;
        case 'both':
        default:
            results = metadatabase.filter(book =>
                book.Title.toLowerCase().includes(query.toLowerCase()) ||
                (Array.isArray(book.CreatorNames) && book.CreatorNames.some(author => author.toLowerCase().includes(query.toLowerCase())))
            );
            break;
    }

    // Display filtered results
    results.forEach(book => {
        const div = document.createElement('div');
        div.classList.add('searchResultItem');
        const formattedTitle = formatTitle(book.Title);
        // Ensure CreatorNames is treated as an array, even if it's undefined or in a different format
        const creatorNames = Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : '';
        div.innerHTML = `<a href="javascript:void(0);" class="title" onclick="onBookClick('${book.PG_ID}')">${formattedTitle}</a><div class="author">${creatorNames}</div>`;
        resultsDiv.appendChild(div);
    });

    // Optionally, other logic to save state, handle scrolling, etc.
}

function onBookClick(bookId) {
    const bookMetadata = metadatabase.find(book => book.PG_ID === bookId);

    if (bookMetadata) {
        // Safely retrieve and update the "Books Viewed" list
        try {
            const viewedBooks = JSON.parse(localStorage.getItem('booksViewed')) || [];
            const existingIndex = viewedBooks.findIndex(book => book.PG_ID === bookId);

            if (existingIndex > -1) {
                viewedBooks.splice(existingIndex, 1);
            }
            console.log(viewedBooks);

            viewedBooks.unshift(bookMetadata);
            localStorage.setItem('booksViewed', JSON.stringify(viewedBooks));
        } catch (e) {
            console.error("Error updating Books Viewed in local storage: ", e);
            // Handle error (e.g., show a message to the user or attempt to fix the issue)
        }

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
    setupEventListeners(searchType);
});

function setupEventListeners(defaultSearchType) {
    // Event listener for search input changes
    document.getElementById('searchBox').oninput = (e) => {
        const query = e.target.value;
        const searchType = document.querySelector('input[name="searchOption"]:checked').value;

        // Check the length of the query to determine if it's a new search or if we should clear the results
        if (query.length >= 3) {
            // Perform the search if there are at least three characters
            performSearch(query, searchType, true); // True indicates a new search
        } else {
            // Clear the search results if the query is shorter than three characters
            const resultsDiv = document.getElementById('searchResults');
            resultsDiv.innerHTML = '';
            sessionStorage.removeItem('searchResultsHTML');
            sessionStorage.removeItem('scrollPosition');
        }
    };

    // Event listener for changes in search options (title, author, both)
    document.querySelectorAll('input[name="searchOption"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const query = document.getElementById('searchBox').value;
            // Only perform search if query length is at least three characters
            if (query.length >= 3) {
                performSearch(query, radio.value, true); // True indicates a change in search type constitutes a new search
            } else {
                // Clear the search results if the query is shorter than three characters
                const resultsDiv = document.getElementById('searchResults');
                resultsDiv.innerHTML = '';
                sessionStorage.removeItem('searchResultsHTML');
                sessionStorage.removeItem('scrollPosition');
            }
        });
    });
}


// Save scroll position before leaving the page
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
});
