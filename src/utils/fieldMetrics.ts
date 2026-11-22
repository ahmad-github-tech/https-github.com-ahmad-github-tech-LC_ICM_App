import type { CaseFieldDefinition, FieldMetrics } from '../types/icm';

export function isFieldEmpty(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '—' || trimmed === '-';
}

export function computeFieldMetrics(fields: CaseFieldDefinition[]): FieldMetrics {
  const total = fields.length;
  let filled = 0;
  let mandatoryTotal = 0;
  let mandatoryFilled = 0;
  let mandatoryEmpty = 0;
  let attentionCount = 0;
  let icmTotal = 0;
  let icmFilled = 0;
  let customDbTotal = 0;
  let customDbFilled = 0;

  for (const field of fields) {
    const empty = isFieldEmpty(field.value);
    if (!empty) filled += 1;

    if (field.required) {
      mandatoryTotal += 1;
      if (empty) {
        mandatoryEmpty += 1;
      } else {
        mandatoryFilled += 1;
      }
    }

    if (field.attention && field.attention !== 'none') {
      attentionCount += 1;
    }

    if (field.source === 'ICM') {
      icmTotal += 1;
      if (!empty) icmFilled += 1;
    } else {
      customDbTotal += 1;
      if (!empty) customDbFilled += 1;
    }
  }

  const empty = total - filled;
  const completionPct = total === 0 ? 100 : Math.round((filled / total) * 100);

  return {
    total,
    filled,
    empty,
    mandatoryTotal,
    mandatoryFilled,
    mandatoryEmpty,
    attentionCount,
    icmTotal,
    icmFilled,
    customDbTotal,
    customDbFilled,
    completionPct,
  };
}

export interface SectionSummary {
  section: string;
  sectionOrder: number;
  fields: CaseFieldDefinition[];
  total: number;
  filled: number;
  mandatoryEmpty: number;
  attentionCount: number;
}

export function groupFieldsBySection(fields: CaseFieldDefinition[]): SectionSummary[] {
  const map = new Map<string, SectionSummary>();

  for (const field of fields) {
    let group = map.get(field.section);
    if (!group) {
      group = {
        section: field.section,
        sectionOrder: field.sectionOrder,
        fields: [],
        total: 0,
        filled: 0,
        mandatoryEmpty: 0,
        attentionCount: 0,
      };
      map.set(field.section, group);
    }
    group.fields.push(field);
    group.total += 1;
    const empty = isFieldEmpty(field.value);
    if (!empty) group.filled += 1;
    if (field.required && empty) group.mandatoryEmpty += 1;
    if (field.attention && field.attention !== 'none') group.attentionCount += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.sectionOrder - b.sectionOrder);
}
