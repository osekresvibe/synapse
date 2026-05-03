
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ContentRequest {
  topic: string;
  keywords?: string[];
  targetAudience?: string;
  tone?: "professional" | "casual" | "educational" | "persuasive";
  length?: "short" | "medium" | "long";
}

interface BlogPost {
  title: string;
  metaDescription: string;
  content: string;
  keywords: string[];
  headings: string[];
  readingTime: number;
  seoScore: number;
}

interface AEOOptimization {
  directAnswer: string;
  keyPoints: string[];
  structuredData: any;
  faqSuggestions: Array<{ question: string; answer: string }>;
  llmSearchOptimized: string;
}

export class ContentStudio {
  /**
   * Generate AEO-optimized content for answer engines (ChatGPT, Perplexity, etc.)
   */
  async generateAEOContent(request: ContentRequest): Promise<AEOOptimization> {
    console.log(`[ContentStudio] Generating AEO content for: ${request.topic}`);

    const prompt = `You are an expert content strategist specializing in Answer Engine Optimization (AEO).

Topic: ${request.topic}
Keywords: ${request.keywords?.join(", ") || "auto-detect"}
Target Audience: ${request.targetAudience || "general"}

Generate AEO-optimized content that will rank well in AI-powered answer engines like ChatGPT, Perplexity, and Google SGE.

Return a JSON object with:
1. directAnswer: A concise, direct answer (2-3 sentences) that answer engines can use
2. keyPoints: Array of 5-7 key bullet points
3. structuredData: Schema.org formatted data
4. faqSuggestions: Array of 5 FAQ pairs that are commonly asked
5. llmSearchOptimized: A paragraph optimized for LLM retrieval (includes semantic keywords)

Make it conversational, factual, and directly answering the query.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`[ContentStudio] AEO content generated with ${result.keyPoints?.length} key points`);
    
    return result;
  }

  /**
   * Generate SEO + AEO optimized blog post
   */
  async generateBlogPost(request: ContentRequest): Promise<BlogPost> {
    console.log(`[ContentStudio] Generating blog post: ${request.topic}`);

    const lengthGuide = {
      short: "800-1200 words",
      medium: "1500-2000 words",
      long: "2500-3500 words"
    };

    const prompt = `You are a professional content writer specializing in SEO and AEO optimization.

Topic: ${request.topic}
Keywords: ${request.keywords?.join(", ") || "auto-detect"}
Target Audience: ${request.targetAudience || "general"}
Tone: ${request.tone || "professional"}
Length: ${lengthGuide[request.length || "medium"]}

Write a comprehensive blog post optimized for both:
1. Traditional SEO (search engines)
2. AEO (answer engines like ChatGPT, Perplexity)

Structure:
- Compelling title (60 characters max, includes primary keyword)
- Meta description (150-160 characters, actionable)
- Introduction (hook + problem statement)
- 5-7 H2 sections with clear headings
- Bullet points and lists for scannability
- Conclusion with call-to-action
- FAQ section (3-5 questions)

Writing style:
- Clear, conversational tone
- Short paragraphs (3-4 sentences)
- Active voice
- Include statistics/data when relevant
- Use semantic keywords naturally

Return JSON with:
- title
- metaDescription
- content (full markdown)
- keywords (array)
- headings (array of H2/H3)
- readingTime (minutes)
- seoScore (0-100)`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`[ContentStudio] Blog post generated: ${result.title} (${result.readingTime}min read)`);
    
    return result;
  }

  /**
   * Optimize existing content for LLM search
   */
  async optimizeForLLMSearch(originalContent: string, topic: string): Promise<{
    optimizedContent: string;
    improvements: string[];
    semanticKeywords: string[];
  }> {
    console.log(`[ContentStudio] Optimizing content for LLM search: ${topic}`);

    const prompt = `You are an LLM search optimization expert.

Original Content:
${originalContent}

Topic: ${topic}

Optimize this content for retrieval by Large Language Models (ChatGPT, Claude, Gemini, etc.).

LLM Search Optimization Principles:
1. Use natural language patterns that LLMs recognize
2. Include semantic keywords and related concepts
3. Structure information hierarchically
4. Add context and explanations
5. Use clear, definitive statements
6. Include "what", "why", "how" explanations
7. Add examples and use cases

Return JSON with:
- optimizedContent: The rewritten, LLM-optimized version
- improvements: Array of specific improvements made
- semanticKeywords: Array of semantic keywords added`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`[ContentStudio] Content optimized with ${result.improvements?.length} improvements`);
    
    return result;
  }

  /**
   * Generate content variations for A/B testing
   */
  async generateContentVariations(baseContent: string, count: number = 3): Promise<Array<{
    variation: string;
    focusArea: string;
    targetPersona: string;
  }>> {
    console.log(`[ContentStudio] Generating ${count} content variations`);

    const prompt = `Generate ${count} variations of this content, each optimized for different personas/angles:

Base Content:
${baseContent}

Create variations that:
1. Target different audience segments
2. Emphasize different benefits
3. Use different hooks/angles
4. Vary in tone (professional, casual, technical)

Return JSON array with:
- variation: The rewritten content
- focusArea: What this variation emphasizes
- targetPersona: Who this is best for`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return result.variations || [];
  }

  /**
   * Analyze content for SEO + AEO score
   */
  async analyzeContent(content: string, targetKeywords?: string[]): Promise<{
    seoScore: number;
    aeoScore: number;
    readability: number;
    suggestions: string[];
    missingElements: string[];
  }> {
    console.log(`[ContentStudio] Analyzing content quality`);

    const prompt = `Analyze this content for SEO and AEO optimization:

Content:
${content}

Target Keywords: ${targetKeywords?.join(", ") || "auto-detect"}

Evaluate:
1. SEO Score (0-100): keyword usage, structure, meta elements
2. AEO Score (0-100): answer engine optimization, clarity, directness
3. Readability (0-100): Flesch reading ease, sentence length, clarity
4. Suggestions: 5-7 specific improvements
5. Missing Elements: What's missing for complete optimization

Return JSON with these fields.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    console.log(`[ContentStudio] Analysis complete - SEO: ${result.seoScore}, AEO: ${result.aeoScore}`);
    
    return result;
  }

  /**
   * Generate social media content from blog post
   */
  async generateSocialContent(blogPost: BlogPost): Promise<{
    twitter: string[];
    linkedin: string;
    facebook: string;
    instagram: string;
  }> {
    console.log(`[ContentStudio] Generating social media content`);

    const prompt = `Create social media posts from this blog:

Title: ${blogPost.title}
Content Summary: ${blogPost.metaDescription}
Key Points: ${blogPost.headings.join(", ")}

Generate:
1. Twitter: 3 tweet variations (280 chars each, engaging hooks)
2. LinkedIn: Professional post (1300 chars, thought leadership angle)
3. Facebook: Conversational post (500 chars, community-focused)
4. Instagram: Caption with hashtags (2200 chars, visual storytelling)

Return JSON with these fields.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return result;
  }
}

export const contentStudio = new ContentStudio();
