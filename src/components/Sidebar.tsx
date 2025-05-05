// @ts-nocheck
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MapPin, Trash, Coins, Medal, Settings, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStatus } from "@/lib/web3auth";
import { getUserByEmail } from "@/utils/db/actions";

export default function Sidebar({ open }) {
  const pathname = usePathname();
  const [error, setError] = useState(null);
  const [isReporter, setIsReporter] = useState(false);
  const { isLoggedIn } = useAuthStatus();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        if (!userEmail) {
          setError("User email not found in local storage");
          return;
        }
        const user = await getUserByEmail(userEmail);
        setIsReporter(user?.role === "Reporter");
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };

    if (isLoggedIn) {
      fetchUser();
    }
  }, [isLoggedIn]);

  // Define sidebar items - we'll filter them later based on user role
  const allSidebarItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/report", icon: MapPin, label: "Report Waste" },
    { href: "/collect", icon: Trash, label: "Collect Waste", hideForReporter: true },
    { href: "/rewards", icon: Coins, label: "Rewards" },
    { href: "/leaderboard", icon: Medal, label: "Leaderboard" },
  ];

  // Filter sidebar items based on user role
  const visibleSidebarItems = allSidebarItems.filter(
    item => !(item.hideForReporter && isReporter)
  );

  return (
    <aside
      className={`bg-white border-r pt-20 border-gray-200 text-gray-800 w-64 fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
    >
      <nav className="h-full flex flex-col justify-between">
        <div className="px-4 py-6 space-y-8">
          {visibleSidebarItems.map((item) => (
            <Link key={item.href} href={item.href} passHref>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={`w-full justify-start py-3 ${pathname === item.href
                  ? "bg-green-100 text-green-800"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                <span className="text-base">{item.label}</span>
              </Button>
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200">
          <Link href="/settings" passHref>
            <Button
              variant={pathname === "/settings" ? "secondary" : "outline"}
              className={`w-full py-3 ${pathname === "/settings"
                ? "bg-green-100 text-green-800"
                : "text-gray-600 border-gray-300 hover:bg-gray-100"
                }`}
            >
              <Settings className="mr-3 h-5 w-5" />
              <span className="text-base">Settings</span>
            </Button>
          </Link>
        </div>
      </nav>
    </aside>
  );
}