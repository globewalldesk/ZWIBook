const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateBookshelf: (bookMetadata) => ipcRenderer.send('update-bookshelf', bookMetadata),
    onBookshelfUpdated: (func) => {
        ipcRenderer.on('bookshelf-update-confirmation', (event, ...args) => func(...args));
    },
    requestBookshelfData: () => ipcRenderer.invoke('get-bookshelf-data'),
    sendLastReadPosition: (data) => ipcRenderer.send('save-last-read-position', data),
    sendBookmarkUpdate: (data) => ipcRenderer.send('update-bookmark', data),
    requestBookmarks: (bookId) => ipcRenderer.invoke('get-bookmarks', bookId),
    performFind: (text) => ipcRenderer.send('perform-find', text),
    findNext: () => ipcRenderer.send('find-next'),
    onToggleFindModal: (callback) => ipcRenderer.on('toggle-find-modal', callback),
    onChooseFont: (callback) => ipcRenderer.on('choose-font', (event) => callback()),
    applyFont: (fontName) => ipcRenderer.send('apply-font', fontName),
    fetchZWI: (bookId) => ipcRenderer.invoke('fetch-zwi', bookId)
});
