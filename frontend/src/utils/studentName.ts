export interface StudentName {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}

export function formatStudentName(student?: StudentName | null): string {
  return [student?.first_name, student?.middle_name, student?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}
