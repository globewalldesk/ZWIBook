// Your bookshelf data
const bookshelfData = {
    viewedBooks: [],
    savedBooks: []
};

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

// Function to handle clicking on a book title
function onBookClick(bookId) {
    // Ensure bookId is treated as a string
    let stringBookId = String(bookId);

    let bookMetadata = bookshelfData.viewedBooks.concat(bookshelfData.savedBooks).find(book => String(book.PG_ID) === stringBookId);

    if (bookMetadata) {
        localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
        window.location.href = `reader.html?bookId=${stringBookId}`;
    } else {
        console.error("Book metadata not found for ID:", stringBookId);
    }
}

// Done after deleting book from bookshelf.html
function refreshBookshelfUI() {
    window.electronAPI.requestBookshelfData().then(data => {
        bookshelfData.viewedBooks = data.viewedBooks;
        bookshelfData.savedBooks = data.savedBooks;

        document.getElementById('viewed').innerHTML = '';
        document.getElementById('saved').innerHTML = '';
        
        bookshelfData.viewedBooks.forEach(book => {
            document.getElementById('viewed').appendChild(createBookDiv(book, 'Viewed'));
        });
        bookshelfData.savedBooks.forEach(book => {
            document.getElementById('saved').appendChild(createBookDiv(book, 'Saved'));
        });
    }).catch(error => {
        console.error("Error fetching bookshelf data: ", error);
    });
}

function removeBook(bookId, listType) {
    console.log("Requesting removal of book with ID:", bookId, "from", listType);

    // Send IPC message to main process to remove the book from the specified list
    window.electronAPI.updateBookshelf({ bookMetadata: { PG_ID: bookId }, action: `remove${listType}` });

    // Listen for the update confirmation from the main process
    window.electronAPI.onBookshelfUpdated((response) => {
        console.log(response); // Log the response from the main process
        refreshBookshelfUI(); // Refresh the UI after the backend confirms the update
    });
}


// Function to create and return a book div element
function createBookDiv(book, listType) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'searchResultItem';

    const titleElement = document.createElement('a');
    titleElement.className = 'title';
    titleElement.innerHTML = formatTitle(book.Title);
    titleElement.onclick = function() {
        onBookClick(book.PG_ID);
    };
    titleElement.href = "javascript:void(0);";

    const authorElement = document.createElement('div');
    authorElement.className = 'author';
    authorElement.textContent = `by ${Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : 'Unknown Author'}`;

    const trashIcon = document.createElement('img');
    trashIcon.src = 'images/icons/trash.svg';
    trashIcon.className = 'trashIcon';
    trashIcon.onclick = function() {
        removeBook(book.PG_ID, listType);
    };

    bookDiv.appendChild(titleElement);
    bookDiv.appendChild(authorElement);
    bookDiv.appendChild(trashIcon);

    return bookDiv;
}

function showTab(tabName) {
    const tabs = document.getElementsByClassName('tab');
    const tabContents = document.getElementsByClassName('tabContent');
    
    // Hide all tab contents and remove active class from all tabs
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = 'none';
        tabs[i].classList.remove('active');
    }
    
    // Show the selected tab content and add active class to the clicked tab
    document.getElementById(tabName).style.display = 'block';
    const activeTab = document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
    activeTab.classList.add('active');

    // Save the current tab to localStorage
    localStorage.setItem('lastViewedTab', tabName);
}

// Function to get the currently active tab content for sorting
function getActiveTabContent() {
    // Check which tab content is visible and return the corresponding tab content container
    const viewedContent = document.getElementById('viewed');
    const savedContent = document.getElementById('saved');
    return (viewedContent.style.display !== 'none') ? viewedContent : savedContent;
}

// Function to sort by author last name
function sortByAuthor() {
    const parent = getActiveTabContent();
    let items = parent.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let authorA = a.querySelector('.author').textContent.split(',')[0].trim();
        let authorB = b.querySelector('.author').textContent.split(',')[0].trim();
        return authorA.localeCompare(authorB);
    });

    itemsArray.forEach(item => parent.appendChild(item));
}

// Function to sort by title, stripping non-word characters
function sortByTitle() {
    const parent = getActiveTabContent();
    let items = parent.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let titleA = a.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        let titleB = b.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    itemsArray.forEach(item => parent.appendChild(item));
}

// Function to sort by date extracted from author or title field
function sortByDate() {
    const parent = getActiveTabContent();
    let items = parent.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let dateRegex = /(\d+)(\??)( BCE| CE| AD| BC)?/g;
        let getDateValue = (text) => {
            let dates = [...text.matchAll(dateRegex)];
            let earliest = dates.reduce((min, current) => {
                let year = parseInt(current[1]);
                let isBCE = current[3] && current[3].includes("BCE");
                if (isBCE) year = -year; // Convert BCE to negative for correct chronological order
                return Math.min(min, year);
            }, Number.POSITIVE_INFINITY);
            return earliest === Number.POSITIVE_INFINITY ? new Date().getFullYear() : earliest;
        };

        let dateA = getDateValue(a.querySelector('.author').textContent);
        let dateB = getDateValue(b.querySelector('.author').textContent);

        return dateA - dateB;
    });

    itemsArray.forEach(item => parent.appendChild(item));
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Adding event listeners for sorting buttons (assuming their presence in the HTML)
        document.getElementById('sortAuthor').addEventListener('click', sortByAuthor);
        document.getElementById('sortTitle').addEventListener('click', sortByTitle);
        document.getElementById('sortDate').addEventListener('click', sortByDate);

        const sortDropdown = document.getElementById('sortDropdown');

        document.getElementById('sortBtn').addEventListener('click', () => {
            sortDropdown.style.display = sortDropdown.style.display === 'flex' ? 'none' : 'flex';
        });

        const data = await window.electronAPI.requestBookshelfData();
        if (data) {
            bookshelfData.viewedBooks = data.viewedBooks;
            bookshelfData.savedBooks = data.savedBooks;

            // Clear existing content and populate tabs
            document.getElementById('viewed').innerHTML = '';
            document.getElementById('saved').innerHTML = '';
            bookshelfData.viewedBooks.forEach(book => {
                document.getElementById('viewed').appendChild(createBookDiv(book, 'Viewed')); // Pass 'Viewed'
            });
            bookshelfData.savedBooks.forEach(book => {
                document.getElementById('saved').appendChild(createBookDiv(book, 'Saved')); // Pass 'Saved'
            });

            // Retrieve the last viewed tab from localStorage or default to 'viewed'
            const lastViewedTab = localStorage.getItem('lastViewedTab') || 'viewed';
            showTab(lastViewedTab);
        } else {
            console.error('No book data received');
        }
        
        /////////////////////////////
        // Find on page functionality
        const inputField = document.getElementById('searchText');
        const findButton = document.getElementById('findButton');
        const modal = document.getElementById('myModal');
        let lastSearch = '';  // Variable to store the last searched term

        // Helper function to perform search or find next
        function performSearch(newSearch = false) {
            const currentSearchTerm = inputField.value;
            if (newSearch || currentSearchTerm !== lastSearch) {
                window.electronAPI.performFind(currentSearchTerm);
                lastSearch = currentSearchTerm;  // Update last search term
            } else {
                window.electronAPI.findNext();
            }
        }

        // Event listener for keypress in the search input to handle the Enter key
        inputField.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.requestAnimationFrame(() => inputField.focus());  // Refocus on the input field to allow continuous 'Enter' presses
                performSearch();
            }
        });

        // Event listener for the Find button click
        findButton.addEventListener('click', () => performSearch(true));

        // This function listens for the toggle command from the main process
        window.electronAPI.onToggleFindModal(() => {
            modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
            if (modal.style.display === 'block') {
                inputField.focus();  // Automatically focus on the input when the modal is shown
            }
        });

        // Handling closing modal and sort dropdown when clicking outside
        window.onclick = function(event) {
            console.log(event.target);
            if (event.target === modal) {
                modal.style.display = 'none';
            } else if (event.target === sortDropdown) {
                sortDropdown.style.display = 'none';
            }
        };

        // Handling closing modal and sort dropdown on pressing the 'Escape' key
        document.onkeydown = function(event) {
            if (event.key === 'Escape') {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
                if (sortDropdown.style.display === 'flex') {
                    sortDropdown.style.display = 'none';
                }
            }
        };

    } catch (error) {
        console.error("Error fetching bookshelf data: ", error);
    }
});
