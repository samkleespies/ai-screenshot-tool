# AI Screenshot Tool

A Windows desktop app built with Electron and Node.js that lets you screenshot an area of your screen, then the tool will automatically open a new ChatGPT chat or Cursor chat and paste the screenshot for you.

## What's New in v1.2.0 🚀

Just shipped a bunch of fixes that make the app way more reliable:

- Fixed the annoying selection window bug that was preventing click and drag from working
- Made the app start up faster and feel snappier overall
- Fixed issues with hotkey configuration (they actually save properly now!)
- Added better logging to help track down any weird behaviors
- Maintained the clean look while making everything work better under the hood

Check the [Release Notes](RELEASE_NOTES.md) for the full details!

## Features

- **Screenshot and Paste**: Capture any area of your screen and have it automatically pasted
- **Cursor Chat Integration**: Paste screenshots directly into Cursor chat
- **ChatGPT Integration**: Paste screenshots directly into ChatGPT
- **Custom Hotkeys**: Configure your own hotkey combinations for capturing screenshots
- **System Tray**: Runs quietly in the background with system tray access

## Planned Features

- **Target Specific Chats**: Paste screenshots into existing ChatGPT conversations
- **Multi-Model Support**: Options to select different AI models/companies (Claude, Gemini, etc.)
- **ChatGPT Model Selection**: Choose specific ChatGPT models (GPT-3.5, GPT-4, etc.)
- **Additional IDE Integrations**: Support for other AI-powered IDEs like CLINE in VSCode, Windsurf, etc.

## Installation

### Option 1: Installer Version
1. Download the latest installer (`AI-Screenshot-Tool-Setup-1.2.0.exe`) from the [Releases](https://github.com/yourusername/ai-screenshot-tool/releases) page
2. Run the installer and follow the prompts
3. Launch from the Start Menu or Desktop shortcut

### Option 2: Portable Version
1. Download the latest portable executable (`AI-Screenshot-Tool-Portable-1.2.0.exe`) from the [Releases](https://github.com/yourusername/ai-screenshot-tool/releases) page
2. Run the executable - no installation required

### Option 3: Build from Source
See build instructions below

## Usage

1. Launch the application
2. Select your paste destination (ChatGPT or Cursor Chat)
3. Press `Ctrl+Shift+S` (or your custom hotkey) to take a screenshot
4. Select the area of your screen you want to capture
5. The app will:
   - For ChatGPT: Open ChatGPT and paste your screenshot
   - For Cursor: Focus the Cursor window, wait for you to click in the chat box, then paste the screenshot

The tool will continue running in the background and can be accessed from the system tray when the application is minimized.
To stop/exit the tool, simply close the window or right click on the system tray icon and click exit.

## Build Instructions

### Prerequisites
- Node.js (v16+)
- npm
- Git

### Steps
1. Clone the repository
   ```
   git clone https://github.com/yourusername/ai-screenshot-tool.git
   cd ai-screenshot-tool
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Run in development mode
   ```
   npm start
   ```

4. Build both portable and installer versions
   ```
   npm run build
   ```

5. Build only the portable version
   ```
   npm run build:portable
   ```

6. Build only the installer version
   ```
   npm run build:installer
   ```

   The executables will be created in the `dist` folder.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Coffee

If you like this tool and want to support me, buy me a coffee! ☕

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow.svg)](https://buymeacoffee.com/samkleespies)

## License

This project is licensed under the MIT License - see the LICENSE file for details. 