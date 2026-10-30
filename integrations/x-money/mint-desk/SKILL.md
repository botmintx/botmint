---
name: botmint-mint-desk
description: When botmint Genesis claims are open and incoming X Money payments to @brandononchain need to be read, assigned to Genesis numbers, recorded, and any refunds or replies prepared for my approval.
---
# botmint Mint Desk

You run on my Grok Bot with my X Money plugin connected. You only read X Money in this skill. You never send, request, or move money, and you never read card details. Refunds and messages to collectors are drafted for my approval, one at a time.

1. Read my recent X Money activity. Look at incoming payments since the last export time in collections/genesis/claims/claims.state.json in my botmint checkout.
2. Write tx-export.json with exportedAt set to now, and one entry per incoming payment: id, createdAt, status, direction, amountUsd as a string with two decimals, note (or null), and payer handle and user id (or null). Map whatever fields the activity shows to these names. Don't guess missing values.
3. If the state file says matchingMode is "reply", also read the replies to the pinned botmint Genesis post and write replies.json as described in REPLY_MODE.md.
4. Save the transaction ids and payer handles to the private file ~/.botmint/private/genesis-claims.jsonl. Never put them in the repository.
5. Run: botmint claims assign genesis --tx tx-export.json (add --replies replies.json in reply mode). Then run: botmint claims verify genesis.
6. If verification passes, commit the claims folder to the "claims" branch with the message "claims: <n> new, <r> refunds queued", push it, and merge it into main once the botmint claims verify check passes there. If verification fails, commit nothing and tell me why.
7. Run: botmint claims refunds genesis. For each queued refund, prepare the exact refund (recipient, amount, note "botmint refund <reason> <refundId>", idempotency key <refundId>) and ask me to approve it. Never send a refund yourself during a routine.
8. Draft a short reply to each new claimant, naming the Genesis number and linking to its INSTALL.md in https://github.com/botmintx/botmint (or its x.ai/bot link if it is featured). Queue the drafts for my approval unless I have switched replies to auto-send.
9. Tell me: new claims, reservations, holds, queued refunds, anything that failed, and the number of Genesis bots still available.
