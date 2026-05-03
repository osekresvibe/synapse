# Synapse Edit - AI Video Editing Platform

## Overview
Synapse Edit is an analysis-driven AI video editing platform transforming raw footage into professionally edited videos with minimal user input. It uses an "intent-driven" approach, allowing users to specify desired outputs upfront (e.g., "one 60s video," "five 10s TikToks"). Key features include an "Intuitive Clip Picker" with AI auto-refitting, batch video processing, and support for raw footage uploads and shareable links. The platform aims to make video editing accessible and efficient for creators at all levels by revolutionizing the traditional editing workflow.

## User Preferences
I prefer clear, concise explanations and direct answers. I value an iterative development approach where features are built and tested incrementally. Please ask before making significant architectural changes or adding new major dependencies. I prefer to see code that adheres to modern TypeScript and React best practices, utilizing functional components and hooks. Ensure the UI remains clean, spacious, and minimalist, following the design principles outlined in the architecture.

## System Architecture

### UI/UX Decisions
The frontend features a modern, minimalist design inspired by Linear and Notion, emphasizing generous whitespace, smooth animations, and clear visual hierarchy. It adopts a dark mode-first approach with an indigo accent. Typography includes Inter for UI and body text, Space Grotesk for headings, and JetBrains Mono for technical data. The Clip Generator UI has a redesigned layout with a centered main player and a horizontal strip of 5 clips below, showing per-clip quality scores.

### Technical Implementations
The frontend is built with React and TypeScript, utilizing Tailwind CSS, shadcn/ui for styling, TanStack Query for server state management, and Wouter for routing. The backend is an Express.js server with TypeScript, managing file uploads with Multer and performing video processing with FFmpeg. PostgreSQL with Drizzle ORM handles data persistence. AI analysis is powered by OpenAI's Vision API (GPT-4o) for visual engagement scoring, Whisper API for transcription, and GPT-4o for natural language feedback interpretation.

### Feature Specifications
- **Seamless Ingestion**: Supports direct file upload (drag & drop) and shareable links, including resumable chunk-based uploads.
- **Intent Selection**: Users choose output format (single video, multiple shorts, comprehensive edit, AI decide, clean slices).
- **One-Click Best Edit**: Hero feature competing with Opus Clip - auto-detects video type, applies optimal settings based on duration (short/medium/long), and immediately starts processing with polished 9:16 output for social platforms. Uses smart heuristics: <30s videos get single polish, 30-90s get single edit or 2-3 clips, 90-300s get multiple clips, >300s use AI decide. Always clickable even while AI analysis loads.
- **AI Processing**: Automated video analysis, intelligent clip slicing, speech integrity detection, visual engagement scoring, and context-aware clip generation.
- **Smarter Clip Selection**: AI adjusts clip selection based on video purpose (e.g., tutorial, hype, demo, vlog).
- **Style Mimicry & Export**: Analyzes reference videos using GPT-4o Vision for visual style, cut tempo, and transitions, applying extracted styles to generated videos. Supports various export formats and quality levels, with batch ZIP export.
- **Video Finalization**: Includes subtitle generation (ASS styling), custom text overlays, and optional text-based branding watermarks.
- **Storage Management**: Allows users to delete projects with complete file cleanup and provides warnings/alerts for project limits.
- **Batch Processing**: Supports uploading up to 10 videos concurrently with limited simultaneous processing.
- **Quality Scoring System**: Rates outputs on 10 dimensions (technical, uniqueness, dynamism, usability, narrative structure) with S/A/B/C/D ranking and UI dashboard.
- **Hook-First Editing**: Enforces the highest-engagement clip suitable for a hook to always be at the beginning of the video.
- **Feedback Learning System**: Records user interactions (regenerate, finalize, ratings) to learn and improve clip selection, duration preferences, and hook priorities.
- **Format-Specific Editing Strategies**: Implements specialized editing intelligence tailored to content types (e.g., gaming, educational, comedy) with custom energy curves, duration preferences, and scoring modifiers.
- **Dual Output Modes**: Offers "Raw Slices" for fast extraction without effects and "Polished Reels" for full editing with transitions, color grading, and audio mixing.
- **Smart Transitions**: Integrates audio beat detection, scene change detection, and J/L cut systems for professional-grade, content-aware transitions.
- **Brand Reference Library**: Provides a curated library of 20+ brand editing styles across 10 categories for one-click application to projects.
- **Video Compression & Conversion**: FFmpeg-powered optimization during upload with three modes:
  - **Compress**: Reduces file size (60-80%) with selectable quality (low/medium/high CRF presets)
  - **Convert to MP4**: High-quality format conversion for non-MP4 videos (CRF 18, minimal quality loss)
  - **Compress + Convert**: Maximum optimization combining both operations
  - Smart safeguards: only applies compression if >5% savings, validates target format (MP4 only), graceful fallback on errors
- **Time Credits System**: Never turn users away - offer free time credits instead of blocking. Time credits adjust account renewal by hours/days based on usage:
  - **Large File Optimization**: For files >500MB, users can opt-in to compression/conversion using time credits (~15 min per GB)
  - **Batch File Limit**: Default 10 files per batch, extendable to 20 files using time credits (~5 min per extra file)
  - **Project Storage Limit**: Default 20 projects, extendable to 40 projects using time credits (may adjust renewal by 1-2 days)
  - All limits are opt-in extensions with clear explanations - users can always proceed with defaults

### System Design Choices
Key entities include Projects, Smart Slices, Generated Videos, Reference Videos, uploadSessions, and Feedback tables. API endpoints are structured around Projects, Batch Processing, Reference Videos, refinement, feedback, and quality reports. Performance optimizations include upload progress tracking, FFmpeg metadata caching, faster encoding, stream copy optimizations, LUT-based color grading, batched Vision API processing, and parallel multi-video generation.

### File Storage Architecture
**Critical for preventing server restarts during video processing:**
- **Source Uploads** (`./uploads/videos`): User-uploaded source videos stored in project root (persistent)
- **Processing Outputs** (`/tmp/synapse-processing`): All FFmpeg intermediate files, clips, graded videos, and exports stored in /tmp (isolated from file watchers)
- **Static Serving**: 
  - `/uploads/*` → serves from `./uploads/` (source files)
  - `/processing/*` → serves from `/tmp/synapse-processing/` (processing outputs)
- This separation prevents Vite's file watcher from detecting processing outputs and triggering server restarts that would interrupt long-running TransitionEngine and color grading jobs.
- Path utilities `VideoProcessor.getPublicPath()` and `VideoProcessor.getFullPath()` handle both path types transparently.

## External Dependencies
- **FFmpeg**: For all video processing tasks (transcoding, clip extraction, effects, color grading, finalization).
- **Multer**: Handles multipart/form-data file uploads.
- **ytdl-core**: Extracts information from YouTube URLs.
- **PostgreSQL**: Primary database for persistent storage.
- **Drizzle ORM**: Type-safe interaction with PostgreSQL.
- **OpenAI API (GPT-4o Vision, Whisper, GPT-4o)**: For AI analysis (visual engagement, transcription, natural language processing).
- **DeepSeek AI**: Always-available alternative AI provider for analysis and processing tasks.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **TanStack Query**: Manages server state in the frontend.
- **Wouter**: Client-side routing library.