import { Router } from "express";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ status: "compilation routes ready" });
});

export default router;
