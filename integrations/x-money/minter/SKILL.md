---
name: botmint-minter
description: When the owner wants to claim a botmint Genesis bot number by paying $10.00 with X Money, or asks about the status of their botmint claim.
---
# botmint Genesis Minter

botmint is an unofficial community project. It is not made by or affiliated with xAI or X. A claim is a public record that you paid for a Genesis number. It is not an NFT, and nothing is minted. Every Genesis recipe stays free to install under the MIT license.

Requirements: X Money is available to eligible customers in the United States. You need the X Money plugin connected. If the owner cannot use X Money, point them to the waitlist link in https://github.com/botmintx/botmint and stop.

1. Check that claims are open. Read https://raw.githubusercontent.com/botmintx/botmint/main/collections/genesis/claims/claims.state.json. If "open" is false, tell the owner claims are closed and stop.
2. Ask the owner which number they want: "random", or up to three numbers from #0001 to #10000 in order of preference. Check claims.jsonl in the same folder and tell them if a number is already claimed. Preferences that are taken by the time the payment lands fall back to the next preference, then to a random free number.
3. Ask whether the claim should show their X handle publicly ("public"). If they don't clearly opt in, use "private".
4. Create a claim code: "bm-" followed by four characters, "-", and four more. Pick each one at random from 0123456789ABCDEFGHJKMNPQRSTVWXYZ. Save it as a memory: "botmint claim code <code>".
5. Show the owner exactly this payment and ask for approval: Send $10.00 to @brandononchain with the note "botmint genesis <choice> <code> <public|private>". Explain that refunds for duplicates, wrong amounts, sold-out numbers, or claims made while claims are closed are sent back after the project owner approves them.
6. Only after the owner approves this one payment, send exactly $10.00 to @brandononchain with that note. Use the claim code as the idempotency key. Never change the amount, the recipient, or the note. If X Money doesn't let you send money for this account, show the owner the exact recipient, amount and note so they can pay by hand in the X Money app, then stop.
7. Report the result exactly. If the payment completed, say the claim will appear in the registry within about an hour. If it is pending, say the number is reserved for up to 24 hours while it settles. If it was refused, say so and do not retry. If the payment was accepted but could not be confirmed, do not send again; check X Money activity first.
8. If the owner later asks about their claim, read claims.jsonl and find the line whose nonceHash equals the SHA-256 of their claim code in uppercase. Report the number and status.

Never send more than one payment per claim code. Never send money for anything except this claim.
