function onBookClick(bookId, bookMetadata) {
    let stringBookId = String(bookId);  // Ensure bookId is treated as a string
    localStorage.setItem('currentBookMetadata', JSON.stringify(bookMetadata));
    window.location.href = `../reader.html?bookId=${stringBookId}`;
}

// Function to sort by author last name
function sortByAuthor() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let authorA = a.querySelector('.author').textContent.split(',')[0].trim();
        let authorB = b.querySelector('.author').textContent.split(',')[0].trim();
        return authorA.localeCompare(authorB);
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);    
}

// Function to sort by title, stripping non-word characters
function sortByTitle() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        let titleA = a.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        let titleB = b.querySelector('.title').textContent.replace(/\W/g, '').toLowerCase();
        return titleA.localeCompare(titleB);
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);
}

// Function to sort by date extracted from author or title field
function sortByDate() {
    let items = document.querySelectorAll('.searchResultItem');
    let itemsArray = Array.from(items);

    itemsArray.sort((a, b) => {
        // Improved regex to find common historical date formats, handling BCE/CE more effectively
        let dateRegex = /(\d+)(\??)( BCE| CE| AD| BC)?/g;

        let getDateValue = (text) => {
            let dates = [...text.matchAll(dateRegex)];
            let earliest = dates.reduce((min, current) => {
                let year = parseInt(current[1]);
                let isBCE = current[3] && current[3].includes("BCE");
                let isUncertain = current[2] === '?';
                if (isBCE) year = -year; // Convert BCE to negative for correct chronological order
                if (isUncertain && year > 0) year -= 50; // Adjust uncertain CE dates slightly earlier
                return Math.min(min, year);
            }, Number.POSITIVE_INFINITY);
            return earliest === Number.POSITIVE_INFINITY ? new Date().getFullYear() : earliest; // Default to current year if no date found
        };

        let dateA = getDateValue(a.querySelector('.author').textContent);
        let dateB = getDateValue(b.querySelector('.author').textContent);

        return dateA - dateB; // Sort by earliest date
    });

    const parent = document.querySelector('#body > ul');
    itemsArray.forEach(item => parent.appendChild(item));

    // Collapse the popup after 1 second
    setTimeout(() => {
        document.getElementById('sortDropdown').style.display = 'none';
    }, 250);
}

window.onload = () => {
    // Adding event listeners for sorting buttons (assuming their presence in the HTML)
    document.getElementById('sortAuthor').addEventListener('click', sortByAuthor);
    document.getElementById('sortTitle').addEventListener('click', sortByTitle);
    document.getElementById('sortDate').addEventListener('click', sortByDate);

    const sortDropdown = document.getElementById('sortDropdown');

    document.getElementById('sortBtn').addEventListener('click', () => {
        sortDropdown.style.display = sortDropdown.style.display === 'flex' ? 'none' : 'flex';
    });
};
