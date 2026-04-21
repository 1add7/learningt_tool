import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/api.js";
import { setUseMemory } from "./services/knowledgeService.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/vue-practice";

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
// 禁用 mongoose 的命令缓冲 + 缩短选型超时，连不上时立刻走内存 fallback，
// 避免请求被挂起 10~30s 后才返回 500。
mongoose.set("bufferCommands", false);

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 3000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    console.log("Switching to in-memory database fallback.");
    setUseMemory(true);
  });

// 运行中掉线也回退到内存，避免后续请求再次 500。
mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err.message);
  setUseMemory(true);
});
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected, switching to in-memory fallback.");
  setUseMemory(true);
});

// Routes
app.use("/api", apiRoutes);

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Unhandled server error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  },
);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
