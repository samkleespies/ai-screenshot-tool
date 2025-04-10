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

let hotkeyConfig = {
  keys: ['Ctrl', 'Shift', 'S'],
  nodeKeys: ['LEFT CTRL', 'LEFT SHIFT', 'S']
};

let pasteDestination = 'chatgpt'; // Default destination

const prefsPath = path.join(app.getPath('userData'), 'preferences.json');

function loadPreferences() {
  try {
    if (fs.existsSync(prefsPath)) {
      const data = fs.readFileSync(prefsPath, 'utf8');
      const prefs = JSON.parse(data);
      
      if (prefs.hotkey) {
        hotkeyConfig = prefs.hotkey;
      }
      
      if (prefs.destination) {
        pasteDestination = prefs.destination;
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
      hotkey: hotkeyConfig,
      destination: pasteDestination
    };
    
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    console.log('Saved preferences:', prefs);
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 425,
    height: 450,
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
    mainWindow.setSize(425, 450);
  });

  mainWindow.on('show', () => {
    mainWindow.setSize(425, 450);
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
          mainWindow.setSize(425, 450);
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
      mainWindow.setSize(425, 450);
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
    resizable: false,
    fullscreenable: true,
    movable: false,
    maximizable: false,
    minimizable: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  selectionWindow.loadFile('selection.html');
  selectionWindow.setFullScreen(true);
  
  // Ensure the window is not resizable by system or user
  selectionWindow.setResizable(false);
  
  // Prevent the window from being moved
  selectionWindow.setMovable(false);
  
  // Ensure window stays on top
  selectionWindow.setAlwaysOnTop(true, 'screen-saver');
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

    // Handle different paste destinations
    if (pasteDestination === 'cursor') {
      handleCursorPaste();
    } else {
      // Default to ChatGPT paste
      handleChatGPTPaste();
    }
    
    mainWindow.webContents.send('screenshot-taken');
    console.log(`Screenshot captured and ${pasteDestination === 'cursor' ? 'Cursor' : 'ChatGPT'} process started. Waiting for page to load...`);
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    mainWindow.webContents.send('screenshot-error', error.message);
  }
}

function handleChatGPTPaste() {
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
    maxAttempts = 60
    
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
        WScript.Sleep 500
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
        mainWindow.webContents.send('paste-success', 'ChatGPT');
      } else if (stdout.includes("timed out")) {
        console.log('Could not find ChatGPT window. Screenshot is still in clipboard.');
        mainWindow.webContents.send('paste-timeout', 'ChatGPT');
      }
    }
  });
}

function isCursorRunning(callback) {
  console.log('Checking if Cursor is running...');
  
  // Use multiple approaches to check if Cursor is running
  const tasklist = 'tasklist /FI "IMAGENAME eq cursor.exe" /NH';
  const wmic = 'wmic process where name="cursor.exe" get processid';
  
  // First try tasklist
  exec(tasklist, (error, stdout, stderr) => {
    if (error) {
      console.error('Error checking if Cursor is running with tasklist:', error);
      
      // Fallback to wmic if tasklist fails
      exec(wmic, (wmicError, wmicStdout) => {
        if (wmicError) {
          console.error('Error checking if Cursor is running with wmic:', wmicError);
          callback(false);
          return;
        }
        
        const isRunningWmic = wmicStdout.trim().length > "ProcessId".length;
        console.log('WMIC Cursor detection result:', isRunningWmic);
        callback(isRunningWmic);
      });
      
      return;
    }
    
    const isRunningTasklist = stdout.toLowerCase().includes('cursor.exe');
    console.log('Tasklist Cursor detection result:', isRunningTasklist);
    
    if (isRunningTasklist) {
      callback(true);
    } else {
      // Double check with wmic if tasklist says it's not running
      exec(wmic, (wmicError, wmicStdout) => {
        if (wmicError) {
          console.error('Error checking if Cursor is running with wmic:', wmicError);
          callback(false);
          return;
        }
        
        const isRunningWmic = wmicStdout.trim().length > "ProcessId".length;
        console.log('WMIC Cursor detection result:', isRunningWmic);
        callback(isRunningWmic);
      });
    }
  });
}

function handleCursorPaste() {
  console.log('Checking if Cursor is running...');
  
  // Set a timeout to ensure we don't get stuck
  const pasteTimeout = setTimeout(() => {
    console.log('Paste operation timed out');
    mainWindow.webContents.send('paste-timeout', 'Cursor');
  }, 30000); // 30 seconds timeout - longer to allow for user click
  
  isCursorRunning((isRunning) => {
    if (!isRunning) {
      console.log('Cursor is not running');
      clearTimeout(pasteTimeout);
      mainWindow.webContents.send('cursor-not-running');
      return;
    }
    
    console.log('Cursor is running, attempting to focus and paste...');
    
    // Create PowerShell script to forcefully bring Cursor window to foreground
    const powershellScript = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
  }
"@

$processList = @(Get-Process cursor -ErrorAction SilentlyContinue)
if ($processList.Count -eq 0) {
    Write-Host "CURSOR_NOT_FOUND"
    exit
}

$cursorProcess = $null

# Find the main Cursor process with a window
foreach ($process in $processList) {
    if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
        $cursorProcess = $process
        break
    }
}

if ($cursorProcess -eq $null) {
    # Try to find a Cursor process with a visible window title
    foreach ($process in $processList) {
        if ($process.MainWindowTitle -ne "") {
            $cursorProcess = $process
            break
        }
    }
}

if ($cursorProcess -eq $null) {
    # Just use the first process if we couldn't find a better one
    $cursorProcess = $processList[0]
}

$hwnd = $cursorProcess.MainWindowHandle

if ($hwnd -ne [IntPtr]::Zero) {
    # Constants for ShowWindow
    $SW_RESTORE = 9
    $SW_SHOW = 5
    $SW_SHOWMAXIMIZED = 3
    
    Write-Host "Found Cursor window handle: $hwnd"
    
    # Attach input if possible for more reliable foreground switching
    try {
        $currentThreadId = [Win32]::GetCurrentThreadId()
        $targetThreadId = 0
        [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$targetThreadId)
        if ($targetThreadId -ne 0) {
            [void][Win32]::AttachThreadInput($currentThreadId, $targetThreadId, $true)
        }
    } catch {
        Write-Host "Could not attach thread input: $_"
    }
    
    # If window is minimized, restore it
    if ([Win32]::IsIconic($hwnd)) {
        Write-Host "Window is minimized, restoring"
        [Win32]::ShowWindow($hwnd, $SW_RESTORE)
        Start-Sleep -Milliseconds 100
    }
    
    # Try multiple approaches to bring window to foreground
    Write-Host "Setting foreground window"
    [void][Win32]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 50
    
    Write-Host "Bringing window to top"
    [void][Win32]::BringWindowToTop($hwnd)
    Start-Sleep -Milliseconds 50
    
    Write-Host "Switching to window"
    [Win32]::SwitchToThisWindow($hwnd, $true)
    Start-Sleep -Milliseconds 50
    
    # Try again
    [void][Win32]::SetForegroundWindow($hwnd)
    
    # Detach input if we were attached
    try {
        if ($targetThreadId -ne 0) {
            [void][Win32]::AttachThreadInput($currentThreadId, $targetThreadId, $false)
        }
    } catch {}
    
    Write-Host "CURSOR_WINDOW_FOCUSED"
} else {
    Write-Host "CURSOR_WINDOW_NOT_FOUND"
}
    `;
    
    const psScriptPath = path.join(os.tmpdir(), 'focus-cursor.ps1');
    fs.writeFileSync(psScriptPath, powershellScript);
    
    // Execute PowerShell script to focus Cursor
    exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (psError, psStdout, psStderr) => {
      if (psError) {
        console.error('Error executing PowerShell script:', psError);
        clearTimeout(pasteTimeout);
        mainWindow.webContents.send('paste-error', 'Failed to focus Cursor window');
        return;
      } 
      
      console.log('PowerShell output:', psStdout.trim());
      
      if (psStdout.includes("CURSOR_NOT_FOUND")) {
        clearTimeout(pasteTimeout);
        mainWindow.webContents.send('cursor-not-running');
        return;
      }
      
      if (psStdout.includes("CURSOR_WINDOW_FOCUSED")) {
        // Window is now focused, notify user to click in the chat box
        console.log('Cursor window focused, waiting for user to click in chat box...');
        mainWindow.webContents.send('cursor-focused');

        // Now create a script to wait for mouse click and then paste
        const clickListenerScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class MouseClickDetector {
    [DllImport("user32.dll")]
    public static extern bool GetAsyncKeyState(int vKey);
    
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
    
    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }
    
    private const int VK_LBUTTON = 0x01;
    private const int VK_CONTROL = 0x11; 
    private const int VK_V = 0x56;
    private const int KEYEVENTF_KEYUP = 0x02;
    
    public static void WaitForClickAndPaste() {
        Console.WriteLine("Waiting for mouse click...");
        
        bool wasPressed = GetAsyncKeyState(VK_LBUTTON);
        
        // Wait for mouse button release first if it's already pressed
        while (GetAsyncKeyState(VK_LBUTTON)) {
            Thread.Sleep(50);
        }
        
        // Now wait for a new click
        while (true) {
            bool isPressed = GetAsyncKeyState(VK_LBUTTON);
            
            if (isPressed && !wasPressed) {
                // Mouse button was just pressed
                Console.WriteLine("Mouse click detected!");
                
                // Give time for click to register
                Thread.Sleep(100);
                
                // Check if cursor is in a Cursor.exe window
                uint processId = 0;
                IntPtr foregroundWindow = GetForegroundWindow();
                GetWindowThreadProcessId(foregroundWindow, out processId);
                
                bool isCursorWindow = false;
                try {
                    foreach (var proc in System.Diagnostics.Process.GetProcessesByName("cursor")) {
                        if (proc.Id == processId) {
                            isCursorWindow = true;
                            break;
                        }
                    }
                } catch {}
                
                if (isCursorWindow) {
                    Console.WriteLine("Click was in Cursor window, pasting now...");
                    
                    // Wait a bit to ensure the chat box is focused
                    Thread.Sleep(200);
                    
                    // Simulate Ctrl+V
                    keybd_event(VK_CONTROL, 0, 0, 0);
                    keybd_event(VK_V, 0, 0, 0);
                    Thread.Sleep(50);
                    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
                    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
                    
                    Console.WriteLine("PASTE_COMPLETE");
                    return;
                } else {
                    Console.WriteLine("Click was not in Cursor window, continuing to wait...");
                }
            }
            
            wasPressed = isPressed;
            Thread.Sleep(50);
        }
    }
    
    public static void Main() {
        WaitForClickAndPaste();
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms
[MouseClickDetector]::WaitForClickAndPaste()
        `;

        const clickListenerPath = path.join(os.tmpdir(), 'wait-for-click.ps1');
        fs.writeFileSync(clickListenerPath, clickListenerScript);
        
        // Execute the click listener in a separate process
        const clickProcess = exec(`powershell -ExecutionPolicy Bypass -File "${clickListenerPath}"`, (clickError, clickStdout, clickStderr) => {
          clearTimeout(pasteTimeout);
          
          if (clickError) {
            console.error('Error with click detection script:', clickError);
            mainWindow.webContents.send('paste-error', 'Failed to paste into Cursor chat');
            return;
          }
          
          console.log('Click detector output:', clickStdout.trim());
          
          if (clickStdout.includes("PASTE_COMPLETE")) {
            console.log('Screenshot pasted successfully after user click');
            mainWindow.webContents.send('paste-success', 'Cursor');
          } else {
            console.log('Click detection ended without paste confirmation');
            mainWindow.webContents.send('paste-error', 'Failed to paste after click');
          }
        });
        
      } else {
        console.log('Failed to focus Cursor window, falling back to VBS approach');
        
        // Create a simplified VBS script that just waits for the next click
        const vbsPath = path.join(os.tmpdir(), 'paste-on-click.vbs');
        const vbsScript = `
          Set WshShell = WScript.CreateObject("WScript.Shell")
          Set objFSO = CreateObject("Scripting.FileSystemObject")
          
          ' Log file for debugging
          logFile = objFSO.GetSpecialFolder(2) & "\\cursor-paste-log.txt"
          Set logStream = objFSO.CreateTextFile(logFile, True)
          
          Sub Log(message)
            logStream.WriteLine(Now & ": " & message)
          End Sub
          
          Log "VBS Script started"
          WScript.Echo "Cursor window should be focused. Click in the chat box when ready."
          
          ' Create a simple mouse click detection loop using PowerShell
          strCommand = "powershell -WindowStyle Hidden -Command ""Add-Type -AssemblyName System.Windows.Forms; $oldState = [System.Windows.Forms.Control]::MouseButtons; while($true) { Start-Sleep -Milliseconds 100; $newState = [System.Windows.Forms.Control]::MouseButtons; if ($newState -ne 'None' -and $oldState -eq 'None') { Write-Host 'CLICK_DETECTED'; Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('^v'); exit; }; $oldState = $newState }"""
          
          Log "Starting mouse click detector"
          Set objExec = WshShell.Exec(strCommand)
          
          ' Wait for the PowerShell script to complete or timeout
          startTime = Timer()
          maxWaitSeconds = 30
          
          Do While objExec.Status = 0 And (Timer() - startTime) < maxWaitSeconds
            WScript.Sleep 500
            
            ' Check for output from the PowerShell script
            If Not objExec.StdOut.AtEndOfStream Then
              output = objExec.StdOut.ReadLine()
              Log "Detector output: " & output
              
              If InStr(output, "CLICK_DETECTED") > 0 Then
                Log "Click detected, paste command sent"
                WScript.Echo "Screenshot pasted successfully"
                Exit Do
              End If
            End If
          Loop
          
          ' If we timed out
          If objExec.Status = 0 Then
            On Error Resume Next
            objExec.Terminate
            Log "Timed out waiting for click"
            WScript.Echo "Timed out waiting for user click"
          End If
          
          Log "Script completed"
          logStream.Close
          Set logStream = Nothing
          Set objFSO = Nothing
          Set WshShell = Nothing
        `;
        
        fs.writeFileSync(vbsPath, vbsScript);
        
        const vbsProcess = exec(`cscript //NoLogo "${vbsPath}"`, (error, stdout, stderr) => {
          clearTimeout(pasteTimeout);
          
          if (error) {
            console.error('Error executing VBS script:', error);
            mainWindow.webContents.send('paste-error', 'Failed to paste screenshot automatically');
          } else {
            console.log('VBS output:', stdout.trim());
            if (stdout.includes("pasted successfully")) {
              mainWindow.webContents.send('paste-success', 'Cursor');
            } else if (stdout.includes("Timed out")) {
              console.log('Timed out waiting for user click. Screenshot is still in clipboard.');
              mainWindow.webContents.send('paste-timeout', 'Cursor');
            }
          }
        });
      }
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

ipcMain.on('get-destination', (event) => {
  event.reply('current-destination', pasteDestination);
});

ipcMain.on('save-destination', (event, newDestination) => {
  console.log('Saving new paste destination:', newDestination);
  
  pasteDestination = newDestination;
  
  savePreferences();
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
