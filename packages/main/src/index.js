import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { URL } from "url";
const Config = require("electron-config");
const config = new Config();

ipcMain.handle("select-wavs", async () => {
  const { dialog } = require("electron");
  return await dialog.showOpenDialog({
    filters: [{ name: "Wav Files", extensions: ["wav"] }],
    properties: ["openFile", "multiSelections"],
  });
});

ipcMain.handle("select-media", async () => {
  const { dialog } = require("electron");
  return await dialog.showOpenDialog({
    filters: [{ name: "Sound Files", extensions: ["wav", "mp3"] }],
    properties: ["openFile"],
  });
});

ipcMain.handle("select-proj", async () => {
  const { dialog } = require("electron");
  const pathes = await dialog.showOpenDialog({
    filters: [{ name: "Proj File", extensions: ["json"] }],
    properties: ["openFile"],
  });
  return pathes.filePaths[0];
});

ipcMain.handle("select-asr", async () => {
  const { dialog } = require("electron");
  return await dialog.showOpenDialog({
    properties: ["openFile"],
  });
});
ipcMain.handle("select-mp3", async function (_, path) {
  const { dialog } = require("electron");
  return await dialog.showSaveDialog({
    defaultPath: path,
    filters: [{ name: "Mp3 File", extensions: ["mp3"] }],
    properties: ["saveFile"],
  });
});
ipcMain.handle("save-wav", async function (_, path) {
  const { dialog } = require("electron");
  return await dialog.showSaveDialog({
    defaultPath: path,
    filters: [{ name: "Wave File", extensions: ["wav"] }],
    properties: ["saveFile"],
  });
});

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}

app.disableHardwareAcceleration();

// Install "Vue.js devtools"
if (import.meta.env.MODE === "development") {
  app
    .whenReady()
    .then(() => import("electron-devtools-installer"))
    .then(({ default: installExtension, VUEJS3_DEVTOOLS }) =>
      installExtension(VUEJS3_DEVTOOLS, {
        loadExtensionOptions: {
          allowFileAccess: true,
        },
      })
    )
    .catch((e) => console.error("Failed install extension:", e));
}

let mainWindow = null;

const createWindow = async () => {
  let opts = {
    show: false,
    webPreferences: {
      nativeWindowOpen: true,
      preload: join(__dirname, "../../preload/dist/index.cjs"),
    },
  };

  Object.assign(opts, config.get("winBounds") || {});
  if (opts.x && opts.x < 0) opts.x = 0;
  if (opts.y && opts.y < 0) opts.y = 0;
  if (opts.width && opts.width < 320) opts.width = 320;
  if (opts.height && opts.height < 240) opts.height = 240;
  mainWindow = new BrowserWindow(opts);

  /**
   * If you install `show: true` then it can cause issues when trying to close the window.
   * Use `show: false` and listener events `ready-to-show` to fix these issues.
   *
   * @see https://github.com/electron/electron/issues/25012
   */
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    // const winState = config.get("mainWinState");
    // if (winState === "maxed") mainWindow?.maximize();
    // else if (winState === "fullscreen") mainWindow?.setFullScreen(true);
  });

  mainWindow.on("close", () => {
    config.set("winBounds", mainWindow.getBounds());
    if (mainWindow.isFullScreen()) {
      config.set("mainWinState", "fullscreen");
    } else if (mainWindow.isMaximized()) {
      config.set("mainWinState", "maxed");
    } else {
      config.set("mainWinState", "normal");
    }
  });

  /**
   * URL for main window.
   * Vite dev server for development.
   * `file://../renderer/index.html` for production and test
   */
  const pageUrl =
    import.meta.env.MODE === "development" &&
    import.meta.env.VITE_DEV_SERVER_URL !== undefined
      ? import.meta.env.VITE_DEV_SERVER_URL
      : new URL(
          "../renderer/dist/index.html",
          "file://" + __dirname
        ).toString();

  await mainWindow.loadURL(pageUrl);
};

app.on("second-instance", () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app
  .whenReady()
  .then(createWindow)
  .catch((e) => console.error("Failed create window:", e));

// Auto-updates
if (import.meta.env.PROD) {
  app
    .whenReady()
    .then(() => import("electron-updater"))
    .then(({ autoUpdater }) => autoUpdater.checkForUpdatesAndNotify())
    .catch((e) => console.error("Failed check updates:", e));
}
