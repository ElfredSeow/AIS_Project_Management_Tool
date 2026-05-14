import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      {/* Subtle grid pattern background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      <main className="relative z-10 container mx-auto px-4 py-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}