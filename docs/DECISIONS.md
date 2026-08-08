# DECISIONS.md

# UNANSWERED Architecture Decision Records

Version: 1.0

---

# Purpose

This document records architectural, interaction, and product decisions that define UNANSWERED.

These decisions should be treated as intentional.

Do not reverse them without explicit approval.

Every major implementation should respect these records.

---

# ADR-001

## Title

UNANSWERED is an exhibition, not an application.

## Status

Accepted

## Context

Traditional digital products optimize efficiency.

UNANSWERED aims to create an immersive exhibition experience instead.

Treating it as a conventional application would fundamentally change the visitor experience.

## Decision

The project will always prioritize immersion over conventional web usability patterns.

Navigation, interaction, and layout should reinforce the feeling of walking through an exhibition.

## Consequences

Avoid dashboard layouts.

Avoid application-style navigation.

Prefer spatial transitions over page transitions.

---

# ADR-002

## Title

Questions are more important than answers.

## Status

Accepted

## Context

Most digital products collect answers.

UNANSWERED explores the process of answering.

The visitor's hesitation often contains more meaning than the final response.

## Decision

Interaction data includes

- responses

- revisions

- deleted text

- hesitation

- skipped questions

- dwell time

These are equally important.

## Consequences

Never store only final answers.

Behavior should always be preserved.

---

# ADR-003

## Title

Silence is meaningful interaction.

## Status

Accepted

## Context

Many interfaces interpret inactivity as nothing.

UNANSWERED considers silence part of the exhibition.

## Decision

No interaction,

waiting,

hesitation,

and skipped questions

are valid exhibition outcomes.

## Consequences

Do not force visitors to answer.

Do not penalize silence.

Never display "Required" questions.

---

# ADR-004

## Title

AI interprets rather than evaluates.

## Status

Accepted

## Context

The exhibition is not psychological software.

Visitors should never feel analyzed or diagnosed.

## Decision

The AI Report may describe

patterns

journeys

observations

but never

diagnoses

scores

labels

personality types

## Consequences

Never generate

"You are..."

Prefer

"During the exhibition..."

---

# ADR-005

## Title

Every Scene has one emotional purpose.

## Status

Accepted

## Context

Emotional consistency is more important than interaction complexity.

## Decision

Every Scene introduces

one emotion

one question

one interaction style

## Consequences

Avoid combining multiple emotional themes.

Avoid introducing new interaction mechanics without necessity.

---

# ADR-006

## Title

The interface should disappear.

## Status

Accepted

## Context

Visitors should remember the exhibition rather than the software.

## Decision

UI should always remain visually secondary.

Questions,

space,

lighting,

and atmosphere

must receive higher visual priority.

## Consequences

Avoid decorative UI.

Avoid visually dominant buttons.

Prefer whitespace over interface density.

---

# ADR-007

## Title

AI collaboration is a first-class citizen.

## Status

Accepted

## Context

This repository is designed for collaboration between humans and AI coding agents.

## Decision

Every major decision must be documented.

Documentation should remain the source of truth.

Implementation should never contradict documentation.

## Consequences

PROJECT.md

DESIGN.md

CLAUDE.md

DECISIONS.md

must remain synchronized.

---

# ADR-008

## Title

Reuse before creation.

## Status

Accepted

## Context

Unnecessary duplication increases maintenance cost.

## Decision

Always reuse

components

hooks

tokens

animations

before creating new implementations.

## Consequences

Duplicate code should be treated as technical debt.

---

# ADR-009

## Title

Accessibility is part of immersion.

## Status

Accepted

## Context

Accessibility and aesthetics should not compete.

## Decision

Every Scene must support

keyboard navigation

reduced motion

semantic HTML

visible focus

screen readers

## Consequences

Accessibility cannot be removed for visual preference.

---

# ADR-010

## Title

Minimalism over decoration.

## Status

Accepted

## Context

Additional visual elements often reduce emotional clarity.

## Decision

Whenever uncertain,

remove elements instead of adding new ones.

## Consequences

Whitespace is preferred.

Silence is preferred.

Atmosphere is preferred.

The exhibition experience always comes first.

---

# Future Decisions

New decisions should follow the same format.

## Title

## Status

## Context

## Decision

## Consequences
