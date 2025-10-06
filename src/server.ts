import express from "express";
import path from "path";
import prisma from "./prisma";

const app = express();
app.use(express.json());

// เสิร์ฟไฟล์ HTML/CSS/JS จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, "../public")));

// ตัวอย่าง API
app.get("/api/users", async (req, res) => {
  const users = await prisma.users.findMany();
  res.json(users);
});

// เริ่มเซิร์ฟเวอร์
const PORT = 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
