# Unresolved Issues — Job Ops Platform

**Last Updated:** May 2, 2026
**Session:** AI Quality + UI Polish Completion

---

## Critical Issues

### 1. Resume Tailoring Is Weak

**Problem:** The AI prompt tells the AI to "match skills where supported" but this is passive and optional. The AI treats tailoring as keyword matching instead of a total rewrite.

**Current Prompt (weak):**
```
5. Match the job's required skills and keywords where truthfully supported by claims.
```

**What It Should Say:**
```
PRIMARY INSTRUCTION: You are tailoring a resume for [Company]'s [Job Title] position.
This is NOT a generic resume — every bullet must speak directly to THIS job.

BEFORE writing:
1. List the top 5 requirements from the job description
2. For each requirement, find the matching experience in the resume
3. Flag any gap where the resume lacks evidence

WHILE writing:
- Mirror the job description language EXACTLY where truthful
  (e.g., if JD says "cross-functional team leadership", use that phrase)
- Reorder bullets so the most relevant accomplishments for THIS role come first
- Remove or deprioritize experience irrelevant to THIS job
- Every remaining bullet must use phrasing from the job description where it applies
```

**Impact:** Users get resumes with generic bullets that don't reference the specific job.

**Fix Required:** Rewrite SYSTEM_PROMPT in `artifacts/api-server/src/lib/pipelines/resume-tailor.ts`

---

### 2. Semantic Validation Gaps

**Problem:** Two best practices rules cannot be validated with regex/post-processing:

| Rule | Validation Status | Why It's Hard |
|------|------------------|---------------|
| "Must tailor to specific job" | ❌ Not validated | Requires semantic understanding of job vs resume match |
| "Address specific business problem" | ❌ Not validated | Requires understanding of company's business from JD |

**Current Validators (regex-based):**
- ✅ `checkNoMarkdown()` — 8 patterns
- ✅ `checkNoGenericFiller()` — 19 phrases
- ✅ `checkQuantifiedImpact()` — Number detection
- ✅ `checkCoverLetterLength()` — Word count

**Missing Validators (semantic):**
- ❌ `checkTailoredToJob()` — Does output reference job-specific language?
- ❌ `checkAddressesBusinessProblem()` — Does cover letter mention company's problem?

**Options:**
1. Add a second AI validation step (expensive but thorough)
2. Use keyword matching as proxy (cheap but imperfect)
3. Document as "AI-instructed but not validated, human review required"

**Recommendation:** Option 2 for now (keyword matching), Option 1 later if needed.

---

### 3. Cover Letter Length Validation Too Loose

**Problem:** Current validator uses 200-500 word range:
```typescript
if (wordCount < 200) { /* too short */ }
if (wordCount > 500) { /* too long */ }
```

**Best Practice Rule:** 250-400 words

**Fix Required:** Update `checkCoverLetterLength()` in `artifacts/api-server/src/lib/pipelines/validation.ts`

---

## Medium Priority Issues

### 4. Company Name in Resume Summary

**Status:** Research shows this is NOT standard practice. The resume should mirror JD language, not mention the company name. The cover letter is where the company name belongs.

**Fix:** Remove any "mention company name" instructions from resume prompts.

---

### 5. UI Polish Remaining

Some pages may still have minor inconsistencies:
- Spacing between elements
- Card padding consistency
- Color token usage edge cases

**Known Issues:**
- Stats page: Inline HSL values in chart gradients (uses `hsl(var(--primary))` but should use Tailwind classes)
- Landing page: Some arbitrary sizing values (`max-w-[800px]`, `blur-[120px]`)

---

## Low Priority / Nice to Have

### 6. Admin UI for Best Practices

**Status:** ✅ Created but needs testing
**File:** `artifacts/dashboard/src/pages/admin/best-practices/index.tsx`

**Verify:**
- Can view rules
- Can edit descriptions
- Can toggle on/off
- Can add custom rules
- Refresh from AI works

---

### 7. 3D Card Performance

**Status:** Working but may impact performance on low-end devices
**Component:** `TiltCard`

**Consider:**
- Adding `prefers-reduced-motion` media query support
- Limiting to desktop only (already disabled on mobile via hover detection)

---

### 8. Gamification Backend Polish

**Status:** Backend complete but some edge cases untested
**Tables:** user_stats, xp_log, achievements, user_achievements, quests, user_quests, streak_log

**Untested:**
- Streak calculation on timezone changes
- Achievement unlocking race conditions
- Quest expiration logic

---

## Blocked / Waiting on User

### 9. AI Prompt Testing with Fresh Data

**Status:** Prompts improved but not tested with real jobs
**Need:** User to clear test data, add fresh resume + job, run through wizard

**Test Checklist:**
- [ ] Resume generates without markdown
- [ ] Resume bullets are quantified
- [ ] Resume is tailored to specific job
- [ ] Cover letter is 250-400 words
- [ ] Cover letter addresses business problem
- [ ] No generic filler phrases
- [ ] Semantic scoring gives meaningful score
- [ ] Resume-to-profile pipeline creates accurate profile

---

## Fixed in This Session (for reference)

| Issue | Fix | Commit |
|-------|-----|--------|
| No markdown in output | Added `checkNoMarkdown()` | `87b5f84` |
| Generic filler phrases | Added `checkNoGenericFiller()` | `87b5f84` |
| No quantified impact | Added `checkQuantifiedImpact()` | `87b5f84` |
| Cover letter too short | Added `checkCoverLetterLength()` | `87b5f84` |
| Hardcoded HSL colors | Replaced with semantic classes | Multiple |
| Missing PageHeaders | Added to 4 pages | `2f88793` |
| No delete buttons | Added to 6 pages | Multiple |
| Resume content not visible | Fixed fallback field check | `7693790` |

---

## How to Close These Issues

### Quick Wins (1-2 hours)
1. Tighten cover letter length validation (change 200→250, 500→400)
2. Fix resume prompt to make tailoring mandatory
3. Remove "mention company name" from resume prompts

### Medium Work (3-4 hours)
4. Add keyword-based tailoring validation proxy
5. Add keyword-based business problem validation proxy
6. Test admin UI for best practices

### Requires User Testing
7. Run fresh data through improved prompts
8. Validate semantic scoring accuracy
9. Verify resume-to-profile pipeline quality
