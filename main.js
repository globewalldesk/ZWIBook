const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

let mainWindow; // Declare mainWindow globally
let dataDir, latestUrlPath, bookshelfPath; // Declare these globally to use in createWindow()

// Function to get the default data directory based on OS
function getDefaultDataDir() {
    const homeDir = os.homedir();
    switch (os.platform()) {
        case 'darwin': // macOS
            return path.join(homeDir, '.ksfdata');
        case 'win32': // Windows
            return path.join(homeDir, 'ksfdata');
        case 'linux': // Linux
            return path.join(homeDir, '.ksfdata');
        default:
            return path.join(homeDir, '.ksfdata');
    }
}

// Function to prompt the user to select a data directory
async function selectDataDirectory(defaultPath) {
    // Show a message box to the user with options
    const response = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Set Up Data Directory',
        message: 'Thanks for installing the Knowledge Standards Foundation\'s Book Reader for Project Gutenberg!\n\n' +
                 'One set-up task: where to put your bookmarks and program data (not the books: the books stay on the thumb drive unless you move them yourself).\n\n' +
                 'On your ' + os.platform().replace('darwin', 'macOS').replace('win32', 'Windows').replace('linux', 'Linux') +
                 ' system, we can make the data directory at the default location:\n\n' + defaultPath +
                 '\n\nUse this (should be fine), or select another location?',
        buttons: ['Use default', 'Select another location'],
        defaultId: 0, // Default button index
        cancelId: 1, // Cancel (or alternative action) button index
        noLink: true
    });

    // Handle user response
    if (response.response === 1) { // User wants to select another location
        // Open a directory chooser dialog
        let result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Data Directory',
            defaultPath: defaultPath,
            properties: ['openDirectory', 'createDirectory', 'promptToCreate']
        });
        if (result.canceled || !result.filePaths.length) {
            return defaultPath; // Use default if canceled or no selection
        }
        return result.filePaths[0];
    }
    // Use default if the user selects "Use default" or closes the dialog
    return defaultPath;
}

const configFilePath = path.join(app.getPath('userData'), 'config.json'); // Path for config file

// Function to load configuration or return null if not found
async function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath);
            return JSON.parse(configData);
        }
    } catch (error) {
        console.error('Error reading config file:', error);
    }
    return null;
}

// Function to save configuration
async function saveConfig(config) {
    if (config && config.dataDir) { // Check if config and dataDir are defined
        try {
            fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4)); // Save in a readable format
        } catch (error) {
            console.error('Error writing config file:', error);
        }
    } else {
        console.error('saveConfig was called with invalid config:', config);
    }
}

// Dynamic setup of data directory based on user input or existing config
async function setupDataDirectory() {
    let config = await loadConfig();
    let dataDir = config?.dataDir;

    if (dataDir) {
        // If we have a data directory in config, we use it and don't ask the user again.
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        return dataDir;
    }

    // If we don't have a data directory, we ask the user to select one.
    const defaultDataDir = getDefaultDataDir();
    dataDir = await selectDataDirectory(defaultDataDir);
    await saveConfig({ dataDir });

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}

let startupWindow;

function createStartupWindow() {
    startupWindow = new BrowserWindow({
        width: 200,
        height: 100,
        frame: false,
        transparent: true,
        alwaysOnTop: true
    });

    startupWindow.loadURL('data:text/html;charset=utf-8,' +
        encodeURI('<html><body><p>Starting up...</p></body></html>'));
    
    // Don't show the startup window in the taskbar
    startupWindow.setSkipTaskbar(true);
}

process.on('uncaughtException', (error) => {
    console.error('An unhandled exception occurred:', error);
});
  

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Read the last visited URL if it exists
    let initialUrl = `file://${path.join(__dirname, 'search.html')}`; // Default URL
    if (fs.existsSync(latestUrlPath)) {
        try {
            initialUrl = fs.readFileSync(latestUrlPath, 'utf8');
        } catch (error) {
            console.error('Error reading the last visited URL:', error);
        }
    }

    // Load the URL
    mainWindow.loadURL(initialUrl);

    mainWindow.once('ready-to-show', () => {
        if (startupWindow) {
            startupWindow.close();
            startupWindow = null;
        }
        mainWindow.show();
    });

    // Set up event listeners for URL changes
    mainWindow.webContents.on('did-navigate', (event, url) => {
        fs.writeFileSync(latestUrlPath, url, 'utf8');
    });

    mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
        if (isMainFrame) {
            fs.writeFileSync(latestUrlPath, url, 'utf8');
        }
    });

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
                isMac ? { role: 'close' } : { role: 'quit' },
                { type: 'separator' },
                {
                    label: 'Print (requires PDF reader)',
                    accelerator: 'CmdOrCtrl+P',
                    click: async () => {
                        const pdfPath = path.join(app.getPath('downloads'), 'output.pdf');
                        const options = { 
                            marginsType: 0, // Default to the standard preset, overridden by custom margin
                            pageSize: 'A4',
                            printBackground: true,
                            printSelectionOnly: false,
                            landscape: false,
                            headerFooterEnabled: false,
                            headerTemplate: '<div style="font-size: 10px; color: #999; text-align: center;">Header</div>',
                            footerTemplate: '<div style="font-size: 10px; color: #999; text-align: center;">Footer</div>',
                            margin: { // Custom margins
                                top: '80px',    // Increase from '20px' to '40px' for twice as wide
                                bottom: '80px', // Same increase as above
                                left: '20px',   // Maintain original side margins
                                right: '20px'
                            }
                        }
                        try {
                            const data = await mainWindow.webContents.printToPDF(options);
                            fs.writeFileSync(pdfPath, data);
                            shell.openExternal('file://' + pdfPath);
                        } catch (error) {
                            console.log('Failed to save PDF:', error);
                        }
                    }
                },
                {
                    label: 'Save as PDF (requires PDF reader)',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: async () => {
                        const pdfPath = path.join(app.getPath('downloads'), 'output.pdf');
                        const options = { 
                            marginsType: 2, pageSize: 'A4', printBackground: true, 
                            printSelectionOnly: false, landscape: false, 
                            headerFooterEnabled: false,
                            headerTemplate: '<div style="font-size: 10px; color: #999; text-align: center;">Header</div>',
                            footerTemplate: '<div style="font-size: 10px; color: #999; text-align: center;">Footer</div>',
                            printBackground: true // Include background colors and images 
                        }
                        try {
                            const data = await mainWindow.webContents.printToPDF(options);
                            fs.writeFileSync(pdfPath, data);
                            shell.openExternal('file://' + pdfPath);
                        } catch (error) {
                            console.log('Failed to save PDF:', error);
                        }
                    }
                }
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
            label: 'Text and View',
            submenu: [
                {
                    label: 'Font styles...',
                    accelerator: 'CmdOrCtrl+Alt+F',
                    click: () => {
                        mainWindow.webContents.send('choose-font');
                    }
                },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' }, // Enable DevTools
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },

        // Modify your menu template to call openFindDialog
        {
            label: 'Find on Page',
            submenu: [
                {
                    label: 'Find...',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => {
                        mainWindow.webContents.send('toggle-find-modal');
                    }
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
                        await shell.openExternal('https://encyclosphere.org');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    let currentSearchText = '';

    // Listen to the search request
    ipcMain.on('perform-find', (event, text) => {
        if (text !== currentSearchText) {
            mainWindow.webContents.findInPage(text);
            currentSearchText = text; // Store the new search text
        } else {
            mainWindow.webContents.findInPage(text, { findNext: true });
        }
    });

    // Listen to the find next request
    ipcMain.on('find-next', (event) => {
        if (currentSearchText) {
            mainWindow.webContents.findInPage(currentSearchText, { findNext: true });
        }
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    createStartupWindow();
    try {
        dataDir = await setupDataDirectory(); // Ensure dataDir is set
        latestUrlPath = path.join(dataDir, 'latest.txt'); // Now we assign latestUrlPath
        bookshelfPath = path.join(dataDir, 'bookshelf.json'); // And bookshelfPath
        // The rest of your setup
        if (startupWindow) {
            startupWindow.close();
            startupWindow = null;
        }
        createWindow(); // Safe to create the window now
    } catch (err) {
        console.error('Failed to set up the data directory:', err);
        if (startupWindow) {
            startupWindow.close();
            startupWindow = null;
        }
    }
});

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
        setupDataDirectory().then(createWindow).catch(err => {
            console.error('Failed to re-setup data directory or re-create window:', err);
        });
    }
});

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
                // Find the index of the book if it already exists in the viewed list
                const viewedIndex = bookshelf.viewedBooks.findIndex(book => book.PG_ID === bookMetadata.PG_ID);
                // If the book is found, remove it
                if (viewedIndex > -1) {
                    bookshelf.viewedBooks.splice(viewedIndex, 1);
                }
                // Whether it was already in the list or not, add it to the front
                bookshelf.viewedBooks.unshift(bookMetadata);
                break;
            case 'removeViewed':
                bookshelf.viewedBooks = bookshelf.viewedBooks.filter(book => book.PG_ID !== bookMetadata.PG_ID);
                break;
            case 'addSaved':
                const savedIndexAdd = bookshelf.savedBooks.findIndex(book => book.PG_ID === bookMetadata.PG_ID);
                if (savedIndexAdd === -1) {
                    bookshelf.savedBooks.unshift(bookMetadata);
                }
                break;
            case 'removeSaved':
                bookshelf.savedBooks = bookshelf.savedBooks.filter(book => book.PG_ID !== bookMetadata.PG_ID);
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
    
    // Safely check if bookmarks exist and then find the entry
    const bookmarksEntry = bookshelf.bookmarks && bookshelf.bookmarks.find(entry => entry.PG_ID === bookId);
    
    return bookmarksEntry ? bookmarksEntry.positions : [];
});

// Listen for font change requests and broadcast them to the renderer
ipcMain.on('apply-font', (event, fontName) => {
    mainWindow.webContents.send('font-chosen', fontName);
});

// React to font chooser trigger
ipcMain.on('choose-font', () => {
    mainWindow.webContents.send('choose-font');
});
