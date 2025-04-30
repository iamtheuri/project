// @ts-nocheck
'use client'
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Menu, Coins, Leaf, Search, Bell, User, ChevronDown, LogIn } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { IProvider } from "@web3auth/base"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { createUser, getUnreadNotifications, markNotificationAsRead, getUserByEmail, getUserBalance } from "@/utils/db/actions"
import { Skeleton } from "./ui/skeleton"
import { useToast } from "@/components/hooks/use-toast";
import { AuthModal } from '@/components/AuthModal'
import { getWeb3AuthInstance, initWeb3Auth } from '@/lib/web3auth'
import { useAuthStatus } from '@/hooks/useAuthStatus'

interface HeaderProps {
  onMenuClick: () => void;
  totalEarnings: number;
}

export default function Header({ onMenuClick, totalEarnings }: HeaderProps) {
  const { toast } = useToast();
  const [initializing, setInitializing] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [balance, setBalance] = useState(0);
  const pathname = usePathname();


  // Use the auth status hook with debug mode
  const { isLoggedIn, userEmail, userName, isLoading, checkAuthStatus } = useAuthStatus();
  // Initialize Web3Auth
  useEffect(() => {
    const init = async () => {
      try {
        await initWeb3Auth();
        const web3auth = getWeb3AuthInstance();

        if (web3auth?.provider) {
          setProvider(web3auth.provider);
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
        toast({
          title: "Error",
          description: "Failed to initialize authentication system",
          variant: "destructive",
        });
      } finally {
        setInitializing(false);
      }
    };

    init();
  }, [toast]);

  // Fetch notifications when user info changes
  useEffect(() => {
    let notificationInterval: NodeJS.Timeout;

    const fetchNotifications = async () => {
      if (!userEmail) return;

      try {
        const user = await getUserByEmail(userEmail);
        if (user) {
          const unreadNotifications = await getUnreadNotifications(user.id);
          setNotifications(unreadNotifications);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    if (isLoggedIn && userEmail) {
      fetchNotifications();
      notificationInterval = setInterval(fetchNotifications, 60000);
    }

    return () => {
      if (notificationInterval) clearInterval(notificationInterval);
    };
  }, [isLoggedIn, userEmail]);

  // Fetch user balance
  useEffect(() => {
    const fetchUserBalance = async () => {
      if (!userEmail) return;

      try {
        const user = await getUserByEmail(userEmail);
        if (user) {
          const userBalance = await getUserBalance(user.id);
          setBalance(userBalance);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    if (isLoggedIn && userEmail) {
      fetchUserBalance();
    }

    // Listen for balance updates
    const handleBalanceUpdate = (event: CustomEvent) => {
      setBalance(event.detail);
    };

    window.addEventListener('balanceUpdated', handleBalanceUpdate as EventListener);

    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdate as EventListener);
    };
  }, [isLoggedIn, userEmail]);

  const clearAuthData = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isLoggedIn');
    sessionStorage.clear();

    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
  };

  const login = async () => {
    const web3auth = getWeb3AuthInstance();

    if (!web3auth) {
      toast({
        title: "Error",
        description: "Authentication system not available",
        variant: "destructive",
      });
      return;
    }

    setLoggingOut(true);

    try {
      const web3authProvider = await web3auth.connect();
      const user = await web3auth.getUserInfo();

      setProvider(web3authProvider);

      if (user.email) {
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('isLoggedIn', 'true');

        try {
          const existingUser = await getUserByEmail(user.email);
          if (!existingUser) {
            await createUser(user.email, user.name || 'Anonymous User');
          }
        } catch (error) {
          console.error("Error creating user:", error);
        }
      }

      toast({
        title: "Success",
        description: "Login successful",
        variant: "default",
      });

      checkAuthStatus();
      setAuthModalOpen(false);
    } catch (error) {
      console.error("Error during login:", error);
      toast({
        title: "Error",
        description: "Login failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const logout = async () => {
    const web3auth = getWeb3AuthInstance();
    setLoggingOut(true);

    try {
      // Attempt to logout from Web3Auth if it's available
      if (web3auth?.connected) {
        try {
          await web3auth.logout();
        } catch (web3authError) {
          console.warn("Web3Auth logout error:", web3authError);
        }
      }
      setProvider(null);
      clearAuthData();
    } catch (error) {
      console.error("Error during logout:", error);
      toast({
        title: "Error",
        description: "Error during logout",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
      checkAuthStatus();
      toast({
        title: "Success",
        description: "Logged out successfully",
        variant: "default",
      });
    }
  };

  const handleNotificationClick = async (notificationId: number) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prevNotifications =>
        prevNotifications.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({
        title: "Error",
        description: "Failed to process notification",
        variant: "destructive",
      });
    }
  };

  const handleAuthSuccess = (user: any) => {
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('isLoggedIn', 'true');
  };

  if (initializing || isLoading) {
    return (
      <div className="flex items-center space-x-4 my-2 mx-auto sm:max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="w-[40px] h-[40px] rounded-full" />
        <Skeleton className="w-[800px] h-[40px] rounded-md" />
      </div>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="mr-2 md:mr-4" onClick={onMenuClick}>
            <Menu className="h-6 w-6" />
          </Button>
          <Link href="/" className="flex items-center">
            <Leaf className="h-6 w-6 md:h-8 md:w-8 text-green-500 mr-1 md:mr-2" />
            <div className="flex flex-col">
              <span className="font-bold text-base md:text-lg text-gray-800">Trash2Token</span>
              <span className="text-[8px] md:text-[10px] text-gray-500 -mt-1">ETHOnline24</span>
            </div>
          </Link>
        </div>

        {!isMobile && (
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        )}

        <div className="flex items-center">
          {isMobile && (
            <Button variant="ghost" size="icon" className="mr-2">
              <Search className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 relative">
                <Bell className="h-5 w-5" />
                {isLoggedIn && notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 px-1 min-w-[1.2rem] h-5">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {isLoggedIn ? (
                notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{notification.type}</span>
                        <span className="text-sm text-gray-500">{notification.message}</span>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem>No new notifications</DropdownMenuItem>
                )
              ) : (
                <DropdownMenuItem>Login to see notifications</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mr-2 md:mr-4 flex items-center bg-gray-100 rounded-full px-2 md:px-3 py-1">
            <Coins className="h-4 w-4 md:h-5 md:w-5 mr-1 text-green-500" />
            <span className="font-semibold text-sm md:text-base text-gray-800">
              {balance.toFixed(2)}
            </span>
          </div>

          {!isLoggedIn ? (
            <>
              <div className="flex flex-row gap-4">
                <Button
                  onClick={() => setAuthModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm md:text-base px-4"
                  disabled={loggingOut}
                >
                  {loggingOut ? "Logging in..." : "Login"}
                  {!loggingOut && <LogIn className="ml-1 md:ml-2 h-4 w-4 md:h-5 md:w-5" />}
                </Button>

                <Button
                  onClick={login}
                  variant="outline"
                  className="w-full px-4"
                  disabled={loggingOut || !getWeb3AuthInstance()}
                >
                  {loggingOut ? "Logging in..." : "SSO"}
                  {!loggingOut && (
                    <svg className="ml-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                </Button>
              </div>

              <AuthModal
                open={authModalOpen}
                onOpenChange={setAuthModalOpen}
                onSuccess={handleAuthSuccess}
              />
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="flex items-center">
                  <User className="h-5 w-5 mr-1" />
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  {userName || userEmail || "User"}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} disabled={loggingOut}>
                  {loggingOut ? "Signing out..." : "Sign Out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}