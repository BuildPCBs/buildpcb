# BuildPCB.ai

<p align="center">
  <strong>An AI-powered, browser-based IDE for designing, understanding, and building electronic circuits and PCBs.</strong>
</p>
<p align="center">
  <em>"Canva meets EasyEDA, powered by AI"</em>
</p>

---

## About The Project

BuildPCB.ai is a modern, intuitive platform designed to simplify electronics design. It bridges the gap between complex, professional-grade tools and the needs of learners and creators. Our goal is to make circuit design accessible, fast, and intelligent.

This IDE is built for:
* **Beginners** learning the fundamentals of electronics.
* **Makers & Hobbyists** working on DIY projects.
* **Engineers** who need to prototype and iterate quickly.

## ✨ Key Features

* **AI-Powered Design Assistant:** Get intelligent suggestions for components, connections, and layout optimizations.
* **Intuitive Drag-and-Drop Interface:** A user-friendly, browser-based editor that feels familiar and easy to use.
* **Schematic Capture:** Design and visualize your circuits logically before moving to the physical layout.
* **PCB Layout:** Seamlessly transition from schematic to a printed circuit board design.
* **Component Library:** Access a vast library of electronic components with datasheets and footprints.
* **Real-time Validation:** Instant feedback on your design to catch errors early.

## 🛠️ Tech Stack

This project leverages a modern, cross-platform technology stack for a robust and scalable application.

* **Frontend (IDE):** Next.js, React, Tailwind CSS
* **Core/Cross-Platform Logic:** Kotlin Multiplatform (KMP) with Jetpack Compose
* **Backend:** Node.js
* **Database:** PostgreSQL with Exposed ORM
* **API:** REST / GraphQL with JWT Authentication
* **CI/CD:** GitHub Actions
* **Hosting:** Vercel (Frontend), AWS/Google Cloud (Backend & DB)

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js (v18 or newer)
* pnpm (recommended package manager)
    ```sh
    npm install -g pnpm
    ```

### Installation

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/Mbdulrohim/buildpcb.git](https://github.com/Mbdulrohim/buildpcb.git)
    cd buildpcb.ai
    ```
2.  **Install dependencies:**
    ```sh
    npm install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory and add any necessary environment variables.
    ```env
    # .env.local
    NEXT_PUBLIC_API_URL=http://localhost:8080/api
    ```
4.  **Run the development server:**
    ```sh
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

The frontend application follows the standard Next.js `app` router structure.
```buildpcb.ai/
├── src/
│   ├── app/                # Application routes and pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/         # Reusable React components
│   ├── lib/                # Utility functions and helpers
│   └── ...
├── public/                 # Static assets (images, fonts)
├── .eslintrc.json
├── next.config.mjs
├── package.json
└── tsconfig.json
```
