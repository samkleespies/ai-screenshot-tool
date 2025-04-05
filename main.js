const { app, BrowserWindow, Tray, Menu, ipcMain, screen, clipboard, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let tray = null;
let keyboardListener = null;
let selectionWindow = null;

let hotkeyConfig = {
  keys: ['Ctrl', 'Shift', 'S'],
  nodeKeys: ['LEFT CTRL', 'LEFT SHIFT', 'S']
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
    icon: path.join(__dirname, 'icon.ico')
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

function setupTray() {
  try {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
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
    const image = await screenshot({
      screen: 0,
      ...bounds
    });

    const tempImagePath = path.join(os.tmpdir(), 'ai-screenshot-app-temp.png');
    fs.writeFileSync(tempImagePath, image);

    const nativeImg = nativeImage.createFromPath(tempImagePath);
    clipboard.writeImage(nativeImg);
    console.log('Screenshot copied to clipboard');

    console.log('Opening ChatGPT...');
    exec('start https://chat.openai.com/');
    
    const vbsPath = path.join(os.tmpdir(), 'paste-to-chatgpt.vbs');
    const vbsScript = `
      Set WshShell = WScript.CreateObject("WScript.Shell")
      
      WScript.Sleep 500
      
      Dim windowFound
      Dim attemptCount
      windowFound = False
      attemptCount = 0
      maxAttempts = 60 ' Try for up to 60 seconds
      
      Do While Not windowFound And attemptCount < maxAttempts
        On Error Resume Next
        
        If WshShell.AppActivate("ChatGPT") Then
          windowFound = True
        ElseIf WshShell.AppActivate("chat.openai.com") Then
          windowFound = True
        ElseIf WshShell.AppActivate("New chat - ChatGPT") Then
          windowFound = True
        ElseIf WshShell.AppActivate("OpenAI") Then
          windowFound = True
        ElseIf WshShell.AppActivate("New chat") Then
          windowFound = True
        End If
        
        If Not windowFound Then
          WScript.Sleep 500 ' Check twice per second
          attemptCount = attemptCount + 1
        End If
      Loop
      
      If windowFound Then
        WScript.Sleep 800
        
        On Error Resume Next
        WshShell.AppActivate("ChatGPT")
        WshShell.AppActivate("chat.openai.com")
        
        WshShell.SendKeys "^v"
        
        WScript.Echo "Screenshot pasted successfully"
      Else
        WScript.Echo "Timed out waiting for ChatGPT window"
      End If
      
      Set WshShell = Nothing
    `;
    
    fs.writeFileSync(vbsPath, vbsScript);
    
    const vbsProcess = exec(`cscript //NoLogo "${vbsPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing VBS script:', error);
        mainWindow.webContents.send('paste-error', 'Failed to paste screenshot automatically');
      } else {
        console.log('VBS output:', stdout.trim());
        if (stdout.includes("pasted successfully")) {
          mainWindow.webContents.send('paste-success');
        } else if (stdout.includes("timed out")) {
          console.log('Could not find ChatGPT window. Screenshot is still in clipboard.');
          mainWindow.webContents.send('paste-timeout');
        }
      }
    });
    
    mainWindow.webContents.send('screenshot-taken');
    console.log('Screenshot captured and ChatGPT opened. Waiting for page to load...');
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    mainWindow.webContents.send('screenshot-error', error.message);
  }
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
