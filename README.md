# AI Knowledge Tree Platform

A smart knowledge Q&A learning platform based on Vue3 + ElementPlus + Vite + ECharts and Node.js.

## Features

- **AI Q&A**: Ask questions and get AI-generated answers.
- **Tree Structure**: Visualize the conversation as a knowledge tree.
- **Recursive Q&A**: Ask follow-up questions on specific nodes.
- **Context Awareness**: Select text in an answer to ask a context-specific follow-up question.
- **Session Management**: Independent user sessions.
- **Theme Switching**: Support for light and dark themes.
- **Export Functionality**: Export knowledge tree to XMind and Markdown formats.

## Architecture

The project follows a modern architecture with clear separation of concerns:

### Backend
- **LLM Service**: Simplified service for AI model integration
- **RESTful API**: Express.js based API endpoints
- **Database**: MongoDB for data persistence

### Frontend
- **Composables**: Reusable logic modules (useTheme, useChat, useExport, useContext, useMountMode)
- **Store**: Pinia-based state management
- **Components**: Vue 3 components with clear responsibilities
- **Utils**: Utility functions for tree building and test data generation

For detailed architecture documentation, see [重构完成报告](docs/重构完成报告.md).

## Tech Stack

- **Frontend**: Vue 3, Element Plus, ECharts, Pinia, Axios, Vite.
- **Backend**: Node.js, Express, Mongoose (MongoDB), TypeScript.
- **Deployment**: Docker, Docker Compose.

## Prerequisites

- Node.js (v18+)
- MongoDB (Local or Atlas)
- Docker (Optional)

## Quick Start (Local Development)

### 1. Backend Setup

```bash
cd server
npm install
# Configure .env (optional, defaults provided)
npm run dev
```

Server runs on `http://localhost:3000`.

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Docker Deployment

To run the entire stack with Docker:

```bash
docker-compose up --build
```

Access the application at `http://localhost:8080`.

## Environment Variables

### Server (.env)

- `PORT`: Server port (default 3000)
- `MONGODB_URI`: MongoDB connection string
- `OPENAI_API_KEY`: OpenAI API Key (if not provided, uses mock service)
- `OPENAI_API_URL`: Custom LLM API URL
- `OLLAMA_API_URL`: Ollama API URL (default: http://localhost:11434/api/chat)
- `LLM_MODEL`: Model name (default: llama3)

## 🤖 How to Setup Local AI (Ollama)

This project supports running local AI models via Ollama. It's free, private, and easy to set up.

### Step 1: Download & Install
1. Go to [ollama.com](https://ollama.com).
2. Click **Download** and select **Windows**.
3. Run the installer (`OllamaSetup.exe`).
4. After installation, verify it's running by opening a terminal (PowerShell or CMD) and typing:
   ```powershell
   ollama --version
   ```

### Step 2: Download a Model
Since you are asking questions in Chinese, we recommend `qwen2.5` (excellent Chinese support) or `llama3`.

Open your terminal (PowerShell) and run:

```powershell
# Recommended for Chinese Q&A
ollama run qwen2.5

# Or the standard Llama 3
# ollama run llama3
```

Wait for the download to finish (several GBs). Once you see a prompt like `>>>`, you can chat with it. Type `/bye` to exit the chat, but keep the Ollama background service running.

### Step 3: Configure Project
1. Open `server/.env`.
2. Set `LLM_MODEL=qwen2.5` (or whatever model you downloaded).
3. Restart the backend server (`npm run dev` in `server/` folder).

Now the website will automatically use your local AI model!
