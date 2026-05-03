
import { Router } from "express";
import { contentStudio } from "../services/content-studio";

const router = Router();

// Generate AEO-optimized content
router.post("/aeo-content", async (req, res) => {
  try {
    const { topic, keywords, targetAudience, tone } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const result = await contentStudio.generateAEOContent({
      topic,
      keywords,
      targetAudience,
      tone,
    });

    res.json(result);
  } catch (error) {
    console.error("[ContentStudio API] AEO generation error:", error);
    res.status(500).json({ error: "Failed to generate AEO content" });
  }
});

// Generate blog post
router.post("/blog-post", async (req, res) => {
  try {
    const { topic, keywords, targetAudience, tone, length } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const result = await contentStudio.generateBlogPost({
      topic,
      keywords,
      targetAudience,
      tone,
      length,
    });

    res.json(result);
  } catch (error) {
    console.error("[ContentStudio API] Blog generation error:", error);
    res.status(500).json({ error: "Failed to generate blog post" });
  }
});

// Optimize for LLM search
router.post("/llm-optimize", async (req, res) => {
  try {
    const { content, topic } = req.body;

    if (!content || !topic) {
      return res.status(400).json({ error: "Content and topic are required" });
    }

    const result = await contentStudio.optimizeForLLMSearch(content, topic);

    res.json(result);
  } catch (error) {
    console.error("[ContentStudio API] LLM optimization error:", error);
    res.status(500).json({ error: "Failed to optimize content" });
  }
});

// Analyze content
router.post("/analyze", async (req, res) => {
  try {
    const { content, targetKeywords } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const result = await contentStudio.analyzeContent(content, targetKeywords);

    res.json(result);
  } catch (error) {
    console.error("[ContentStudio API] Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze content" });
  }
});

// Generate social media content
router.post("/social-content", async (req, res) => {
  try {
    const { blogPost } = req.body;

    if (!blogPost) {
      return res.status(400).json({ error: "Blog post data is required" });
    }

    const result = await contentStudio.generateSocialContent(blogPost);

    res.json(result);
  } catch (error) {
    console.error("[ContentStudio API] Social content error:", error);
    res.status(500).json({ error: "Failed to generate social content" });
  }
});

// Generate content variations
router.post("/variations", async (req, res) => {
  try {
    const { content, count } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const result = await contentStudio.generateContentVariations(content, count || 3);

    res.json({ variations: result });
  } catch (error) {
    console.error("[ContentStudio API] Variations error:", error);
    res.status(500).json({ error: "Failed to generate variations" });
  }
});

export default router;
