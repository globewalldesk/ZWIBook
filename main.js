const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// Path to the new subdirectory under the directory of main.js
const dataDir = path.join(__dirname, 'data');

// Check if the directory exists, if not create it
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}

const bookshelfPath = path.join(dataDir, 'bookshelf.json');
process.stdout.write(bookshelfPath);

let mainWindow; // Declare mainWindow globally

// Function to open the find dialog
function openFindDialog() {
    let findWindow = new BrowserWindow({
        width: 400,
        height: 200,
        webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,  // for simplicity, adjust as necessary for security
        }
    });
    findWindow.loadFile('findDialog.html');
    findWindow.on('closed', () => findWindow = null);
}


function getBookshelfData() {
    try {
        const data = fs.readFileSync(bookshelfPath, 'utf8');
        const bookshelf = JSON.parse(data);

        // Initialize 'bookmarks' if it does not exist
        if (!bookshelf.bookmarks) {
            bookshelf.bookmarks = [];
        }

        return bookshelf;
    } catch (error) {
        console.error('Failed to read bookshelf data:', error);
        // Initialize with defaults if there's an error reading or parsing the file
        return { viewedBooks: [], savedBooks: [], readingPositions: [], bookmarks: [] };
    }
}

// Example function to update bookmarks in bookshelf data
function updateBookmarks(bookId, bookmarkId, add = true) {
    let bookshelf = getBookshelfData(); // Retrieve current bookshelf data

    let bookEntry = bookshelf.viewedBooks.find(book => book.PG_ID === bookId);
    if (!bookEntry) {
        console.error('Book not found');
        return;
    }

    if (add) {
        bookEntry.bookmarks = bookEntry.bookmarks || [];
        if (!bookEntry.bookmarks.includes(bookmarkId)) {
            bookEntry.bookmarks.push(bookmarkId);
        }
    } else {
        if (bookEntry.bookmarks) {
            bookEntry.bookmarks = bookEntry.bookmarks.filter(id => id !== bookmarkId);
        }
    }

    fs.writeFileSync(bookshelfPath, JSON.stringify(bookshelf, null, 2), 'utf8');
}


function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Load the index.html of the app.
    mainWindow.loadFile('search.html');

    // Setup menu with 'Find' functionality and DevTools
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                ...(isMac ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' },
                            { role: 'stopSpeaking' }
                        ]
                    }
                ] : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' }, // Enable DevTools
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },

        // Modify your menu template to call openFindDialog
        {
            label: 'Find on page',
            submenu: [
                {
                    label: 'Find...',
                    accelerator: 'CmdOrCtrl+F',
                    click: openFindDialog
                },
                {
                    label: 'Stop Find',
                    accelerator: 'Esc',
                    click: () => {
                        mainWindow.webContents.stopFindInPage('clearSelection');
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://electronjs.org');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC event for updating the bookshelf with clicked book metadata
ipcMain.on('update-bookshelf', (event, { bookMetadata, action }) => {
    let bookshelf;

    try {
        // Check if the bookshelf.json file exists and read or initialize it
        if (fs.existsSync(bookshelfPath)) {
            bookshelf = JSON.parse(fs.readFileSync(bookshelfPath, 'utf8'));
        } else {
            bookshelf = { viewedBooks: [], savedBooks: [] };
        }

        // Default to an empty array if properties are undefined
        bookshelf.viewedBooks = bookshelf.viewedBooks || [];
        bookshelf.savedBooks = bookshelf.savedBooks || [];

        // Determine action type
        switch (action) {
            case 'addViewed':
                const viewedIndex = bookshelf.viewedBooks.findIndex(book => book.PG_ID === bookMetadata.PG_ID);
                if (viewedIndex === -1) {  // Book not in viewed list: add it
                    bookshelf.viewedBooks.unshift(bookMetadata);
                }
                break;
            case 'addSaved':
                const savedIndexAdd = bookshelf.savedBooks.findIndex(book => book.PG_ID === bookMetadata.PG_ID);
                if (savedIndexAdd === -1) {  // Book not in saved list: add it
                    bookshelf.savedBooks.unshift(bookMetadata);
                }
                break;
            case 'removeSaved':
                const savedIndexRemove = bookshelf.savedBooks.findIndex(book => book.PG_ID === bookMetadata.PG_ID);
                if (savedIndexRemove !== -1) {  // Book in saved list: remove it
                    bookshelf.savedBooks.splice(savedIndexRemove, 1);
                }
                break;
            default:
                throw new Error('Unsupported action type');
        }

        // Write the updated bookshelf data to the file
        fs.writeFileSync(bookshelfPath, JSON.stringify(bookshelf, null, 2), 'utf8');
        event.reply('bookshelf-update-confirmation', 'Bookshelf updated successfully.');
    } catch (error) {
        console.error('Failed to update bookshelf:', error);
        event.reply('bookshelf-update-error', 'An error occurred while updating the bookshelf.');
    }
});


// Used in bookshelf.html
ipcMain.handle('get-bookshelf-data', async (event) => {
    try {
        const data = fs.readFileSync(bookshelfPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read bookshelf data:', error);
        return { viewedBooks: [], savedBooks: [] }; // return empty bookshelf structure in case of error
    }
});

// This part remains inside the createWindow or ready event
ipcMain.on('perform-find', (event, text) => {
    mainWindow.webContents.findInPage(text);
});

// This is used in reader.html to update last reading position
ipcMain.on('save-last-read-position', (event, { bookId, position }) => {
    const bookshelf = getBookshelfData(); // Retrieve current bookshelf data

    // Ensure that readingPositions array exists
    if (!bookshelf.readingPositions) {
        bookshelf.readingPositions = [];
    }

    // Check if there is already an entry for this book in readingPositions
    let positionEntry = bookshelf.readingPositions.find(entry => entry.PG_ID === bookId);

    if (positionEntry) {
        // Update existing entry
        positionEntry.lastReadPosition = position;
    } else {
        // Create a new entry if none exists
        bookshelf.readingPositions.push({
            PG_ID: bookId,
            lastReadPosition: position
        });
    }

    // Write the updated bookshelf data back to the file
    fs.writeFileSync(bookshelfPath, JSON.stringify(bookshelf, null, 2), 'utf8');
    event.reply('position-save-confirmation', 'Last read position saved successfully.');
});

ipcMain.on('update-bookmark', (event, { bookId, bookmarkId, isAdd }) => {
    let bookshelf = getBookshelfData();  // This now includes bookmarks initialization
    const bookmarkEntry = bookshelf.bookmarks.find(entry => entry.PG_ID === bookId);

    if (isAdd) {
        if (!bookmarkEntry) {
            bookshelf.bookmarks.push({
                PG_ID: bookId,
                positions: [bookmarkId]
            });
        } else {
            if (!bookmarkEntry.positions.includes(bookmarkId)) {
                bookmarkEntry.positions.push(bookmarkId);
            }
        }
    } else {
        if (bookmarkEntry) {
            bookmarkEntry.positions = bookmarkEntry.positions.filter(id => id !== bookmarkId);
        }
    }

    fs.writeFileSync(bookshelfPath, JSON.stringify(bookshelf, null, 2), 'utf8');
    event.reply('bookmark-update-confirmation', 'Bookmark updated successfully.');
});

ipcMain.handle('get-bookmarks', async (event, bookId) => {
    const bookshelf = getBookshelfData();
    console.log(JSON.stringify(bookshelf, null, 2));  // Detailed print of the bookshelf
    
    // Safely check if bookmarks exist and then find the entry
    const bookmarksEntry = bookshelf.bookmarks && bookshelf.bookmarks.find(entry => entry.PG_ID === bookId);
    console.log(`Searching for PG_ID: ${bookId}`);
    console.log(`bookmarksEntry = ${JSON.stringify(bookmarksEntry)}`);
    
    return bookmarksEntry ? bookmarksEntry.positions : [];
});
