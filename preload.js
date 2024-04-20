const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateBookshelf: (bookMetadata) => ipcRenderer.send('update-bookshelf', bookMetadata),
    onBookshelfUpdated: (func) => {
        ipcRenderer.on('bookshelf-update-confirmation', (event, ...args) => func(...args));
    },
    requestBookshelfData: () => ipcRenderer.invoke('get-bookshelf-data'),
});
