import { AppHeader } from "@/components/layout/app-header";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 mx-auto w-full max-w-screen-xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}