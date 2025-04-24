// @ts-nocheck
'use client'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { LogIn, Mail, Key, User as UserIcon, ChevronDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/hooks/use-toast"
import { createUser, getUserByEmail, verifyCredentials } from "@/utils/db/actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ROLES = [
  { value: "Reporter", label: "Reporter" },
  { value: "Collector", label: "Waste Collector" },
  { value: "Authority", label: "Municipal Authority" },
  { value: "Admin", label: "System administrator" },
]

export const AuthModal = ({
  open,
  onOpenChange,
  onSuccess
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: { email: string, name: string, role: string }) => void
}) => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('Reporter')
  const [isLoading, setIsLoading] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const user = await verifyCredentials(email, password)

      if (!user) {
        throw new Error('Invalid email or password')
      }

      setLoggedIn(true);
      setUserInfo(user);
      localStorage.setItem('userEmail', user.email);
      localStorage.setItem('isLoggedIn', 'true');

      onSuccess(user)
      toast({
        title: "Success",
        description: "Login successful",
        variant: "default",
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Login failed",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        throw new Error('This email is already registered')
      }

      const user = await createUser(email, name, password, role)

      toast({
        title: "Success",
        description: "Account created. Please login.",
        variant: "default",
      })
      setActiveTab('login')
      setPassword('')
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-center">Welcome to Trash2Token</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10"
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleManualRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Password (min 6 characters)</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10"
                    minLength={6}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={role}
                  onValueChange={setRole}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {role === 'Authority' && 'For municipal/government officials'}
                  {role === 'Collector' && 'For waste collection professionals'}
                  {role === 'Reporter' && 'For community members reporting waste'}
                  {role === 'Admin' && 'System Administrator'}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Register"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}