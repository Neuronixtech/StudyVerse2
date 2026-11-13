import type { ExamCategory, ExamId, Subject, SubjectId } from "../types";

export const SUBJECTS: Subject[] = [
  { id: "physics", name: "Physics" },
  { id: "chemistry", name: "Chemistry" },
  { id: "mathematics", name: "Mathematics" },
];

export const EXAMS: ExamCategory[] = [
  { id: "jee-main", name: "JEE Main", short: "JEE Main", description: "NTA computer-based test for NITs, IIITs and JEE Advanced eligibility." },
  { id: "jee-advanced", name: "JEE Advanced", short: "JEE Adv", description: "Entrance to the IITs, with multi-select and numerical-answer questions." },
  { id: "mht-cet", name: "MHT-CET", short: "MHT-CET", description: "Maharashtra state engineering entrance with no negative marking." },
  { id: "bitsat", name: "BITSAT", short: "BITSAT", description: "Planned category — shown to illustrate flexible classification.", comingSoon: true },
];

export const subjectName = (id: SubjectId) => SUBJECTS.find((s) => s.id === id)?.name ?? id;
export const examName = (id: ExamId) => EXAMS.find((e) => e.id === id)?.name ?? id;
export const examShort = (id: ExamId) => EXAMS.find((e) => e.id === id)?.short ?? id;
