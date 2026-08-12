export function interpolateTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return values[key] ?? `{{${key}}}`;
  });
}
