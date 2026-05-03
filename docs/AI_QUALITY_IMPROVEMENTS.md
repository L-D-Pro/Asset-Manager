# AI Quality Improvements — Technical Reference

**Last Updated:** May 2, 2026
**Scope:** Resume tailoring, cover letter drafting, scoring, best practices

---

## Overview

This document describes the AI quality improvements implemented in the May 2, 2026 session. The goal was to fix three user-reported issues:

1. Resume had markdown formatting (`**bold**`)
2. Resume wasn't tailored to the specific job
3. Cover letter was too short

---

## Architecture

```
User Request
    |
    v
[Best Practices Service] --- loads rules ---> [AI Prompt]
    |                                            |
    |                                            v
    |                                    [OpenRouter AI Call]
    |                                            |
    |                                            v
    |                                    [Raw AI Output]
    |                                            |
    v                                            v
[Validation Layer] <-------------------- [Parsed Output]
    |
    v
[Store Result] or [QualityViolation Error]
```

---

## 1. Best Practices Engine

### Files
- `lib/db/src/schema/best-practices.ts` — DB schema
- `artifacts/api-server/src/lib/best-practices.ts` — Service
- `artifacts/api-server/src/routes/best-practices.ts` — API routes
- `artifacts/dashboard/src/pages/admin/best-practices/index.tsx` — Admin UI

### Default Rules

| # | Rule | Source | Validated |
|---|------|--------|-----------|
| 1 | No markdown formatting | Hardcoded | ✅ Regex |
| 2 | No generic filler phrases | Hardcoded | ✅ Regex |
| 3 | Must tailor to specific job | Hardcoded | ❌ Semantic |
| 4 | Quantified impact required | Hardcoded | ✅ Regex |
| 5 | Cover letter 250-400 words | Hardcoded | ✅ Word count |
| 6 | Address specific business problem | Hardcoded | ❌ Semantic |

### API Endpoints

```
GET /best-practices          → Load current config
PUT /best-practices          → Update rules
POST /best-practices/refresh → Regenerate from AI
```

### Prompt Integration

Before each AI call, the pipeline loads best practices and appends them to the system prompt:

```typescript
const bestPractices = await loadOrCreateBestPractices("general");
const rulesText = formatBestPracticesForPrompt(bestPractices);
const fullSystemPrompt = SYSTEM_PROMPT + "\n\nQUALITY STANDARDS:\n" + rulesText;
```

---

## 2. Resume-to-Profile Pipeline

### File
- `artifacts/api-server/src/lib/pipelines/resume-to-profile.ts`

### Flow

1. Fetch latest base resume (`isCurrent = true`)
2. Build prompt with resume text
3. Call AI with `taskType: "resume_analysis"`
4. Parse JSON response:
   ```json
   {
     "name": "Target Role Name",
     "description": "Role summary",
     "hardFilters": ["required skills"],
     "softWeights": { "skill": 1.0 }
   }
   ```
5. Insert into `roleProfilesTable`

### Route
```
POST /resume-to-profile
```

---

## 3. Semantic Resume Scoring

### Files
- `artifacts/api-server/src/lib/semantic-scoring.ts` — Engine
- `artifacts/api-server/src/lib/prompts/gap-analysis.ts` — Prompt builder
- `artifacts/api-server/src/routes/resume-scoring.ts` — Route

### Scoring Dimensions

| Dimension | Match Types |
|-----------|------------|
| Skills | Exact, Synonym, Related, Missing |
| Experience | Years comparison |
| Education | Equivalent degree detection |
| Keywords | Presence check |

### Response Format

```typescript
interface ScoringResult {
  overallScore: number;        // 0-100
  skillMatches: SkillMatch[];  // Exact/synonym/related/missing
  experienceMatch: ExperienceMatch;
  educationMatch: EducationMatch;
  keywordMatches: KeywordMatch[];
  gaps: GapSummary[];          // Actionable suggestions
  rationale: string;           // Human-readable explanation
}
```

### Routes

```
POST /jobs/:id/resume-score     → New semantic scoring
GET /jobs/:id/score?useResume=true → Updated existing route
```

---

## 4. Improved Prompts

### Resume Tailor Prompt Changes

**Added to SYSTEM_PROMPT:**
```
CRITICAL FORMATTING RULES:
- NO markdown formatting of any kind (**bold**, *italic*, # headers, bullets, code blocks)
- Return plain text only

QUALITY REQUIREMENTS:
- Every bullet MUST contain quantified impact (numbers, percentages, dollar amounts)
- Do NOT use generic filler phrases ("team player", "detail-oriented", "hard worker")
- Tailor EVERY bullet to the specific job, not generic descriptions
- Use strong action verbs (Led, Built, Increased, Reduced, Designed)
- Match the job's required skills and keywords where truthfully supported by claims

COMPARISON INSTRUCTION:
Before generating, compare the resume against the job description:
1. Identify which resume experience matches the job requirements
2. Flag any gaps where the resume lacks evidence
3. Reorder bullets to put the most relevant experience first
```

### Cover Letter Prompt Changes

**Added to SYSTEM_PROMPT:**
```
CRITICAL FORMATTING RULES:
- NO markdown formatting of any kind
- Return plain text only

QUALITY REQUIREMENTS:
- Write 250-400 words (no shorter, no longer)
- Address the specific business problem in the job description
- Tailor to THIS specific job at THIS company
- Show personality and genuine interest
- Do NOT use generic filler phrases

RESUME CONTEXT:
- The user has provided their resume text below
- Use it to understand their background but DO NOT simply repeat resume facts
- Highlight 2-3 key achievements that are MOST relevant to this job
- Explain WHY their specific experience solves THIS company's problem
```

---

## 5. Validation Layer

### File
- `artifacts/api-server/src/lib/pipelines/validation.ts`

### QualityViolation Error

Thrown when post-generation checks fail. Contains:
- `violations`: Array of specific failures
- `rawContent`: The full AI output for debugging

### Checks

#### `checkNoMarkdown(text)`
Detects 8 patterns:
- `**bold**`
- `*italic*`
- `# headers`
- `- bullets`
- `1. numbered lists`
- `` `code` ``
- ````code blocks````
- `[links](url)`

#### `checkNoGenericFiller(text)`
Detects 19 phrases:
- "team player", "detail-oriented", "hard worker"
- "passionate about", "self-starter", "think outside the box"
- "go-getter", "results-driven", "synergy"
- "leverage", "proven track record", "dynamic"
- "motivated", "enthusiastic"

#### `checkQuantifiedImpact(bullets)`
Requires numbers/percentages in every bullet:
- `/\d+%?|\$\d+|\d+\s*(k|K|m|M)/`

#### `checkCoverLetterLength(text)`
Word count check (currently 200-500, should be 250-400):
- Under 200 words → violation
- Over 500 words → violation

### Pipeline Integration

Resume pipeline:
```typescript
// After truth-lock validation
validateResumeQuality(documentText, bullets);
// Throws QualityViolation if any checks fail
```

Cover letter pipeline:
```typescript
// After truth-lock validation
validateCoverLetterQuality(fullText);
// Throws QualityViolation if any checks fail
```

### Error Handling

When `QualityViolation` is caught:
1. Log violations for debugging
2. Store failed version with violation notes
3. Return error to user with specific issues
4. User can retry or adjust inputs

---

## 6. Testing Strategy

### Unit Tests (Recommended Additions)

```typescript
// validation.test.ts
describe("checkNoMarkdown", () => {
  it("detects bold formatting", () => {
    expect(checkNoMarkdown("**bold**")).toHaveLength(1);
  });
  it("passes plain text", () => {
    expect(checkNoMarkdown("plain text")).toHaveLength(0);
  });
});

describe("checkNoGenericFiller", () => {
  it("detects team player", () => {
    expect(checkNoGenericFiller("I am a team player")).toHaveLength(1);
  });
});

describe("checkCoverLetterLength", () => {
  it("rejects 100 words", () => {
    expect(checkCoverLetterLength("word ".repeat(100))).toHaveLength(1);
  });
  it("accepts 300 words", () => {
    expect(checkCoverLetterLength("word ".repeat(300))).toHaveLength(0);
  });
});
```

### Integration Tests

1. Create job with specific requirements
2. Trigger resume tailor
3. Verify output has no markdown
4. Verify output has quantified bullets
5. Verify semantic scoring gives >50 for matching resume

---

## Configuration

### Env Vars
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` — Required
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL` — Default: `https://openrouter.ai/api/v1`

### AI Model Config
Quality improvements work with any model, but better models produce better first-pass results. Current default is DeepSeek V4 Pro.

---

## Known Limitations

1. **Semantic checks missing** — Rules 3 (tailoring) and 6 (business problem) are prompted but not validated
2. **Length range too loose** — Cover letter uses 200-500 instead of 250-400
3. **Company name confusion** — Earlier prompts incorrectly suggested adding company name to resume (should only be in cover letter)
4. **No retry logic** — If validation fails, user must manually retry

---

## Future Enhancements

1. Add AI-based semantic validation (second AI call to check tailoring)
2. Implement automatic retry with refined prompts on QualityViolation
3. Add user feedback loop to improve best practices rules
4. Compare multiple models and pick best output (already partially implemented in wizard)
