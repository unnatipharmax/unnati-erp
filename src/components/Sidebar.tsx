"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Users, Package, FileText, Image as ImageIcon, Link } from "lucide-react";

const menu = [
  { name: "HOME", path: "/dashboard", icon: Home },
  { name: "ORDER INITIATION", path: "/dashboard/client-forms", icon: Link },
  { name: "ORDER ENTRY", path: "/dashboard/order-entry", icon: FileText },
  { name: "PARTY MASTER", path: "/dashboard/party", icon: Users },
  { name: "PRODUCT MASTER", path: "/dashboard/product", icon: Package },
  { name: "PURCHASE BILL", path: "/dashboard/purchase", icon: FileText },
  { name: "OCR (GEMINI)", path: "/dashboard/ocr", icon: ImageIcon },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#f1f5f9] text-gray-800 flex flex-col shadow-lg border-r">
      <div className="p-4 text-xl font-bold tracking-wide border-b bg-white">
        UNNATI PHARMAX
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 px-4 py-2 rounded-md text-left font-medium transition 
                ${active ? "bg-blue-600 text-white shadow" : "hover:bg-gray-200"}
              `}
            >
              <Icon size={18} />
              {item.name}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t bg-white">
        <button
          onClick={() => router.push("/")}
          className="w-full text-left px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-md"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
