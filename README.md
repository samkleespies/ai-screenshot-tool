# AI Screenshot Tool

A Windows desktop app built with Electron and Node.js that lets you capture an area of your screen with a hotkey. After you take the screenshot it will automatically open a new browser window to a new ChatGPT chat and paste your screenshot in the chat for you.

## Planned Features

- **Target Specific Chats**: Paste screenshots into existing ChatGPT conversations
- **Multi-Model Support**: Options to select different AI's (Claude, Gemini, etc.)
- **ChatGPT Model Selection**: Choose specific ChatGPT models (GPT-3.5, GPT-4, etc.)
- **IDE Integration**: Functionality to paste into different AI-powered IDEs like Cursor, Windsurf, etc.
- **Native Installer**: Windows installer package instead of a portable .exe

## Installation

### Option 1: Portable Version
1. Download the latest `.exe` file from the [Releases](https://github.com/samkleespies/ai-screenshot-app/releases) page
2. Run the executable - no installation required

### Option 2: Build from Source
See build instructions below

## Usage

1. Launch the application
2. Press `Ctrl+Shift+S` (or your custom hotkey) to take a screenshot
3. Select the area of your screen you want to capture
4. The app automatically opens ChatGPT and pastes your screenshot

## Build Instructions

### Prerequisites
- Node.js (v16+)
- npm
- Git

### Steps
1. Clone the repository
   ```
   git clone https://github.com/yourusername/ai-screenshot-app.git
   cd ai-screenshot-app
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Run in development mode
   ```
   npm start
   ```

4. Build the portable executable
   ```
   npm run build
   ```
   The executable will be created in the `dist` folder.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 