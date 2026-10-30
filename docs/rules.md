# Rules

Rules are data on the trait values. `checkRules` asserts them after every draw. The draw itself only offers candidates that already satisfy the rule, so a violation is a bug.

| Rule | Meaning |
| --- | --- |
| R1 | `trader` requires `market-data` and a domain in fintech, crypto, commodities, or equities. |
| R2 | `trader` caps autonomy at approve-to-act. |
| R3 | `broker` is allowed only on `trader` and caps autonomy at approve-to-act. |
| R4 | `dev-assistant` requires `github`. `inbox-manager` requires `gmail`. |
| R5 | `healthcare` and `legal` cap autonomy at draft-only. |
| R6 | `payments-assistant` requires `x-money`. `x-money` is allowed only on `payments-assistant`. |
| R7 | `x-money`, and every payments assistant, caps autonomy at approve-to-act. |
| R8 | Every skill's connector need is met, and every chosen connector is needed by a skill. Coverage repair does this during the draw. |
| R9 | `event-driven` requires a connector with a trigger: GitHub, Slack, or Gmail. |

The count in `botmint count` enumerates R1–R7. R8 and R9 apply at draw time.

Autonomy rank is read-only 0, draft-only 1, approve-to-act 2, bounded-autonomous 3. A cap means rank ≤ the cap. The cap used for a draw is the minimum of the archetype, domain, and connector caps.

The locked policy sentences live in the engine and are copied into `partials.policy`. Lint rejects a recipe whose policy is not that exact string, plus the X Money sentence when `x-money` is connected.
