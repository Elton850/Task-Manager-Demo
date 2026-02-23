import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { isSecureRequest } from "../utils";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function csrfToken(req: Request, res: Response): void {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // Must be readable by JS
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && isSecureRequest(req), // Secure só sobre HTTPS (evita cookie não gravado em http://IP)
    maxAge: 12 * 60 * 60 * 1000, // 12h
  });
  res.json({ csrfToken: token });
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const cookieToken = (req.cookies?.[CSRF_COOKIE] as string) || "";
  const headerToken = (typeof req.headers[CSRF_HEADER] === "string" ? req.headers[CSRF_HEADER] : "") || "";

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: "Token CSRF inválido.", code: "CSRF_INVALID" });
    return;
  }
  const bufA = Buffer.from(cookieToken, "utf8");
  const bufB = Buffer.from(headerToken, "utf8");
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    res.status(403).json({ error: "Token CSRF inválido.", code: "CSRF_INVALID" });
    return;
  }

  next();
}
