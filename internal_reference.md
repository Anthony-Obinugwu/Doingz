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
   - Full multiplayer panel prominent at the top of the Arcade tab (Invite a friend, Quick match, code join).
   - "Leave game" / "Leave / Resign" button available in all game modes to cleanly forfeit and release open Vatar matches.
   - Built-in "Reset open match" button in the menu and automatic clearing of stale Vatar matches when `busy` is encountered.

## Review & Launch Checklist
To get approved and live on Lagos Life:
1. **SDK init seen**: Triggered when sandbox loads.
2. **Test purchase made**: Triggered in Shop via "Pay (test)".
3. **Purchase verified by server**: Handled by `/api/claim` -> Vatar verification API.
4. **Marked delivered**: Handled by `/api/claim` -> Vatar deliver API.
5. **Webhook answered 2xx**: Optional, tested via "Send test webhook" button.
6. **Multiplayer (A test match played)**:
   - Appears because `VATAR_RESULTS_SECRET_TEST` is registered with Vatar.
   - Verification flow:
     1. Confirm `VATAR_RESULTS_SECRET_TEST` is set in Render Environment Variables (from keys: `vtr_rsec_test_...`).
     2. In the Sandbox, create a match (Arcade -> Invite a friend or Quick Match).
     3. In the sandbox player frame, let the test bot take the second seat (or pair via Quick Match).
     4. Once the game loads, tap **Resign** in Doingz.
     5. The Doingz server signs the result with `VATAR_RESULTS_SECRET_TEST` and posts it to Vatar.
     6. Vatar verifies the signature and ticks the checklist item.

