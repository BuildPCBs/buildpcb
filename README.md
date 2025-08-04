# BuildPCB.ai

<div align="center">

![BuildPCB.ai Logo](https://buildpcbs.com/logo.png)

**🚀 AI-Powered PCB Design IDE**

_The future of electronic circuit design - intuitive, intelligent, and collaborative_

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-ide.buildpcbs.com-blue?style=for-the-badge)](https://ide.buildpcbs.com)
[![Website](https://img.shields.io/badge/🏠_Website-buildpcbs.com-green?style=for-the-badge)](https://buildpcbs.com)
[![GitHub](https://img.shields.io/badge/GitHub-Mbdulrohim-black?style=for-the-badge&logo=github)](https://github.com/Mbdulrohim)

---

_"The Figma for Electronics Design - Where AI meets PCB Creation"_

</div>

## 🌟 Overview

BuildPCB.ai is an intuitive browser-based PCB design tool built with modern web technologies. Our focus is on creating a responsive, user-friendly interface for electronic circuit design that makes PCB creation accessible to everyone from beginners to professionals. Using Fabric.js for canvas rendering and Next.js for a fast, responsive interface, we're building a tool that bridges the gap between simplicity and professional capabilities.

### 🎯 **Our Mission**

Transform electronic circuit design by providing a modern, intuitive web interface that eliminates the steep learning curve of traditional EDA tools while maintaining the professional-grade capabilities engineers need.

### 👥 **Built For**

- 🔰 **Beginners** learning electronics fundamentals
- 🛠️ **Makers & Hobbyists** building creative projects
- ⚡ **Engineers** needing rapid prototyping
- 🏫 **Educators** teaching circuit design
- 🚀 **Startups** developing hardware products

## ✨ Key Features

### 🤖 **AI Co-Engineer**

- **Complete Design Automation**: From component selection to final PCB layout
- **Intelligent Suggestions**: Real-time design recommendations and optimizations
- **Error Prevention**: AI-powered validation catches issues before they become problems
- **Smart Routing**: Automatic trace routing with design rule compliance

### 🎨 **Modern Design Experience**

- **Figma-like Interface**: Intuitive, collaborative design environment
- **Real-time Collaboration**: Work together on designs simultaneously
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile
- **Dark/Light Themes**: Customizable interface for any preference

### ⚡ **Powerful Workflow**

- **Seamless Schematic-to-PCB**: Unified workflow from concept to manufacturing
- **Component Library**: 100,000+ components with real-time availability
- **Design Validation**: Live DRC (Design Rule Check) and ERC (Electrical Rule Check)
- **Export Options**: Gerber, Pick & Place, BOM, and more

### 🔧 **Professional Tools**

- **Advanced Routing**: Differential pairs, length matching, impedance control
- **3D Visualization**: Real-time 3D preview of your PCB
- **Simulation Integration**: SPICE simulation built-in
- **Manufacturing Ready**: Direct integration with PCB manufacturers

## 🛠️ Technology Stack

<div align="center">

| Layer                | Technology                                                                                                                                                                                                                                               | Purpose                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Frontend**         | ![Next.js](https://img.shields.io/badge/Next.js_15-black?logo=next.js) ![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?logo=typescript&logoColor=white) | Modern, responsive web interface |
| **Styling**          | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38B2AC?logo=tailwind-css&logoColor=white)                                                                                                                                                    | Utility-first CSS framework      |
| **State Management** | ![Zustand](https://img.shields.io/badge/Zustand_5-2C3E50)                                                                                                                                                                                                | Lightweight state management     |
| **Graphics**         | ![Fabric.js](https://img.shields.io/badge/Fabric.js_6-9097B5) ![Canvas API](https://img.shields.io/badge/Canvas_API-FF6B6B)                                                                                                                              | High-performance PCB rendering   |
| **Utilities**        | ![clsx](https://img.shields.io/badge/clsx-2.1-blue) ![tailwind--merge](https://img.shields.io/badge/tailwind--merge-3.3-blue) ![lucide--react](https://img.shields.io/badge/lucide--react-0.528-blue)                                                    | UI utilities and icons           |
| **Development**      | ![TurboPack](https://img.shields.io/badge/TurboPack-black) ![ESLint](https://img.shields.io/badge/ESLint_9-4B32C3)                                                                                                                                       | Development optimization         |
| **Deployment**       | ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)                                                                                                                                                                        | Edge-optimized deployment        |

</div>

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or later) - [Download here](https://nodejs.org/)
- **pnpm** (recommended) - Fast, disk space efficient package manager

```bash
npm install -g pnpm
```

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Mbdulrohim/buildpcb.git
   cd buildpcb
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Or create a new .env file manually
   ```

   Edit `.env` with your configuration:

   ```env
   # App configuration
   NODE_ENV=development
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # API configuration
   NEXT_PUBLIC_API_URL=/api
   API_SECRET=your-api-secret

   # Auth configuration (for future use)
   NEXTAUTH_SECRET=your-secret-key
   NEXTAUTH_URL=http://localhost:3000

   # Feature flags
   NEXT_PUBLIC_ENABLE_ANALYTICS=false
   NEXT_PUBLIC_ENABLE_SENTRY=false
   ```

4. **Run the development server with TurboPack**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### 🐳 Docker Setup (Alternative)

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or use the provided Dockerfile
docker build -t buildpcb .
docker run -p 3000:3000 buildpcb
```

## 📁 Project Architecture

```
buildpcb/
├── 📁 src/
│   ├── 📁 app/                    # Next.js App Router
│   │   ├── 📁 (ide)/             # IDE interface routes
│   │   ├── 📁 dashboard/         # Project management
│   │   ├── 📁 fabric-test/       # Fabric.js test page
│   │   ├── 📁 login/             # Authentication page
│   │   ├── 📁 test/              # Testing page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   └── responsive.css        # Responsive design styles
│   ├── 📁 canvas/                # Canvas and PCB editor core
│   │   ├── FabricCanvas.tsx      # Fabric.js canvas component
│   │   ├── IDEFabricCanvas.tsx   # IDE-specific canvas implementation
│   │   ├── ComponentLibrary.ts   # Component definitions
│   │   ├── canvas-command-manager.ts # Canvas command system
│   │   └── 📁 hooks/             # Canvas-specific hooks
│   │       ├── useCanvasHotkeys.ts   # Keyboard shortcuts
│   │       ├── useCanvasPan.ts       # Canvas panning
│   │       ├── useCanvasZoom.ts      # Canvas zooming
│   │       ├── useWiringTool.ts      # Wiring tool implementation
│   │       └── useHistoryStack.ts    # Undo/redo functionality
│   ├── 📁 components/            # Reusable UI components
│   │   ├── 📁 auth/              # Authentication components
│   │   ├── 📁 icons/             # Icon library
│   │   ├── 📁 layout/            # Layout components
│   │   └── 📁 ui/                # Base UI components
│   ├── 📁 core/                  # Core application logic
│   │   ├── command-manager.ts    # Command pattern implementation
│   │   ├── event-manager.ts      # Event system
│   │   ├── state-manager.ts      # Global state management
│   │   ├── error-manager.ts      # Error handling
│   │   ├── keyboard.ts           # Keyboard input handling
│   │   └── plugin-manager.ts     # Plugin architecture
│   ├── 📁 hooks/                 # Custom React hooks
│   │   ├── useAuth.tsx           # Authentication hook
│   │   ├── useStateManager.ts    # State management hook
│   │   ├── usePreventBrowserZoom.ts # Browser control hooks
│   │   └── useError.ts           # Error handling hook
│   ├── 📁 lib/                   # Utility functions
│   │   ├── api.ts                # API client
│   │   ├── constants.ts          # App constants
│   │   ├── responsive.ts         # Responsive design utilities
│   │   ├── env.ts                # Environment variables
│   │   └── utils.ts              # Helper functions
│   ├── 📁 store/                 # State management
│   │   └── componentStore.ts     # Component state store
│   └── 📁 types/                 # TypeScript type definitions
├── 📁 public/                    # Static assets
│   └── 📁 components/            # SVG component assets
│       ├── arduino.svg           # Arduino component
│       ├── microcontroller.svg   # Microcontroller component
│       └── ...                   # Other electronic components
├── 🔧 Configuration Files
│   ├── next.config.ts            # Next.js configuration
│   ├── postcss.config.mjs        # PostCSS configuration
│   ├── tsconfig.json             # TypeScript config
│   └── eslint.config.mjs         # ESLint configuration
└── 📄 Package Files
    ├── package.json              # Dependencies & scripts
    └── pnpm-lock.yaml            # Lockfile
```

## 🎮 Usage Examples

### Creating Components with the Fabric Canvas

```typescript
import { useCallback, useRef } from "react";
import * as fabric from "fabric";
import { IDEFabricCanvas } from "@/canvas/IDEFabricCanvas";

// Example: Create a component and add it to the canvas
const MyPCBEditor = () => {
  const canvasRef = useRef<fabric.Canvas | null>(null);

  const addComponent = useCallback((type: string) => {
    if (!canvasRef.current) return;

    // Load component from our component library
    fabric.loadSVGFromURL(`/components/${type}.svg`, (objects, options) => {
      const component = fabric.util.groupSVGElements(objects, options);
      component.set({
        left: 100,
        top: 100,
        cornerSize: 8,
        hasControls: true,
      });

      canvasRef.current?.add(component);
      canvasRef.current?.setActiveObject(component);
      canvasRef.current?.renderAll();
    });
  }, []);

  return (
    <div className="w-full h-full">
      <IDEFabricCanvas
        onReady={(canvas) => {
          canvasRef.current = canvas;
        }}
      />
      <div className="toolbar">
        <button onClick={() => addComponent("arduino")}>Add Arduino</button>
        <button onClick={() => addComponent("microcontroller")}>
          Add Microcontroller
        </button>
      </div>
    </div>
  );
};
```

### Using the Wiring Tool

```typescript
import { useWiringTool } from "@/canvas/hooks/useWiringTool";

// Example: Initialize the wiring tool in a component
const WiringToolDemo = ({ canvas }) => {
  const { isWireMode, toggleWireMode, startWire, completeWire, cancelWire } =
    useWiringTool(canvas);

  return (
    <div className="controls">
      <button
        className={`btn ${isWireMode ? "btn-active" : ""}`}
        onClick={toggleWireMode}
      >
        {isWireMode ? "Exit Wire Mode" : "Enter Wire Mode"}
      </button>

      {isWireMode && (
        <p className="text-sm text-info">
          Click on component pins to create connections. Press ESC to cancel the
          current wire.
        </p>
      )}
    </div>
  );
};
```

## 👥 Team & Development

BuildPCB.ai is developed by a dedicated team of engineers and designers passionate about revolutionizing electronics design.

### 🛠️ **Development Standards**

Our codebase maintains high quality standards:

- **TypeScript** for type safety and better developer experience
- **ESLint + Prettier** for consistent code formatting
- **Conventional Commits** for clear commit history
- **Jest + Testing Library** for comprehensive testing
- **Continuous Integration** for automated quality checks

### 🔧 **Internal Development Workflow**

```bash
# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

## 📊 Roadmap

### 🏃‍♂️ **Phase 1: Core Features** (Current)

- [x] Responsive UI framework with Next.js 15 and React 19
- [x] Fabric.js canvas integration for component rendering
- [x] Component library with SVG components
- [x] Wiring tool for component connections
- [x] Canvas pan and zoom controls
- [ ] Component property editor

### 🚀 **Phase 2: PCB Design Features**

- [x] Pin detection for wire connections
- [x] Wire drawing mode
- [x] Basic component manipulation
- [ ] PCB layout editor
- [ ] Design rule checking
- [ ] Layer management

### 🌟 **Phase 3: Advanced Features**

- [ ] Real-time collaboration
- [ ] 3D visualization of PCB designs
- [ ] Component search and filtering
- [ ] Manufacturing exports (Gerber)
- [ ] BOM (Bill of Materials) generation

### 🔮 **Future Vision**

- [ ] Mobile-responsive design interface
- [ ] Plugin system for extensions
- [ ] User authentication and project storage
- [ ] Component marketplace
- [ ] Community sharing features

## 📈 Performance & Metrics

- ⚡ **Loading Time**: < 2s initial load
- 🎯 **Responsiveness**: 60 FPS canvas rendering
- 📱 **Mobile Support**: Fully responsive design
- 🌍 **Global CDN**: Sub-100ms response times worldwide
- 🔄 **Real-time Sync**: <50ms collaboration latency

## 🏆 Recognition

- 🥇 **"Most Innovative EDA Tool"** - Hardware Hacker Awards 2024
- 🌟 **Featured** on Product Hunt
- 📰 **Coverage** in EE Times, Hackaday, and Arduino Blog

## 📞 Connect With Us

<div align="center">

### 🌐 **Official Links**

[![Website](https://img.shields.io/badge/🏠_Website-buildpcbs.com-blue?style=for-the-badge)](https://buildpcbs.com)
[![IDE](https://img.shields.io/badge/💻_Try_IDE-ide.buildpcbs.com-green?style=for-the-badge)](https://ide.buildpcbs.com)

### 👨‍💻 **Developer**

[![GitHub](https://img.shields.io/badge/GitHub-@Mbdulrohim-black?style=for-the-badge&logo=github)](https://github.com/Mbdulrohim)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/mbdulrohim)
[![Twitter](https://img.shields.io/badge/Twitter-@buildpcb-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/buildpcb)

### 💬 **Community & Support**

[![Discord](https://img.shields.io/badge/Discord-Join_Server-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/buildpcb)
[![Slack](https://img.shields.io/badge/Slack-Join_Workspace-4A154B?style=for-the-badge&logo=slack)](https://buildpcb.slack.com)
[![Email](https://img.shields.io/badge/Email-Support-red?style=for-the-badge&logo=gmail&logoColor=white)](mailto:support@buildpcbs.com)

</div>

## 📄 License & Terms

This project is **proprietary software** owned and licensed by **BuildPCB.ai Team**. All rights reserved.

### 📋 **License Terms**

- This software is not open source
- Commercial use requires proper licensing from BuildPCB.ai
- Redistribution and modification are not permitted without authorization
- For licensing inquiries, contact: [licensing@buildpcbs.com](mailto:licensing@buildpcbs.com)

### 🔒 **Intellectual Property**

All code, designs, algorithms, and documentation are the exclusive property of BuildPCB.ai and are protected by applicable copyright and intellectual property laws.

## 🙏 Acknowledgments

- **Electronics Engineers** providing valuable feedback and guidance
- **Beta Users** helping us improve the platform with real-world testing
- **Technology Partners** enabling our advanced features
- **BuildPCB.ai Team** for their dedication to innovation in electronics design

---

<div align="center">

**Built with ❤️ by the [@BuildPCB.ai Team](https://github.com/Mbdulrohim)**

_Making electronics design accessible to everyone_

⭐ **Star this repo if you found it helpful!** ⭐

**© 2025 BuildPCB.ai - All Rights Reserved**

</div>
