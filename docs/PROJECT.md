# UNANSWERED

> An AI-first interactive exhibition exploring the questions people never answered.

---

# 1. Project

## Overview

UNANSWERED is an interactive web exhibition that transforms unanswered moments into an immersive digital experience.

Rather than presenting information, the exhibition invites visitors to become part of it.

Visitors walk through a sequence of exhibition spaces, respond to reflective questions, remain silent when they choose, and ultimately receive an AI-generated narrative based on their journey.

The experience is intentionally slow.

Silence, hesitation, and unfinished thoughts are treated as meaningful interactions rather than missing data.

UNANSWERED is not a psychological assessment.

It is not a personality test.

It is not a productivity tool.

It is an exhibition.

---

# 2. Vision

Digital interfaces are designed to minimize hesitation.

UNANSWERED is designed to preserve it.

Instead of optimizing for speed and efficiency, the exhibition encourages visitors to slow down, observe, and reflect.

The project explores a different relationship between people and technology, where AI is not used to predict or evaluate users but to help them reinterpret their own experiences.

---

# 3. Mission

The project pursues four goals.

• Create an online exhibition that feels like a physical exhibition.

• Transform user interaction into emotional storytelling.

• Demonstrate AI as a reflective medium rather than an evaluative tool.

• Explore a new interaction paradigm based on silence, time, and memory.

---

# 4. Core Philosophy

Everything inside UNANSWERED follows these principles.

## The visitor is the exhibition.

The exhibition does not tell a story.

It allows visitors to construct their own.

---

## Questions are more important than answers.

Every interaction begins with a question.

Answers are optional.

Questions remain.

---

## Silence is meaningful.

Not responding is still a response.

Deleting text is interaction.

Waiting is interaction.

Changing one's mind is interaction.

---

## AI interprets.

AI never evaluates.

It never diagnoses.

It never classifies.

It simply reconstructs the visitor's journey.

---

## The interface disappears.

Visitors should remember

the atmosphere,

the light,

the questions,

and the emotions.

They should not remember

buttons,

navigation,

or interface elements.

---

# 5. Visitor Journey

The exhibition follows a simple journey.

Arrival

↓

Registration

↓

Eight Exhibition Spaces

↓

AI Interpretation

↓

Reflection

↓

Exit

Every visitor experiences the same structure.

Every journey becomes unique through interaction.

---

# 6. Exhibition Structure

The exhibition contains eleven sequential scenes.

Each scene records interaction.

Each scene changes the atmosphere.

The exhibition gradually shifts from observation toward reflection.

Scene order is defined by SCENE_ORDER in src/store/experienceStore.ts.

Zone labels are defined in src/data/zones.ts.

| # | SceneId | Zone | Space |
|---|---------|------|-------|
| 1 | landing | — | Archive cover |
| 2 | intro | ZONE 01 | Elevator Entry |
| 3 | registration | ZONE 02 | Registration |
| 4 | lightArchive | ZONE 03 | Light Archive |
| 5 | recordLayerFirstVisit | ZONE 04 | Record Layer |
| 6 | zone03Intro | ZONE 05 | Zone 03 Intro |
| 7 | soundClues | ZONE 06 | Sound Clues |
| 8 | memorySketch | ZONE 07 | Memory Sketch |
| 9 | sentenceClues | ZONE 08 | Sentence Clues |
| 10 | recordLayerSecondVisit | ZONE 09 | Record Layer |
| 11 | finalReport | ZONE 10 | Final Report |

---

# 7. AI Report

The AI Report is the final exhibition artifact.

It is not generated to explain the visitor.

It exists to document the exhibition experience.

The report is generated using

• responses

• skipped questions

• edits

• pauses

• interaction timing

• navigation behavior

The report never assigns labels.

Instead it describes patterns observed during the exhibition.

Example

Instead of

"You are an introverted person."

The report writes

"Several moments during the exhibition were marked by longer periods of reflection before responding."

---

# 8. Technical Overview

Frontend

React

Vite

TypeScript

Framer Motion

Zustand

Client only.

No backend. No external API.

State is stored in localStorage.

The final report is composed locally in src/utils/report.ts.

---

# 9. Experience Principles

Every implementation should satisfy these principles.

• Atmosphere before interface.

• Reflection before completion.

• Space before information.

• Emotion before decoration.

• Interpretation before evaluation.

---

# 10. Success Criteria

The project succeeds when visitors remember

• the atmosphere

• the questions

• the lighting

• the silence

• the final report

The project fails when visitors mainly remember

• buttons

• menus

• navigation

• UI components

The interface should quietly disappear.

The experience should remain.

---

# 11. Repository Structure

```

README.md

docs/

PROJECT.md

DESIGN.md

CLAUDE.md

src/

public/

```

---

# 12. Documentation

This repository is organized around three core documents.

PROJECT.md

Explains what UNANSWERED is.

DESIGN.md

Defines how UNANSWERED should feel.

CLAUDE.md

Defines how UNANSWERED should be implemented.

Together, these documents provide enough context for both human collaborators and AI coding agents to understand, design, and build the project consistently.
