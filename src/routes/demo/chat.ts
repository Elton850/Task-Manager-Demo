/**
 * Demo: rotas de chat com respostas stub.
 * O chat real requer socket.io + banco relacional — não disponível na demo.
 * Retorna dados vazios no formato correto para evitar crash no ChatPage.
 */
import { Router, Request, Response } from "express";
import { requireAuth } from "../../demo/middleware";

const router = Router();

// GET /api/chat/unread-count
router.get("/unread-count", requireAuth, (_req: Request, res: Response): void => {
  res.json({ unread: 0 });
});

// GET /api/chat/threads
router.get("/threads", requireAuth, (_req: Request, res: Response): void => {
  res.json({ threads: [] });
});

// POST /api/chat/threads/direct
router.post("/threads/direct", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({
    error: "Chat não disponível na versão demo.",
    code: "DEMO_UNAVAILABLE",
  });
});

// POST /api/chat/threads/subtask/:subtaskId
router.post("/threads/subtask/:subtaskId", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({
    error: "Chat não disponível na versão demo.",
    code: "DEMO_UNAVAILABLE",
  });
});

// GET /api/chat/threads/:threadId/messages
router.get("/threads/:threadId/messages", requireAuth, (_req: Request, res: Response): void => {
  res.json({ messages: [], readStatuses: {}, nextCursor: null, hasMore: false });
});

// POST /api/chat/threads/:threadId/messages
router.post("/threads/:threadId/messages", requireAuth, (_req: Request, res: Response): void => {
  res.status(503).json({
    error: "Chat não disponível na versão demo.",
    code: "DEMO_UNAVAILABLE",
  });
});

// POST /api/chat/threads/:threadId/read
router.post("/threads/:threadId/read", requireAuth, (_req: Request, res: Response): void => {
  res.json({ ok: true });
});

// GET /api/chat/presence
router.get("/presence", requireAuth, (_req: Request, res: Response): void => {
  res.json({ presence: {} });
});

export default router;
