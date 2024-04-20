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

// Function to create and return a book div element
function createBookDiv(book) {
    const bookDiv = document.createElement('div');
    bookDiv.className = 'searchResultItem';

    const titleElement = document.createElement('a');
    titleElement.className = 'title';
    titleElement.innerHTML = formatTitle(book.Title); // Use innerHTML to render HTML content
    titleElement.onclick = function() {
        onBookClick(book.PG_ID);
    };
    titleElement.href = "javascript:void(0);"; // Ensures link is treated as clickable

    const authorElement = document.createElement('div');
    authorElement.className = 'author';
    authorElement.textContent = `by ${Array.isArray(book.CreatorNames) ? book.CreatorNames.join(', ') : 'Unknown Author'}`;

    bookDiv.appendChild(titleElement);
    bookDiv.appendChild(authorElement);

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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const data = await window.electronAPI.requestBookshelfData();
        if (data) {
            bookshelfData.viewedBooks = data.viewedBooks;
            bookshelfData.savedBooks = data.savedBooks;

            // Clear existing content and populate tabs
            document.getElementById('viewed').innerHTML = '';
            document.getElementById('saved').innerHTML = '';
            bookshelfData.viewedBooks.forEach(book => {
                document.getElementById('viewed').appendChild(createBookDiv(book));
            });
            bookshelfData.savedBooks.forEach(book => {
                document.getElementById('saved').appendChild(createBookDiv(book));
            });

            // Retrieve the last viewed tab from localStorage or default to 'viewed'
            const lastViewedTab = localStorage.getItem('lastViewedTab') || 'viewed';
            showTab(lastViewedTab);
        } else {
            console.error('No book data received');
        }
    } catch (error) {
        console.error("Error fetching bookshelf data: ", error);
    }
});

// Assuming `bookshelfData` contains an array of book objects for 'viewedBooks'
bookshelfData.viewedBooks.forEach(book => {
    document.getElementById('viewed').appendChild(createBookDiv(book));
});

// Assuming `bookshelfData` contains an array of book objects for 'savedBooks'
bookshelfData.savedBooks.forEach(book => {
    document.getElementById('saved').appendChild(createBookDiv(book));
});
