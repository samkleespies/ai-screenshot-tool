const { app, BrowserWindow, Tray, Menu, ipcMain, screen, clipboard, globalShortcut, nativeImage, desktopCapturer } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let tray = null;
let keyboardListener = null;
let selectionWindow = null;
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

let hotkeyConfig = {
  keys: isMac ? ['Command', 'Shift', 'S'] : ['Ctrl', 'Shift', 'S'],
  nodeKeys: isMac ? ['LEFT META', 'LEFT SHIFT', 'S'] : ['LEFT CTRL', 'LEFT SHIFT', 'S']
};

const prefsPath = path.join(app.getPath('userData'), 'preferences.json');

function loadPreferences() {
  try {
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(data);
      
      if (prefs.hotkey) {
        hotkeyConfig = prefs.hotkey;
      }
      
      console.log('Loaded preferences:', prefs);
    }
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

function savePreferences() {
  try {
    const prefs = {
      hotkey: hotkeyConfig
    };
    
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    console.log('Saved preferences:', prefs);
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    autoHideMenuBar: true,
    icon: getAppIcon()
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('restore', () => {
    mainWindow.setSize(400, 300);
  });

  mainWindow.on('show', () => {
    mainWindow.setSize(400, 300);
  });

  mainWindow.on('close', (event) => {
  });
}

function getAppIcon() {
  if (isMac) {
    return path.join(__dirname, 'icon.icns');
  } else {
    return path.join(__dirname, 'icon.ico');
  }
}

function setupTray() {
  try {
    tray = new Tray(getAppIcon());
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          mainWindow.setSize(400, 300);
          mainWindow.show();
        }
      },
      {
        label: 'Exit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('AI Screenshot Tool');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      mainWindow.setSize(400, 300);
      mainWindow.show();
    });
  } catch (error) {
    console.error('Error setting up tray:', error);
  }
}

function createSelectionWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  selectionWindow = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  selectionWindow.loadFile('selection.html');
  selectionWindow.setFullScreen(true);
}

function setupHotkeys() {
  keyboardListener = new GlobalKeyboardListener();
  
  const isScreenshotHotkey = (e, down) => {
    if (e.state === 'DOWN' && e.name === hotkeyConfig.nodeKeys[hotkeyConfig.nodeKeys.length - 1]) {
      const modifierKeys = hotkeyConfig.nodeKeys.slice(0, -1);
      return modifierKeys.every(key => down.includes(key));
    }
    return false;
  };

  let downKeys = new Set();

  keyboardListener.addListener((e) => {
    if (e.state === 'DOWN') {
      downKeys.add(e.name);
    } else if (e.state === 'UP') {
      downKeys.delete(e.name);
    }

    if (isScreenshotHotkey(e, Array.from(downKeys))) {
      console.log('Screenshot hotkey detected');
      startScreenshotProcess();
    }
  });
}

function convertToNodeKeys(uiKeys) {
  const nodeKeys = [];
  
  for (const key of uiKeys) {
    if (key === 'Ctrl') {
      nodeKeys.push('LEFT CTRL');
    } else if (key === 'Shift') {
      nodeKeys.push('LEFT SHIFT');
    } else if (key === 'Alt') {
      nodeKeys.push('LEFT ALT');
    } else if (key === 'Command') {
      nodeKeys.push('LEFT META');
    } else {
      nodeKeys.push(key);
    }
  }
  
  return nodeKeys;
}

async function startScreenshotProcess() {
  try {
    console.log('Starting screenshot process');
    createSelectionWindow();
  } catch (error) {
    console.error('Error in screenshot process:', error);
    mainWindow.webContents.send('screenshot-error', error.message);
  }
}

async function captureArea(bounds) {
  try {
    console.log('Capturing area with bounds:', bounds);
    
    // First, capture the entire screen
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'],
      thumbnailSize: {
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: screen.getPrimaryDisplay().workAreaSize.height
      }
    });
    
    // Get the primary display source
    const primarySource = sources[0];
    
    if (!primarySource) {
      throw new Error('No screen source found');
    }
    
    // Create a native image from the thumbnail
    const fullScreenImg = primarySource.thumbnail;
    
    // Crop the image to the selected bounds
    const croppedImg = fullScreenImg.crop({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    
    // Save the cropped image to disk temporarily (for debugging)
    const tempImagePath = path.join(os.tmpdir(), 'ai-screenshot-app-temp.png');
    fs.writeFileSync(tempImagePath, croppedImg.toPNG());
    
    // Copy the cropped image to clipboard
    clipboard.writeImage(croppedImg);
    console.log('Screenshot copied to clipboard');

    console.log('Opening ChatGPT...');
    
    if (isWindows) {
      openChatGPTWindows();
    } else if (isMac) {
      openChatGPTMac();
    }
    
    return tempImagePath;
  } catch (error) {
    console.error('Error capturing area:', error);
    throw error;
  }
}

function openChatGPTWindows() {
  exec('start https://chat.openai.com/');
  
  const vbsPath = path.join(os.tmpdir(), 'paste-to-chatgpt.vbs');
  const vbsScript = `
    Set WshShell = WScript.CreateObject("WScript.Shell")
    
    WScript.Sleep 500
    
    Dim windowFound
    Dim attemptCount
    windowFound = False
    attemptCount = 0
    maxAttempts = 60
    
    Do While Not windowFound And attemptCount < maxAttempts
      On Error Resume Next
      
      If WshShell.AppActivate("ChatGPT") Then
        windowFound = True
      ElseIf WshShell.AppActivate("chat.openai.com") Then
        windowFound = True
      ElseIf WshShell.AppActivate("New chat - ChatGPT") Then
        windowFound = True
      End If
      
      If Err.Number <> 0 Then
        windowFound = False
        Err.Clear
      End If
      
      If Not windowFound Then
        WScript.Sleep 500
        attemptCount = attemptCount + 1
      End If
    Loop
    
    If windowFound Then
      WScript.Sleep 1000
      WshShell.SendKeys("^v")
    End If
  `;
  
  fs.writeFileSync(vbsPath, vbsScript);
  exec(`cscript "${vbsPath}"`, (error) => {
    if (error) {
      console.error('Error executing VBS script:', error);
    }
    
    // Clean up: delete the VBS script
    fs.unlink(vbsPath, (err) => {
      if (err) console.error('Error deleting VBS script:', err);
    });
  });
}

function openChatGPTMac() {
  exec('open https://chat.openai.com/');
  
  // Create AppleScript to paste the image
  const asPath = path.join(os.tmpdir(), 'paste-to-chatgpt.scpt');
  const appleScript = `
    set maxAttempts to 60
    set attemptCount to 0
    set windowFound to false
    
    repeat until windowFound or attemptCount ≥ maxAttempts
      delay 0.5
      set attemptCount to attemptCount + 1
      
      tell application "System Events"
        set visibleProcesses to name of every process whose visible is true
      end tell
      
      if visibleProcesses contains "Google Chrome" or visibleProcesses contains "Safari" or visibleProcesses contains "Firefox" then
        try
          tell application "System Events"
            set frontApp to name of first process whose frontmost is true
            if frontApp is "Google Chrome" or frontApp is "Safari" or frontApp is "Firefox" then
              set windowFound to true
              delay 1
              keystroke "v" using {command down}
            end if
          end tell
        end try
      end if
    end repeat
  `;
  
  fs.writeFileSync(asPath, appleScript);
  exec(`osascript "${asPath}"`, (error) => {
    if (error) {
      console.error('Error executing AppleScript:', error);
    }
    
    // Clean up: delete the AppleScript
    fs.unlink(asPath, (err) => {
      if (err) console.error('Error deleting AppleScript:', err);
    });
  });
}

ipcMain.on('capture-area', async (event, bounds) => {
  if (selectionWindow) {
    selectionWindow.close();
    selectionWindow = null;
  }
  await captureArea(bounds);
});

ipcMain.on('cancel-selection', () => {
  if (selectionWindow) {
    selectionWindow.close();
    selectionWindow = null;
  }
});

ipcMain.on('get-hotkey', (event) => {
  event.reply('current-hotkey', hotkeyConfig.keys);
});

ipcMain.on('save-hotkey', (event, newHotkey) => {
  console.log('Saving new hotkey:', newHotkey);
  
  hotkeyConfig.keys = newHotkey;
  hotkeyConfig.nodeKeys = convertToNodeKeys(newHotkey);
  
  savePreferences();
  
  event.reply('current-hotkey', hotkeyConfig.keys);
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.ai-screenshot.app');
  }
  
  loadPreferences();
  
  createWindow();
  setupTray();
  setupHotkeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (keyboardListener) {
    keyboardListener.kill();
  }
  
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
