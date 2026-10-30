import Handlebars from "handlebars";

const hbs = Handlebars.create();

hbs.registerHelper("join", (items: unknown, separator: unknown) => {
  const list = Array.isArray(items) ? items.map((item) => String(item)) : [];
  const sep = typeof separator === "string" ? separator : ", ";
  return list.join(sep);
});

hbs.registerHelper("lower", (value: unknown) => String(value ?? "").toLowerCase());
hbs.registerHelper("upper", (value: unknown) => String(value ?? "").toUpperCase());

export function renderTemplate(template: string, context: unknown): string {
  const compiled = hbs.compile(template, { strict: true, noEscape: true });
  return compiled(context);
}

export function humanList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
