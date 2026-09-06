import type { ManifestDiagnostic } from "./manifestSchema";

export class ManifestDiagnosticCollector {
  private readonly unknownFields = new Set<string>();
  private readonly deprecatedFields = new Map<string, string | undefined>();

  public record(diagnostics: readonly ManifestDiagnostic[]): void {
    for (const diagnostic of diagnostics) {
      if (diagnostic.kind === "unknown-field") this.unknownFields.add(diagnostic.field);
      else this.deprecatedFields.set(diagnostic.field, diagnostic.replacement);
    }
  }

  public summary(sourceLabel: string): string | undefined {
    const parts: string[] = [];
    if (this.unknownFields.size) parts.push(`unknown forward-compatible field(s): ${bounded(this.unknownFields)}`);
    if (this.deprecatedFields.size) parts.push(`deprecated field(s): ${bounded(this.deprecatedFields.keys())}`);
    return parts.length ? `Source '${sourceLabel}' manifest compatibility summary: ${parts.join("; ")}.` : undefined;
  }
}

function bounded(values: Iterable<string>): string {
  const all = [...values].sort();
  return `${all.slice(0, 20).join(", ")}${all.length > 20 ? `, and ${all.length - 20} more` : ""}`;
}
