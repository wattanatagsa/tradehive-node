// src/server.ts
import express from "express";
import path from "path";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "./prisma";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Helpers =====
const toE164TH = (raw: string) => {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) return `+66${d.slice(1)}`;
  if (d.startsWith("66")) return `+${d}`;
  if (d.startsWith("+")) return d;
  return `+${d}`;
};

// ===== Static (มาก่อน routes) =====
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// หน้าแรก -> login.html
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

// health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ==== API ตัวอย่าง ====
app.get("/api/users", async (_req, res, next) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone_e164: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { id: "desc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ==== Register (เวอร์ชันเดียวพอ) ====
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body as {
      name: string;
      email?: string;
      phone: string;
      password: string;
    };

    if (!name || !phone || !password) {
      return res.status(400).json({ message: "กรุณากรอกชื่อ เบอร์โทร และรหัสผ่าน" });
    }

    const phone_e164 = toE164TH(phone);

    if (email) {
      const e = await prisma.users.findFirst({ where: { email } });
      if (e) return res.status(400).json({ message: "อีเมลนี้ถูกใช้งานแล้ว" });
    }
    const p = await prisma.users.findFirst({ where: { phone_e164 } });
    if (p) return res.status(400).json({ message: "เบอร์โทรนี้ถูกใช้งานแล้ว" });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: { name, email: email ?? null, phone_e164, password_hash },
    });

    // DEV: OTP ตายตัว
    const otpCode = "123456";
    const otpHash = await bcrypt.hash(otpCode, 10);
    await prisma.phone_otps.create({
      data: {
        phone_e164,
        code_hash: otpHash,
        purpose: "signup",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        sent_via: "sms",
        status: "sent",
      },
    });

    res.json({ ok: true, message: "สมัครสำเร็จ (โหมดทดสอบ)", otp: otpCode, userId: user.id });
  } catch (err) {
    next(err);
  }
});

// ==== Login (email หรือ phone) ====
// ❗ ต้องอยู่ก่อน 404 handler และก่อน app.listen เสมอ
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body as { identifier: string; password: string };
    if (!identifier || !password) {
      return res.status(400).json({ message: "กรุณากรอกอีเมล/เบอร์โทร และรหัสผ่าน" });
    }

    const isEmail = identifier.includes("@");
    const phone_e164 = isEmail ? null : toE164TH(identifier);

    const user = await prisma.users.findFirst({
      where: isEmail ? { email: identifier } : { phone_e164 },
    });
    if (!user) return res.status(401).json({ message: "ไม่พบบัญชีผู้ใช้" });
    if (!user.is_active) return res.status(403).json({ message: "บัญชีนี้ถูกระงับการใช้งาน" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: "อีเมล/รหัสผ่านไม่ถูกต้อง" });

    // DEV token
    const token = crypto.randomBytes(16).toString("hex");
    await prisma.user_sessions.create({
      data: {
        user_id: user.id,
        session_id: token,
        user_agent: req.get("user-agent") || null,
        ip_addr: null,
      },
    });

    res.json({
      ok: true,
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone_e164 },
    });
  } catch (err) {
    next(err);
  }
});

// ===== 404 handler ต้องอยู่ท้ายสุดของ routes =====
app.use((_req, res) => res.status(404).send("Not Found"));

// ===== Error handler =====
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Server error", detail: err?.message ?? String(err) });
});

// ===== Start (ท้ายสุด) =====
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
