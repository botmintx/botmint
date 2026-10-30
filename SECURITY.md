# Security

botmint does not take custody of keys. The CLI prints unsigned transactions and reads `XAI_API_KEY` from the environment only when someone explicitly runs polish. Do not open a pull request that contains a key, a seed phrase, a transaction export from a real account, or a private claims file.

`~/.botmint/private/` must stay outside any git work tree. `botmint claims assign --private` refuses a path inside one.

Report a vulnerability through [GitHub security advisories](https://github.com/botmintx/botmint/security/advisories/new). Please do not file a public issue for an undisclosed vulnerability.

This project is not affiliated with xAI or X Corp. A bug here is not a bug in those products.
