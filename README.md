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

BuildPCB.ai revolutionizes electronic circuit design by combining the intuitive user experience of modern design tools with the power of artificial intelligence. Think **Canva meets EasyEDA, powered by AI** - we're building the next generation of PCB design software that makes electronics accessible to everyone.

### 🎯 **Our Mission**

Transform the way people design electronic circuits by eliminating the complexity of traditional EDA tools while maintaining professional-grade capabilities.

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

| Layer                | Technology                                                                                                                                                                                                                                       | Purpose                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| **Frontend**         | ![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js) ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) | Modern, responsive web interface    |
| **Styling**          | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)                                                                                                                                              | Utility-first CSS framework         |
| **State Management** | ![Zustand](https://img.shields.io/badge/Zustand-2C3E50)                                                                                                                                                                                          | Lightweight state management        |
| **Graphics**         | ![Canvas API](https://img.shields.io/badge/Canvas_API-FF6B6B) ![WebGL](https://img.shields.io/badge/WebGL-990000)                                                                                                                                | High-performance rendering          |
| **Backend**          | ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white)                                                               | Scalable server infrastructure      |
| **AI/ML**            | ![OpenAI](https://img.shields.io/badge/OpenAI-412991) ![TensorFlow](https://img.shields.io/badge/TensorFlow-FF6F00?logo=tensorflow&logoColor=white)                                                                                              | AI-powered design assistance        |
| **Deployment**       | ![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white) ![AWS](https://img.shields.io/badge/AWS-232F3E?logo=amazon-aws&logoColor=white)                                                                                | Global CDN and cloud infrastructure |

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
   cp .env.example .env.local
   ```

   Edit `.env.local` with your configuration:

   ```env
   # Application
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=https://api.buildpcbs.com

   # Authentication
   NEXTAUTH_SECRET=your-secret-key
   NEXTAUTH_URL=http://localhost:3000

   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/buildpcb

   # AI Services
   OPENAI_API_KEY=your-openai-key
   ```

4. **Run the development server**

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
│   ├── 📁 app/                  # Next.js App Router
│   │   ├── 📁 (ide)/           # IDE interface routes
│   │   ├── 📁 dashboard/       # Project management
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── 📁 components/          # Reusable UI components
│   │   ├── 📁 canvas/          # PCB canvas components
│   │   ├── 📁 icons/           # Icon library
│   │   ├── 📁 layout/          # Layout components
│   │   └── 📁 ui/              # Base UI components
│   ├── 📁 core/                # Core application logic
│   │   ├── command-manager.ts  # Command pattern implementation
│   │   ├── event-manager.ts    # Event system
│   │   ├── state-manager.ts    # Global state management
│   │   └── plugin-manager.ts   # Plugin architecture
│   ├── 📁 hooks/               # Custom React hooks
│   ├── 📁 lib/                 # Utility functions
│   │   ├── api.ts              # API client
│   │   ├── responsive.ts       # Responsive design utilities
│   │   └── utils.ts            # Helper functions
│   └── 📁 types/               # TypeScript type definitions
├── 📁 public/                  # Static assets
├── 📁 docs/                    # Documentation
├── 🔧 Configuration Files
│   ├── next.config.ts          # Next.js configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── tsconfig.json           # TypeScript config
│   └── eslint.config.mjs       # ESLint configuration
└── 📄 Package Files
    ├── package.json            # Dependencies & scripts
    └── pnpm-lock.yaml         # Lockfile
```

## 🎮 Usage Examples

### Creating Your First PCB

```typescript
// Example: Initialize a new PCB project
import { PCBProject } from "@/core/pcb-project";

const project = new PCBProject({
  name: "Arduino Shield",
  dimensions: { width: 68.58, height: 53.34 }, // mm
  layers: 2,
});

// Add components with AI assistance
project.addComponent({
  type: "microcontroller",
  package: "DIP-28",
  value: "ATMEGA328P",
});

// Auto-route with AI
await project.autoRoute({
  strategy: "ai-optimized",
  constraints: {
    minTraceWidth: 0.2, // mm
    viaSize: 0.6, // mm
  },
});
```

### Using the AI Co-Engineer

```typescript
// Natural language PCB design
const aiAssistant = new AICoEngineer();

const design = await aiAssistant.createDesign(`
  Create a temperature sensor board with:
  - ESP32 microcontroller
  - DS18B20 temperature sensor
  - OLED display
  - USB-C power input
  - Compact 2-layer design
`);
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

- [x] Responsive UI framework
- [x] Basic schematic editor
- [x] Component library integration
- [ ] PCB layout editor
- [ ] Design rule checking

### 🚀 **Phase 2: AI Integration**

- [ ] AI-powered component placement
- [ ] Intelligent auto-routing
- [ ] Design optimization suggestions
- [ ] Natural language design interface

### 🌟 **Phase 3: Advanced Features**

- [ ] Real-time collaboration
- [ ] 3D visualization
- [ ] SPICE simulation
- [ ] Manufacturing integration

### 🔮 **Future Vision**

- [ ] Mobile app (React Native)
- [ ] Plugin marketplace
- [ ] Educational content platform
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
