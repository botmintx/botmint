if (process.env.BOTMINT_PUBLISH !== "1") {
  console.error(
    "Refusing to publish botmint. The package is publish-ready, and this repository does not publish it. Set BOTMINT_PUBLISH=1 only for a real release.",
  );
  process.exit(1);
}
