const { app, BrowserWindow, ipcMain, Menu, MenuItem, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus the main window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/*
// Logging dev console output.
const logFilePath = path.join(process.cwd(), 'app.log'); // Creates a log file in the current working directory
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
console.log = function (message) {
    logStream.write(new Date().toISOString() + " - " + message + '\n');
};
*/

let mainWindow; // Declare mainWindow globally
let dataDir, zwiDirectoryPath, latestUrlPath, bookshelfPath, hlnotesPath; // Declare these globally to use in createWindow()
let currentBookTitle = ""; // For Copilot inquiries
let currentBookAuthor = "";

const configFilePath = path.join(app.getPath('userData'), 'config.json'); // Default path for config file

// Define a global variable to store the menu item references
let gutenbergMenuItems = [];

// Function to load configuration or return null if not found
async function loadConfig() {
    try {
        console.log("Does the file exist?", fs.existsSync(configFilePath));
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

// Dynamic setup of data directory based on existing config
async function setupDataDirectory() {
    try {
        // Get (or initialize) config file 
        let config = await loadConfig();

        // Ensure config is not null and initialize if needed
        config = config || {};
        let dataDir = config.dataDir || path.join(os.homedir(), '.zwibook');

        // Ensure the directory exists
        try {
            await fs.promises.mkdir(dataDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') { // Ignore error if the directory already exists
                console.error('Error creating data directory:', error);
                throw error;  // Rethrow to handle it in the calling context
            }
        }

        // Save the data directory back to config, if needed
        if (!config.dataDir) {
            config.dataDir = dataDir;  // Update the config object before saving
            await saveConfig(config);
        }

        return dataDir;
    } catch (error) {
        console.error('Failed to set up data directory:', error);
        throw error; // Rethrow to ensure the calling function is aware of the failure
    }
}

// Function to prompt the user to confirm the location of book_zwis directory
async function confirmZwiDirectory() {
    if (!mainWindow) {
        console.error("Main window is not initialized.");
        await app.whenReady();  // Wait until the app is ready
        if (!mainWindow) {
            console.error("Main window still not initialized.");
            return -1; // Or handle the error more gracefully
        }
    }
    const response = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Confirm Book ZWIs Location',
        message: 'Where are the books?\n\n' +
                 'IMPORTANT, PLEASE READ: Are you (a) running this app from a KSF thumb drive? If so, the book files should be on there. Or (b) have you copied the directory somewhere else? (You could, but probably haven\'t.)',
        buttons: ['(a) Thumb drive (usual case)', '(b) Somewhere else (atypical)'],
        defaultId: 0, // Default button index for Thumb drive
        cancelId: 1, // Alternative action for Somewhere else
        noLink: true
    });
    return response.response;
}

// Function to get the ZWI directory path on Linux
const linuxGetZwiDirectoryPath = () => {
    const appImagePath = process.env.APPIMAGE;
    if (appImagePath) {
        // Running from an AppImage
        return path.join(path.dirname(path.dirname(appImagePath)), 'book_zwis');
    } else {
        // Running from the command line
        return path.join(__dirname, 'book_zwis');
    }
};

// Function to get the ZWI directory path on macOS
const macGetZwiDirectoryPath = () => {
    const appPath = path.dirname(process.execPath);
    return path.join(path.dirname(appPath), 'book_zwis');
};

// Function to get the ZWI directory path on Windows
const windowsGetZwiDirectoryPath = () => {
    const appPath = path.dirname(process.execPath);
    return path.join(path.dirname(appPath), 'book_zwis');
};

// Main function to determine the ZWI directory path based on the operating system
const getZwiDirectoryPath = () => {
    switch (os.platform()) {
        case 'linux':
            return linuxGetZwiDirectoryPath();
        case 'darwin': // macOS
            return macGetZwiDirectoryPath();
        case 'win32': // Windows
            return windowsGetZwiDirectoryPath();
        default:
            return null;
    }
};

// New function to validate the ZWI directory path
const validateZwiPath = async (zwiPath) => {
    const requiredFiles = ['131.zwi', '1041.zwi', '1911.zwi'];
    try {
        const files = await fs.promises.readdir(zwiPath);
        return requiredFiles.every(file => files.includes(file));
    } catch (error) {
        console.error('Error validating ZWI path:', error);
        return false;
    }
};

// Try to autodetect the ZWI directory path; used in app.whenReady() if config lacks a path. 
const autodetectZwiDirectoryPath = async () => {
    const possiblePaths = [
        path.join(__dirname, 'book_zwis'),
        path.join(__dirname, '..', 'book_zwis'),
        path.join(__dirname, '..', '..', 'book_zwis'),
        path.join(os.homedir(), 'book_zwis'),
        path.join('/', 'media', os.userInfo().username, 'book_zwis'),
        path.join('/', 'mnt', 'book_zwis'),
        path.join('/', 'Volumes', 'book_zwis')
    ];

    // For Windows, add drive letters
    if (os.platform() === 'win32') {
        for (let drive = 67; drive <= 90; drive++) { // ASCII values for C to Z
            possiblePaths.push(`${String.fromCharCode(drive)}:\\book_zwis`);
        }
    }

    console.log("possiblePaths", possiblePaths);

    for (const possiblePath of possiblePaths) {
        if (await validateZwiPath(possiblePath)) {
            return possiblePath;
        }
    }

    return null;
};

function selectZwiDirectory() {
    if (mainWindow) {
        mainWindow.focus();
    }
    return dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Locate the ZWI (book) files'
    }).then(result => {
        if (result.canceled) {
            return null;
        } else {
            return result.filePaths[0];
        }
    });
}

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
    });

    // Open external links in default browser
    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });
    

    // Read the last visited URL if it exists
    let initialUrl = `file://${path.join(__dirname, 'search.html')}`; // Default URL
    if (fs.existsSync(latestUrlPath)) {
        try {
            const relativeUrl = fs.readFileSync(latestUrlPath, 'utf8');
            initialUrl = `file://${path.join(__dirname, relativeUrl)}`;
            console.log("initialUrl:", initialUrl);
        } catch (error) {
            console.error('Error reading the last visited URL:', error);
        }
    }

    // Load the URL
    mainWindow.loadURL(initialUrl);

    // Set up event listeners for URL changes
    mainWindow.webContents.on('did-navigate', (event, url) => {
        saveRelativeUrl(url);
    });

    mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
        if (isMainFrame) {
            saveRelativeUrl(url);
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
                },
                {
                    label: 'Export ZWI (original book files)',
                    accelerator: 'CmdOrCtrl+Shift+Z',
                    click: () => {
                        mainWindow.webContents.send('export-zwi');
                    }
                },
                {
                    label: 'Import/Export User Data',
                    submenu: [
                        {
                            label: 'Export Bookshelf Data',
                            click: async () => {
                                await exportBookshelfData();
                            }
                        },
                        {
                            label: 'Import Bookshelf Data',
                            click: async () => {
                                await importBookshelfData();
                            }
                        },
                        {
                            label: 'Export Highlight/Note Data',
                            click: async () => {
                                await exportHlnotesData();
                            }
                        },
                        {
                            label: 'Import Highlight/Note Data',
                            click: async () => {
                                await importHlnotesData();
                            }
                        }
                    ]
                },
                {
                    label: 'Project Gutenberg book files (requires Internet)',
                    submenu: [
                        { label: 'Project Gutenberg book page', id: 'pgBookPage', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/') },
                        { label: 'Read online (HTML with images)', id: 'readOnline', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.html.images') },
                        { label: 'EPUB3 (E-readers, with images)', id: 'epub3', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.epub3.images') },
                        { label: 'EPUB (Older E-readers, with images)', id: 'epubOldImages', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.epub.images') },
                        { label: 'EPUB (No images, Older E-readers)', id: 'epubNoImages', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.epub.noimages') },
                        { label: 'Kindle with images', id: 'kindleImages', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.kf8.images') },
                        { label: 'Older Kindles with images', id: 'kindleOldImages', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.kindle.images') },
                        { label: 'Plain Text UTF-8', id: 'plainText', click: () => shell.openExternal('https://www.gutenberg.org/ebooks/.txt.utf-8') },
                        { label: 'Download HTML (ZIP)', id: 'downloadHtmlZip', click: () => shell.openExternal('https://www.gutenberg.org/cache/epub//pg-h.zip') }
                    ]
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
                {
                    label: 'Check Spelling (in Your Notes)',
                    type: 'checkbox',
                    checked: isSpellCheckEnabled,
                    click: toggleSpellChecking
                },
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
                    label: 'About ZWIBook',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.loadFile('about.html');
                        }
                    }
                },
                { 
                    label: 'Reset Books Location',
                    click: async () => {
                        await resetBooksLocation();
                    }
                },
                {
                    label: 'KSF Website (Encyclosphere.org)',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://encyclosphere.org');
                    }
                }
            ]
        }
    ];

    const fileMenuIndex = isMac ? 1 : 0; // This will select the correct index for the 'File' menu based on platform
    const pgSubMenuIndex = template[fileMenuIndex].submenu.length - 1;



    // CONTEXT (RIGHT-CLICK) MENU
    mainWindow.webContents.on('context-menu', (event, params) => {
        const contextMenu = new Menu();
        
        // Only show 'Copy' if text is selected
        if (params.selectionText) {
            contextMenu.append(new MenuItem({
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                role: 'copy'  // This automatically handles copying text to the clipboard
            }));
        }

        // 'Select All' is always visible
        contextMenu.append(new MenuItem({
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            role: 'selectAll'  // Automatically handles selecting all text
        }));

        // Check if the right-clicked element is an image
        if (params.mediaType === 'image') {
            contextMenu.append(new MenuItem({
                label: 'Download Image',
                click: () => {
                    const originalFilename = path.basename(params.srcURL);
                    console.log('Context menu clicked:', { srcURL: params.srcURL, originalFilename });
                    mainWindow.webContents.send('download-image-request', { imageUrl: params.srcURL, originalFilename });
                }
            }));
        }
        
        // Show these items only if some text is selected and it is under 50 characters
        if (params.selectionText && params.selectionText.length <= 50) {
            contextMenu.append(new MenuItem({
                label: 'Search for books on this',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    mainWindow.loadURL(`file://${__dirname}/search.html?q=${selectedText}`);
                }
            }));              
            contextMenu.append(new MenuItem({
                label: 'Look up on EncycloSearch.org',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    shell.openExternal(`https://encyclosearch.org/?q=${selectedText}`);
                }
            }));
            contextMenu.append(new MenuItem({
                label: 'Look up on EncycloReader.org',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    shell.openExternal(`https://encycloreader.org/find.php?query=${selectedText}`);
                }
            }));
            contextMenu.append(new MenuItem({
                label: 'Define on TheFreeDictionary.com',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    shell.openExternal(`https://www.thefreedictionary.com/_/search.aspx?tab=1&SearchBy=0&Word=${selectedText}&TFDBy=0`);
                }
            }));
        }

        // Translate options do not have the character limit but require text selection
        if (params.selectionText) {
            contextMenu.append(new MenuItem({
                label: 'Translate with Google',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    shell.openExternal(`https://translate.google.com/?sl=auto&tl=en&text=${selectedText}`);
                }
            }));
            contextMenu.append(new MenuItem({
                label: 'Translate with Bing',
                click: () => {
                    const selectedText = encodeURIComponent(params.selectionText);
                    shell.openExternal(`https://www.bing.com/translator/?text=${selectedText}`);
                }
            }));
            function truncateText(text, maxLength) {
                return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
            }
            function calculateRemainingChars(totalLimit, title, author, additionalChars) {
                return totalLimit - title.length - author.length - additionalChars;
            }            
            contextMenu.append(new MenuItem({
                label: 'Ask Bing Copilot (AI) to explain',
                click: () => {
                    const maxTotalCharsBing = 300;
                    const additionalFormattingChars = `Please explain this (source: "" by ): ""`.length;
                    
                    const truncatedTitle = truncateText(currentBookTitle, 40);
                    const truncatedAuthor = truncateText(currentBookAuthor, 30);
                    
                    const remainingCharsBing = calculateRemainingChars(maxTotalCharsBing, truncatedTitle, truncatedAuthor, additionalFormattingChars);
                    const truncatedSelectedText = params.selectionText.slice(0, remainingCharsBing);
                    
                    const prompt = `Please explain this (source: "${truncatedTitle}" by ${truncatedAuthor}): "${truncatedSelectedText}"`;
                    const formattedPrompt = encodeURIComponent(prompt);
                    const bingUrl = `https://www.bing.com/search?showconv=1&sendquery=1&q=${formattedPrompt}&qs=ds&form=CHRD01`;
                    shell.openExternal(bingUrl);
                }
            }));
            
            contextMenu.append(new MenuItem({
                label: 'Ask You.com (AI) to explain',
                click: () => {
                    const maxTotalCharsYou = 220;
                    const additionalFormattingChars = `Please explain this (source: "" by ): ""`.length;
                    
                    const truncatedTitle = truncateText(currentBookTitle, 40);
                    const truncatedAuthor = truncateText(currentBookAuthor, 30);
                    
                    const remainingCharsYou = calculateRemainingChars(maxTotalCharsYou, truncatedTitle, truncatedAuthor, additionalFormattingChars);
                    const truncatedSelectedText = params.selectionText.slice(0, remainingCharsYou);
                    
                    const prompt = `Please explain this (source: "${truncatedTitle}" by ${truncatedAuthor}): "${truncatedSelectedText}"`;
                    const formattedPrompt = encodeURIComponent(prompt);
                    const youUrl = `https://you.com/search?q=${formattedPrompt}&fromSearchBar=true&tbm=youchat`;
                    shell.openExternal(youUrl);
                }
            }));            
        }

        contextMenu.popup(mainWindow);
    });

    // Store references to submenu items
    gutenbergMenuItems = template[1].submenu;  // Adjust index according to your menu structure

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    
    let currentSearchText = '';

    // Listen to the search request
    ipcMain.on('perform-find', (event, text) => {
        if (text !== currentSearchText) {
            mainWindow.webContents.findInPage(text, { findNext: true });
            currentSearchText = text; // Store the new search text
        } else {
            mainWindow.webContents.findInPage(text);
        }
    });        
}

// Used to load latest.txt path
function saveRelativeUrl(absoluteUrl) {
    const relativeUrl = path.relative(__dirname, absoluteUrl.replace('file://', ''));
    fs.writeFileSync(latestUrlPath, relativeUrl, 'utf8');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
    try {
        // Load (or initialize) config (which says where ZWIs are located)
        let config = await loadConfig();

        // If unable to set up, initialize here
        if (!config) {
            config = {};
        }

        // Set data directory
        if (!config.dataDir) {
            dataDir = await setupDataDirectory(config); // This function sets up the data directory
            config.dataDir = dataDir;
            await saveConfig(config); // Save the config with the new data directory
        } else {
            dataDir = config.dataDir; // Use the existing data directory from the config
        }

        latestUrlPath = path.join(dataDir, 'latest.txt'); // Path for the latest URL file
        bookshelfPath = path.join(dataDir, 'bookshelf.json'); // Path for the bookshelf JSON file
        hlnotesPath = path.join(dataDir, 'hlnotes.json'); // Path for the highlights and notes JSON file

        // Check if the bookshelf file exists, if not, create it with default content
        if (!fs.existsSync(bookshelfPath)) {
            const defaultBookshelfContent = JSON.stringify({
                viewedBooks: [],
                savedBooks: [],
                readingPositions: [],
                bookmarks: []
            }, null, 2);
            await fs.promises.writeFile(bookshelfPath, defaultBookshelfContent);
        }

        // Check if the highlights and notes file exists; if not, create it with default content
        if (!fs.existsSync(hlnotesPath)) {
            const defaultHlnotesContent = JSON.stringify({}, null, 2);
            await fs.promises.writeFile(hlnotesPath, defaultHlnotesContent);
        }

        createWindow(); // Function to create the main application window

        // Check if zwiDirectoryPath is in the config
        if (!config.zwiDirectoryPath) {
            // Try to autodetect the ZWI directory path
            zwiDirectoryPath = await autodetectZwiDirectoryPath();
            // If autodetection fails, prompt the user to set it up
            if (!zwiDirectoryPath) {
                const zwiLocationChoice = await confirmZwiDirectory();
                zwiDirectoryPath = zwiLocationChoice === 0 ? getZwiDirectoryPath() : await selectZwiDirectory();
                // If the path is still not set, exit the application
                if (!zwiDirectoryPath) {
                    console.error('ZWI path could not be determined. Exiting application.');
                    dialog.showMessageBoxSync({
                        type: 'error',
                        title: 'Error',
                        message: 'Sorry, we could not locate the books. Closing the app.'
                    });
                    app.quit();
                    return;
                }
            }
            config.zwiDirectoryPath = zwiDirectoryPath; // Save the new ZWI directory path to config
            await saveConfig(config);
        } else {
            zwiDirectoryPath = config.zwiDirectoryPath; // Use the existing ZWI directory path from the config
            // Validate the existing ZWI directory path
            const isValidPath = await validateZwiPath(zwiDirectoryPath);
            if (!isValidPath) {
                // Try to autodetect the ZWI directory path
                zwiDirectoryPath = await autodetectZwiDirectoryPath();
                // If autodetection fails, prompt the user to set it up
                if (!zwiDirectoryPath) {
                    const zwiLocationChoice = await confirmZwiDirectory();
                    zwiDirectoryPath = zwiLocationChoice === 0 ? getZwiDirectoryPath() : await selectZwiDirectory();
                    // If the path is still not set, exit the application
                    if (!zwiDirectoryPath) {
                        console.error('ZWI path could not be determined. Exiting application.');
                        dialog.showMessageBoxSync({
                            type: 'error',
                            title: 'Error',
                            message: 'Sorry, we could not locate the books. Closing the app.'
                        });
                        app.quit();
                        return;
                    }
                }
                config.zwiDirectoryPath = zwiDirectoryPath; // Save the new ZWI directory path to config
                await saveConfig(config);
            }
        }
    } catch (err) {
        console.error('Failed during application initialization:', err);
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
        if (fs.existsSync(bookshelfPath)) {
            bookshelf = JSON.parse(fs.readFileSync(bookshelfPath, 'utf8'));
        } else {
            bookshelf = { viewedBooks: [], savedBooks: [] };
        }

        switch (action) {
            case 'removeAllViewed':
                bookshelf.viewedBooks = [];
                break;
            case 'removeAllSaved':
                bookshelf.savedBooks = [];
                break;
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
    console.log("Main process received save request:", bookId, "with position:", position);

    const bookshelf = getBookshelfData(); // Assuming this function retrieves your current bookshelf data correctly
    if (!bookshelf.readingPositions) {
        bookshelf.readingPositions = [];
    }

    let positionEntry = bookshelf.readingPositions.find(entry => entry.PG_ID === bookId);
    if (positionEntry) {
        positionEntry.lastReadPosition = position;  // Update position
    } else {
        bookshelf.readingPositions.push({
            PG_ID: bookId,
            lastReadPosition: position  // Create new position entry
        });
    }

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

// IPC handler to fetch ZWI files (used in reader.js)
ipcMain.handle('fetch-zwi', async (event, bookId) => {
    if (!zwiDirectoryPath) {
        console.error('ZWI directory path is not set.');
        return null;
    }

    const bookPath = path.join(zwiDirectoryPath, `${bookId}.zwi`);
    console.log(`Opening ${bookPath}`);

    try {
        const data = await fs.promises.readFile(bookPath);
        return data;  // Sending binary data directly, consider converting to base64 if needed
    } catch (error) {
        console.error('Error reading ZWI file:', error);
        return null; // Or send error details to handle on the client side
    }
});


// Construct the path to metadatabase.json
const metaDataPath = path.join(__dirname, 'metadatabase.json');

let metadatabase;

// Asynchronously read the file using the traditional callback method
fs.readFile(metaDataPath, 'utf8', (err, data) => {
    if (err) {
        console.error('Failed to load the metadatabase:', err);
        return; // Stop further execution in case of an error
    }
    try {
        metadatabase = JSON.parse(data);  // Parse the JSON data
    } catch (parseError) {
        console.error('Error parsing the metadatabase:', parseError);
    }
});

function searchDatabase(query, searchType) {
    console.log(query);
    if (!metadatabase) {
        console.log("Metadatabase not loaded yet.");
        return []; // Return empty array or suitable error response
    }

    let results = [];
    const orSplit = query.split(/\s+OR\s+/);
    let searchTerms = [];

    console.log("Split queries: ", orSplit); // Debug: Log split queries

    orSplit.forEach(subQuery => {
        subQuery = subQuery.trim(); // Trim spaces from each sub-query
        const keywords = subQuery.split(/\s+/);
        searchTerms.push(...keywords);
        console.log("Keywords for sub-query '" + subQuery + "':", keywords); // Debug: Log keywords

        // Collect initial results for the first keyword
        let subResults = metadatabase.filter(book => {
            let titleMatch = book.Title.toLowerCase().includes(keywords[0].toLowerCase());
            let authorMatch = Array.isArray(book.CreatorNames) && book.CreatorNames.some(author => author.toLowerCase().includes(keywords[0].toLowerCase()));

            switch (searchType) {
                case 'title':
                    return titleMatch;
                case 'author':
                    return authorMatch;
                case 'both':
                default:
                    return titleMatch || authorMatch;
            }
        });

        // For each additional keyword, filter the existing subResults
        for (let i = 1; i < keywords.length; i++) {
            const keyword = keywords[i].toLowerCase();
            subResults = subResults.filter(book => {
                let titleMatch = book.Title.toLowerCase().includes(keyword);
                let authorMatch = Array.isArray(book.CreatorNames) && book.CreatorNames.some(author => author.toLowerCase().includes(keyword));

                switch (searchType) {
                    case 'title':
                        return titleMatch;
                    case 'author':
                        return authorMatch;
                    case 'both':
                    default:
                        return titleMatch || authorMatch;
                }
            });
        }

        console.log("Results for sub-query '" + subQuery + "':", subResults.length); // Debug: Log results count for each sub-query
        results = results.concat(subResults);
    });

    // Remove duplicates
    results = results.filter((value, index, self) => self.findIndex(v => v.PG_ID === value.PG_ID) === index);

    // Throttle search when too much
    console.log("searchTerms:", searchTerms);
    const stopWords = ['the', 'of', 'in', 'on', 'at', 'for', 'with', 'a', 'an', 'and', 'or', 'but', 'is', 'if', 'it', 'as', 'to', 'that', 'which', 'by', 'from', 'up', 'out', 'off', 'this', 'all'];
    const searches = searchTerms.filter(term => !stopWords.includes(term.toLowerCase()));
    console.log("searchCount", searches.length);
    if (results.length > 5000 || searches.length > 3) {
        return "TOOMANYRESULTS";
    }

    return results;
}


ipcMain.handle('perform-search', async (event, { query, searchType }) => {
    return searchDatabase(query, searchType); // this assumes searchDatabase is defined as earlier mentioned
});

ipcMain.handle('fetch-book-metadata', async (event, bookId) => {
    if (!metadatabase) {
        console.log("Metadatabase not loaded yet.");
        return null;
    }

    const bookMetadata = metadatabase.find(book => book.PG_ID === bookId);
    if (bookMetadata) {
        return bookMetadata;  // Return the metadata as an object
    } else {
        console.error("No book found with ID:", bookId);
        return null;
    }
});

ipcMain.on('update-gutenberg-menu', (event, bookId) => {
    // Assume gutenbergMenuItems are stored globally or are fetched dynamically from the menu
    let menu = Menu.getApplicationMenu();
    let fileMenu = menu.items.find(m => m.label === 'File'); // Assuming 'File' is not a variable label
    let pgSubMenu = fileMenu.submenu.items.find(item => item.label === 'Project Gutenberg book files (requires Internet)');

    if (pgSubMenu && pgSubMenu.submenu) {
        pgSubMenu.submenu.items.forEach(item => {
            switch(item.id) {
                case 'pgBookPage':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}`);
                    break;
                case 'readOnline':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.html.images`);
                    break;
                case 'epub3':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.epub3.images`);
                    break;
                case 'epubOldImages':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.epub.images`);
                    break;
                case 'epubNoImages':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.epub.noimages`);
                    break;
                case 'kindleImages':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.kf8.images`);
                    break;
                case 'kindleOldImages':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.kindle.images`);
                    break;
                case 'plainText':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/ebooks/${bookId}.txt.utf-8`);
                    break;
                case 'downloadHtmlZip':
                    item.click = () => shell.openExternal(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-h.zip`);
                    break;
            }
        });

        // Rebuild and set the menu with updated items
        Menu.setApplicationMenu(menu);
    }
});


// Event listener to refresh the menu when called from the renderer process
ipcMain.on('refresh-menu', () => {
    if (mainWindow) {
        // Get the current URL and check if it includes 'reader.html'
        const isReaderPage = mainWindow.webContents.getURL().includes('reader.html');
        
        // Access the current menu
        let menu = Menu.getApplicationMenu();
        if (menu) {
            // Find the 'File' menu
            let fileMenu = menu.items.find(item => item.label === 'File');
            if (fileMenu) {
                // Find the 'Export ZWI' menu item
                const exportZwiItem = fileMenu.submenu.items.find(item => item.label === 'Export ZWI');
                if (exportZwiItem) {
                    // Update the visibility based on the current URL
                    exportZwiItem.visible = isReaderPage;
                }
            }
            // Do similar but for "Font styles..." now
            fileMenu = menu.items.find(item => item.label === 'Text and View');
            if (fileMenu) {
                const fontStylesItem = fileMenu.submenu.items.find(item => item.label.includes('Font styles'));
                if (fontStylesItem) {
                    fontStylesItem.visible = isReaderPage;
                }                
            }
            // Rebuild and reset the application menu to apply changes
            Menu.setApplicationMenu(menu);
        }
    }
});

ipcMain.on('finish-export-zwi', async (event, bookId) => {
    console.log(`Received export request for book ID: ${bookId}`);

    // Ensure the main window is focused before opening dialog
    mainWindow.focus();

    // Construct the path to the ZWI file
    let zwiFilePath = path.join(zwiDirectoryPath, `${bookId}.zwi`);

    // Check if the file exists
    if (fs.existsSync(zwiFilePath)) {
        // Prompt the user to select a save location
        const { canceled, filePath } = await dialog.showSaveDialog({
            parent: mainWindow,
            title: 'Save ZWI File',
            defaultPath: path.join(app.getPath('downloads'), `${bookId}.zwi`),
            buttonLabel: 'Save ZWI',
            filters: [{ name: 'ZWI Files', extensions: ['zwi'] }]
        });

        // If the user hasn't canceled, write the file to the new location
        if (!canceled && filePath) {
            fs.copyFile(zwiFilePath, filePath, (err) => {
                if (err) {
                    console.error('Failed to export ZWI file:', err);
                    event.reply('zwi-export-status', `Error exporting ZWI: ${err.message}`);
                } else {
                    console.log('ZWI file saved successfully:', filePath);
                    event.reply('zwi-export-status', 'File saved successfully!');
                }
            });
        } else {
            console.log('Export canceled by the user.');
            event.reply('zwi-export-status', 'Export canceled by user.');
        }
    } else {
        console.log(`ZWI file does not exist: ${zwiFilePath}`);
        event.reply('zwi-export-status', 'ZWI file not found.');
    }
});

// Handle download image request from renderer process
ipcMain.handle('download-image', async (event, imagePath) => {
    const absolutePath = path.resolve(__dirname, imagePath);

    try {
        const data = await fs.promises.readFile(absolutePath);
        return data.toString('base64'); // Return the image data as a base64 string
    } catch (error) {
        console.error('Failed to read image for download:', error);
        throw error; // Rethrow the error to be caught by the renderer process
    }
});

// Handle download image request from renderer process
ipcMain.on('download-image-request', (event, { imageUrl, originalFilename }) => {
    const absolutePath = path.resolve(__dirname, imageUrl);
    console.log('Download image request received:', { absolutePath, originalFilename });

    fs.promises.readFile(absolutePath)
        .then(data => {
            console.log('Image read successfully:', { absolutePath, originalFilename });
            event.sender.send('download-image', { data: data.toString('base64'), originalFilename });
        })
        .catch(error => {
            console.error('Failed to read image for download:', error);
        });
});

// Listen for the book info from the renderer process (Copilot inquiries)
ipcMain.on('send-book-info', (event, bookInfo) => {
    console.log("Setting title and author.");
    currentBookTitle = bookInfo.title;
    currentBookAuthor = bookInfo.author;
});

let zoomLevel = 0; // Initial zoom level

ipcMain.on('zoom', (event, deltaY) => {
    if (deltaY < 0) {
        zoomLevel += 0.1; // Zoom in
    } else {
        zoomLevel -= 0.1; // Zoom out
    }
    if (mainWindow) {
        mainWindow.webContents.setZoomLevel(zoomLevel);
    }
});

ipcMain.on('show-confirm-dialog', (event, message) => {
    const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Yes, delete', 'No, cancel'],
        defaultId: 0,
        title: 'Confirm',
        message: message,
    });
    event.returnValue = result === 0; // Returns true if 'OK' is clicked, false otherwise
});

ipcMain.on('show-alert-dialog', (event, message) => {
    const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Alert',
        message: message,
    });
    event.returnValue = result === 0; // Returns true if 'OK' is clicked
});

let isSpellCheckEnabled = false; // Default value

// Function to toggle spell-checking
function toggleSpellChecking() {
    isSpellCheckEnabled = !isSpellCheckEnabled;
    mainWindow.webContents.send('toggle-spell-checking', isSpellCheckEnabled);
}


// Function to read highlights and notes data from a JSON file
async function readHlnotesData(bookId) {
    try {
        if (fs.existsSync(hlnotesPath)) {
            const fileData = await fs.promises.readFile(hlnotesPath, 'utf8');
            const currentData = JSON.parse(fileData);

            const highlights = currentData.highlights ? currentData.highlights[bookId] : {};
            const notes = currentData.notes ? currentData.notes[bookId] : {};

            return { highlights, notes };
        }
        return { highlights: {}, notes: {} };
    } catch (error) {
        console.error('Error reading hlnotes data:', error);
        return { highlights: {}, notes: {} };
    }
}

// Function to write highlights and notes data to a JSON file
async function writeHlnotesData(bookId, data) {
    try {
        let currentData = {};
        if (fs.existsSync(hlnotesPath)) {
            const fileData = await fs.promises.readFile(hlnotesPath, 'utf8');
            currentData = JSON.parse(fileData);
        }
        if (!currentData.highlights) {
            currentData.highlights = {};
        }
        if (!currentData.notes) {
            currentData.notes = {};
        }

        // Merge highlights
        if (data.highlights && data.highlights[bookId]) {
            currentData.highlights[bookId] = data.highlights[bookId];
        }

        // Merge notes
        if (data.notes && data.notes[bookId]) {
            currentData.notes[bookId] = data.notes[bookId];
        }

        await fs.promises.writeFile(hlnotesPath, JSON.stringify(currentData, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing hlnotes data:', error);
    }
}

// IPC handlers
ipcMain.handle('read-hlnotes-data', async (event, bookId) => {
    return await readHlnotesData(bookId);
});

ipcMain.handle('write-hlnotes-data', async (event, bookId, data) => {
    await writeHlnotesData(bookId, data);
});


//////////////////////////////////////////////////
// Import/export of bookshelf and highlights/notes
async function exportBookshelfData() {
    const options = {
        title: 'Save Bookshelf Data',
        defaultPath: 'bookshelf.json',
        buttonLabel: 'Save',
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    };

    const { filePath, canceled } = await dialog.showSaveDialog(options);

    if (!canceled && filePath) {
        try {
            await fs.promises.copyFile(bookshelfPath, filePath);
            dialog.showMessageBox({
                type: 'info',
                buttons: ['OK'],
                title: 'Export Successful',
                message: 'This file, bookshelf.json, has your books saved, books viewed, the last-read position for each book, and bookmark positions. You should be able to import this file into any instance of ZWIBook. Your highlights and notes are in a separate file, which must be exported and imported separately.'
            });
            console.log('Bookshelf data exported successfully to:', filePath);
        } catch (error) {
            console.error('Error exporting bookshelf data:', error);
            dialog.showMessageBox({
                type: 'error',
                buttons: ['OK'],
                title: 'Export Failed',
                message: 'An error occurred while exporting the bookshelf data. Please try again.'
            });
        }
    }
}

async function importBookshelfData() {
    // Prompt the user to select a file
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Bookshelf Data',
        buttonLabel: 'Import',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    // Check if the user canceled the dialog
    if (canceled) {
        console.log('Import canceled by user');
        return;
    }

    // Read the selected file
    const filePath = filePaths[0];
    const fileContent = await fs.promises.readFile(filePath, 'utf-8');

    // Parse the JSON content
    let importedData;
    try {
        importedData = JSON.parse(fileContent);
    } catch (error) {
        console.error('Error parsing JSON file:', error);
        dialog.showErrorBox('Import Error', 'The selected file is not a valid JSON file. Please check the file format and try again.');
        return;
    }

    // Validate the imported data
    const validationResult = validateBookshelfData(importedData);
    if (!validationResult.isValid) {
        console.error('Bookshelf data is invalid:', validationResult.errors);
        dialog.showErrorBox('Import Error', `The selected file is not a valid bookshelf data file. Errors: ${validationResult.errors.join(', ')}`);
        return;
    }

    // Prompt the user for confirmation
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        title: 'Confirm Import',
        message: 'Importing this file will overwrite your current bookshelf data. Are you sure you want to proceed?',
        detail: 'This file, bookshelf.json, has your books saved, books viewed, the last-read position for each book, and bookmark positions. You should be able to import this file into any instance of ZWIBook. Your highlights and notes are in a separate file, which must be exported and imported separately.'
    });

    // Check if the user confirmed the import
    if (response !== 0) {
        console.log('Import canceled by user');
        dialog.showMessageBox({
            type: 'info',
            buttons: ['OK'],
            defaultId: 0,
            title: 'Import Canceled',
            message: 'Import canceled. The file was not imported.'
        });
        return;
    }

    // Write the imported data to the bookshelf.json file
    try {
        await fs.promises.writeFile(bookshelfPath, JSON.stringify(importedData, null, 2), 'utf-8');
        console.log('Bookshelf data imported successfully');
    } catch (error) {
        console.error('Error writing bookshelf data file:', error);
        dialog.showErrorBox('Import Error', 'Failed to write the bookshelf data file. Please check file permissions and try again.');
        return;
    }

    // Restart the app
    dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Restart Required',
        message: 'The app will now restart to apply the imported bookshelf data.'
    }).then(() => {
        app.relaunch();
        app.exit();
    });
}

function validateBookshelfData(data) {
    let isValid = true;
    let errors = [];

    // Check if the root keys are valid
    const validRootKeys = ['viewedBooks', 'savedBooks', 'readingPositions', 'bookmarks'];
    const rootKeys = Object.keys(data);

    rootKeys.forEach(key => {
        if (!validRootKeys.includes(key)) {
            isValid = false;
            errors.push(`Invalid root key: ${key}`);
        }
    });

    // Validate viewedBooks
    if (data.viewedBooks) {
        data.viewedBooks.forEach((book, index) => {
            if (!book.Title) {
                isValid = false;
                errors.push(`Missing Title in viewedBooks at index ${index}`);
            }
            if (!(book.CreatorNames === "" || (Array.isArray(book.CreatorNames) && book.CreatorNames.every(name => typeof name === 'string')))) {
                isValid = false;
                errors.push(`Invalid CreatorNames in viewedBooks at index ${index}`);
            }
        });
    }

    // Validate savedBooks
    if (data.savedBooks) {
        data.savedBooks.forEach((book, index) => {
            if (!book.Title) {
                isValid = false;
                errors.push(`Missing Title in savedBooks at index ${index}`);
            }
            if (!Array.isArray(book.CreatorNames) || !book.CreatorNames.every(name => typeof name === 'string')) {
                isValid = false;
                errors.push(`Invalid CreatorNames in savedBooks at index ${index}`);
            }
        });
    }

    // Validate readingPositions
    if (data.readingPositions) {
        data.readingPositions.forEach((position, index) => {
            if (!position.PG_ID) {
                isValid = false;
                errors.push(`Missing PG_ID in readingPositions at index ${index}`);
            }
            if (typeof position.lastReadPosition !== 'string') {
                isValid = false;
                errors.push(`Invalid lastReadPosition in readingPositions at index ${index}`);
            }
        });
    }

    // Validate bookmarks
    if (data.bookmarks) {
        data.bookmarks.forEach((bookmark, index) => {
            if (!bookmark.PG_ID) {
                isValid = false;
                errors.push(`Missing PG_ID in bookmarks at index ${index}`);
            }
            if (!Array.isArray(bookmark.positions) || !bookmark.positions.every(pos => typeof pos === 'string')) {
                isValid = false;
                errors.push(`Invalid positions in bookmarks at index ${index}`);
            }
        });
    }

    return { isValid, errors };
}

async function exportHlnotesData() {
    try {
        // Prompt the user to choose a save location
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Export Highlight/Note Data',
            defaultPath: path.join(app.getPath('documents'), 'hlnotes.json'),
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ]
        });

        if (canceled) {
            console.log('Export canceled');
            return;
        }

        // Read the current hlnotes.json file
        const hlnotesPath = path.join(dataDir, 'hlnotes.json');
        const hlnotesData = fs.readFileSync(hlnotesPath, 'utf-8');

        // Save the file to the chosen location
        fs.writeFileSync(filePath, hlnotesData);

        dialog.showMessageBox({
            type: 'info',
            buttons: ['OK'],
            title: 'Export Successful',
            message: 'This file, hlnotes.json, contains your highlights and notes. You should be able to import this file into any instance of ZWIBook.'
        });
        console.log('Highlight/Note data exported successfully to:', filePath);
    } catch (error) {
        console.error('Error exporting Highlight/Note data:', error);
        dialog.showMessageBox({
            type: 'error',
            buttons: ['OK'],
            title: 'Export Failed',
            message: 'An error occurred while exporting the Highlight/Note data. Please try again.'
        });
    }
}

async function importHlnotesData() {
    // Check if the current window is displaying reader.html
    const currentUrl = mainWindow.webContents.getURL();
    const isReaderOpen = currentUrl.includes('reader.html');

    if (isReaderOpen) {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Import Canceled',
            message: 'Please close the current book and then try again.'
        });
        return;
    }

    // Prompt the user to select a file
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import Highlight/Note Data',
        buttonLabel: 'Import',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
        dialog.showMessageBox({
            type: 'info',
            title: 'Import Canceled',
            message: 'Import canceled. The file was not imported.'
        });
        return;
    }

    const filePath = filePaths[0];

    // Read the file content
    let fileContent;
    try {
        fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error('Failed to read the file:', error);
        dialog.showErrorBox('Read Error', 'There was an error reading the file. Please try again.');
        return;
    }

    // Parse the JSON content
    let importedData;
    try {
        importedData = JSON.parse(fileContent);
    } catch (error) {
        console.error('Failed to parse JSON:', error);
        dialog.showErrorBox('Parse Error', 'The selected file is not a valid JSON file. Please check the file format and try again.');
        return;
    }

    // Validate the imported data
    const validationResult = validateHlnotesData(importedData);
    if (!validationResult.isValid) {
        console.error('Highlight/Note data is invalid:', validationResult.errors);
        dialog.showErrorBox('Import Error', `The selected file is not a valid highlight/note data file. Please check the file format and try again.\n\nErrors:\n${validationResult.errors.join('\n')}`);
        return;
    }

    // Prompt the user for confirmation
    const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Yes', 'No'],
        defaultId: 1,
        title: 'Confirm Import',
        message: 'Importing this file will overwrite your current highlight/note data. Are you sure you want to proceed?',
        detail: 'This file, hlnotes.json, contains all your highlights and notes. You should be able to import this file into any instance of ZWIBook. Your bookshelf data is in a separate file, which must be exported and imported separately.'
    });

    // Check if the user confirmed the import
    if (response !== 0) {
        dialog.showMessageBox({
            type: 'info',
            title: 'Import Canceled',
            message: 'Import canceled. The file was not imported.'
        });
        return;
    }

    // Save the new data
    try {
        fs.writeFileSync(hlnotesPath, JSON.stringify(importedData, null, 4));
        console.log('Highlight/Note data successfully imported.');
    } catch (error) {
        console.error('Failed to save the imported data:', error);
        dialog.showErrorBox('Save Error', 'There was an error saving the imported data. Please try again.');
        return;
    }

    // Inform the user that the import was successful and restart the app
    dialog.showMessageBox({
        type: 'info',
        title: 'Import Successful',
        message: 'Highlight/Note data imported successfully. Please now restart the app (if it doesn\'t start automatically).'
    }).then(() => {
        app.relaunch();
        app.exit();
    });
}

function validateHlnotesData(data) {
    let isValid = true;
    let errors = [];

    if (typeof data !== 'object' || data === null) {
        isValid = false;
        errors.push('Data should be an object.');
        return { isValid, errors };
    }

    const { highlights, notes } = data;

    if (highlights !== undefined) {
        if (typeof highlights !== 'object' || highlights === null) {
            isValid = false;
            errors.push('Invalid highlights format: should be an object.');
        } else {
            for (const bookId in highlights) {
                const bookHighlights = highlights[bookId];
                if (typeof bookHighlights !== 'object' || bookHighlights === null) {
                    isValid = false;
                    errors.push(`Invalid highlights format for bookId ${bookId}: should be an object.`);
                } else {
                    for (const paragraphId in bookHighlights) {
                        const paragraphHighlight = bookHighlights[paragraphId];
                        if (typeof paragraphHighlight !== 'object' || paragraphHighlight === null) {
                            isValid = false;
                            errors.push(`Invalid highlights format for paragraphId ${paragraphId} in bookId ${bookId}: should be an object.`);
                        } else {
                            if (typeof paragraphHighlight.cleanedHTML !== 'string') {
                                isValid = false;
                                errors.push(`Invalid cleanedHTML format for paragraphId ${paragraphId} in bookId ${bookId}: should be a string.`);
                            }
                            if (typeof paragraphHighlight.highlightedHTML !== 'string') {
                                isValid = false;
                                errors.push(`Invalid highlightedHTML format for paragraphId ${paragraphId} in bookId ${bookId}: should be a string.`);
                            }
                            if (!Array.isArray(paragraphHighlight.hnids) || !paragraphHighlight.hnids.every(hnid => typeof hnid === 'number')) {
                                isValid = false;
                                errors.push(`Invalid hnids format for paragraphId ${paragraphId} in bookId ${bookId}: should be an array of numbers.`);
                            }
                        }
                    }
                }
            }
        }
    }

    if (notes !== undefined) {
        if (typeof notes !== 'object' || notes === null) {
            isValid = false;
            errors.push('Invalid notes format: should be an object.');
        } else {
            for (const bookId in notes) {
                const bookNotes = notes[bookId];
                if (typeof bookNotes !== 'object' || bookNotes === null) {
                    isValid = false;
                    errors.push(`Invalid notes format for bookId ${bookId}: should be an object.`);
                } else {
                    const { hnids } = bookNotes;
                    if (hnids !== undefined) {
                        if (typeof hnids !== 'object' || hnids === null) {
                            isValid = false;
                            errors.push(`Invalid hnids format for bookId ${bookId}: should be an object.`);
                        } else {
                            for (const hnid in hnids) {
                                if (typeof hnids[hnid] !== 'string') {
                                    isValid = false;
                                    errors.push(`Invalid hnid format for hnid ${hnid} in bookId ${bookId}: should be a string.`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return { isValid, errors };
}

// Let user determine a new location for the book zwi files
async function resetBooksLocation() {
    const newZwiDirectoryPath = await selectZwiDirectory();
    if (!newZwiDirectoryPath) {
        dialog.showMessageBoxSync({
            type: 'error',
            title: 'Error',
            message: 'No directory selected. Books location remains unchanged.'
        });
        return;
    }
    
    const isValidPath = await validateZwiPath(newZwiDirectoryPath);
    if (!isValidPath) {
        dialog.showMessageBoxSync({
            type: 'error',
            title: 'Error',
            message: 'Selected directory is invalid. Books location remains unchanged.'
        });
        return;
    }

    let config = await loadConfig();
    config.zwiDirectoryPath = newZwiDirectoryPath;
    await saveConfig(config);
    zwiDirectoryPath = newZwiDirectoryPath;
    
    dialog.showMessageBoxSync({
        type: 'info',
        title: 'Success',
        message: 'Books location has been successfully updated.'
    });

    console.log('Books location updated successfully to:', newZwiDirectoryPath);
}

// IPC Communication Handler
ipcMain.handle('reset-books-location', async () => {
    await resetBooksLocation();
});