/** Distraction-minimised layout for the exam: no site navigation, footer or prototype toolbar. */
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-slate-100">{children}</div>;
}
