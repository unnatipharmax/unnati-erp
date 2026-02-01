"use client";

export default function Header() {
  return (
    <header className="h-14 bg-[#0f172a] text-gray-200 flex items-center justify-between px-6 border-b border-gray-700">
      <h1 className="text-lg font-semibold tracking-wide">Dashboard</h1>

      <span className="text-sm opacity-70">Logged in as Admin</span>
    </header>
  );
}
