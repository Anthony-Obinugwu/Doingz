# Internal Reference: Doingz Project

## Overview
Doingz is a Naija-themed daily word puzzle, quick-fire trivia, and 22-game arcade for Lagos Life built on the Vatar Games SDK.

## Game Modes & Architecture
1. **Daily Word**: 5-letter Naija word, evaluated on server, daily streak & score.
2. **Quick Fire Trivia**: 10 questions timed trivia, scored daily up to limit.
3. **Arcade (Player vs Computer)**:
   - 22 complete games (Skill & Aim, Board & Cards, Words & Party).
   - Simulations run deterministically in `public/shared/` and `public/arcade/`.
   - AI opponents tuned for fair human-like competition.
   - Independent of Vatar match infrastructure (requires no external multiplayer lobbies).
4. **Arcade (Friend Games / Multiplayer)**:
   - Dependent on Lagos Life platform match approvals (`Vatar.match.*`).
   - Scaffolding approach: Marked as in review/coming soon or friendly practice, keeping Player vs Computer front and center for launch review.

## Review & Launch Checklist
To get approved and live on Lagos Life:
1. **SDK init seen**: Triggered when sandbox loads.
2. **Test purchase made**: Triggered in Shop via "Pay (test)".
3. **Purchase verified by server**: Handled by `/api/claim` -> Vatar verification API.
4. **Marked delivered**: Handled by `/api/claim` -> Vatar deliver API.
5. **Webhook answered 2xx**: Optional, tested via "Send test webhook" button.

Once items 1–4 are ticked, the listing can be submitted for review.
Multiplayer matches are activated by Lagos Life upon platform approval.
