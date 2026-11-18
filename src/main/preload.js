// Exposes a tiny, explicit API to the renderer. Nothing here yet beyond
// platform info; the Google Sheets bridge (OAuth + API calls) will live here
// so credentials never touch the renderer.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('butxaca', {
  platform: process.platform,
  isElectron: true,
});
