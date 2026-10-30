export type CronParts = {
  minute: number[];
  hour: number[];
  dom: number[];
  month: number[];
  dow: number[];
};

function expand(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part);
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    const base = stepMatch ? stepMatch[1]! : part;
    if (!Number.isInteger(step) || step <= 0) throw new Error(`bad step ${field}`);
    let start = min;
    let end = max;
    if (base !== "*") {
      const range = /^(\d+)-(\d+)$/.exec(base);
      if (range) {
        start = Number(range[1]);
        end = Number(range[2]);
      } else if (/^\d+$/.test(base)) {
        start = Number(base);
        end = Number(base);
      } else throw new Error(`bad field ${field}`);
    }
    if (start < min || end > max || start > end) throw new Error(`bad range ${field}`);
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
}

export function parseCron(expression: string): CronParts {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("cron needs 5 fields");
  return {
    minute: expand(fields[0]!, 0, 59),
    hour: expand(fields[1]!, 0, 23),
    dom: expand(fields[2]!, 1, 31),
    month: expand(fields[3]!, 1, 12),
    dow: expand(fields[4]!, 0, 7),
  };
}

export function minimumGapMinutes(cron: CronParts): number {
  const minutes: number[] = [];
  for (let day = 0; day < 14; day++) {
    const dow = day % 7;
    const dowOk = cron.dow.includes(dow) || cron.dow.includes(dow === 0 ? 7 : 0);
    if (!dowOk) continue;
    for (const hour of cron.hour) {
      for (const minute of cron.minute) minutes.push(day * 1440 + hour * 60 + minute);
    }
  }
  if (minutes.length < 2) return 24 * 60;
  let gap = Number.POSITIVE_INFINITY;
  for (let i = 1; i < minutes.length; i++) gap = Math.min(gap, minutes[i]! - minutes[i - 1]!);
  return gap;
}

export function withinWindow(cron: CronParts): boolean {
  return (
    cron.hour.every((hour) => hour >= 7 && hour <= 20) &&
    !(cron.hour.includes(20) && cron.minute.some((minute) => minute > 0))
  );
}

export function isWeekdaySet(cron: CronParts): boolean {
  const days = new Set(cron.dow.flatMap((day) => (day === 7 ? [0] : [day])));
  return days.size === 5 && [1, 2, 3, 4, 5].every((day) => days.has(day));
}
