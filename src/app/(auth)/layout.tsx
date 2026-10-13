export default function LayoutAutenticacao({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-muted/40 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <p className="text-lg font-semibold tracking-tight">IPEMaster OS</p>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
