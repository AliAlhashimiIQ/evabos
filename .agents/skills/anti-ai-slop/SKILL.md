---
name: anti-ai-slop
description: Enforces clean, human-crafted code, high technical taste, and zero AI boilerplate. Use when writing, refactoring, or reviewing code to eliminate generic placeholders, verbose redundant comments, over-engineered abstractions, and robotic communication.
---

# Anti-AI Slop & Clean Craftsmanship

This skill guarantees that all code, architecture, and communication remain clean, purposeful, robust, and free from common "AI slop" tells.

---

## 🚫 What is AI Slop?

AI Slop refers to low-effort, machine-authored patterns that look convincing at first glance but add bloat, degrade codebase quality, and frustrate users:

1. **Obvious / Redundant Comments:**
   - ❌ `// Function to handle submit event`
   - ❌ `// Return the result`
   - ❌ `// State for loading`
   - ✅ Only document the **why**, tricky edge cases, or non-obvious business logic.

2. **Lazy Placeholders & Pseudo-Code:**
   - ❌ Leaving `// TODO: implement real logic here`
   - ❌ Returning mock static data in production paths
   - ✅ Write complete, functioning, edge-case-handled implementations.

3. **Over-Engineering & Premature Abstraction:**
   - ❌ Creating 4 wrapper classes, 3 factory interfaces, and generic middleware for a simple 10-line handler.
   - ✅ Favor direct, readable, modular functions. Choose simplicity and clarity over complex indirection.

4. **Robotic & Verbose Explanations:**
   - ❌ Endless paragraphs explaining what line 4 does, or repeating the user's prompt back to them.
   - ✅ Clear, concise, direct answers focused on outcomes, architecture decisions, and actionable steps.

---

## 🛡️ Core Rules & Standards

### 1. Code Quality & Technical Taste
- **Type Safety Without `any`:** Always use precise TypeScript interfaces and unions instead of slapping `any` or `@ts-ignore`.
- **Defensive & Resilient:** Guard against `undefined`, `null`, `NaN`, and empty collections. Handle async rejections gracefully.
- **No Dead Code:** Remove unused variables, deprecated imports, and commented-out legacy blocks immediately.
- **No Monolith Sprawl:** Break huge files into cohesive single-responsibility hooks, modules, and sub-components when they exceed maintainable size.

### 2. Architecture Hygiene
- Use domain-driven module boundaries (`db/`, `ipc/`, `hooks/`, `components/`).
- Keep IPC surfaces lean, secure, and typed end-to-end.
- Ensure transactions are used for multi-step mutations with atomic commit/rollback.

### 3. Human Communication
- Keep answers concise and informative.
- Highlight breaking changes, performance implications, and security risks upfront.
- Never use robotic filler phrases or generic boilerplate text.
