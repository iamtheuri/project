// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { User, Mail, Save } from "lucide-react";
import { getUserByEmail, updateUserDetails } from "@/utils/db/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

type UserSettings = {
  name: string;
  role: string;
  email: string;
};

const DEFAULT_SETTINGS: UserSettings = {
  name: "No name provided",
  role: "None",
  email: "No email provided",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  usePageTitle("Profile");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        console.log("userEmail", userEmail);
        if (!userEmail) {
          setError("User email not found in local storage");
          return;
        }

        const user = await getUserByEmail(userEmail);
        console.log("user", user);
        if (user) {
          setSettings({
            name: user.name ?? DEFAULT_SETTINGS.name,
            role: user.role ?? DEFAULT_SETTINGS.role,
            email: user.email ?? DEFAULT_SETTINGS.email,
          });
          setUserId(user.id);
          setIsAdmin(user.role === "Admin");
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        setError("Failed to load user settings");
        toast({
          title: "Error",
          description: "Failed to load user settings",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    // e.preventDefault();
    if (!userId) {
      toast({
        title: "Error",
        description: "User ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateUserDetails(
        userId,
        settings.name,
        settings.role,
        settings.email
      );

      if (updatedUser) {
        localStorage.setItem("userInfo", JSON.stringify(settings));
        toast({
          title: "Success",
          description: "Profile updated successfully!",
        });
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return (
    // <div className="p-8 text-center text-red-500">
    //   {error}
    // </div>
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium text-gray-800 flex items-center">
            Login to view more
          </h2>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Profile
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {[
          { field: "name", icon: User, label: "Full Name", type: "text" },
          { field: "role", icon: User, label: "Role", type: "text" },
          { field: "email", icon: Mail, label: "Email Address", type: "email" }
        ].map(({ field, icon: Icon, label, type }) => (
          <div key={field}>
            <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <div className="relative">
              <input
                type={type}
                id={field}
                name={field}
                value={settings[field as keyof UserSettings]}
                onChange={handleInputChange}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                disabled={!isAdmin}
                required
              />
              <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
        ))}

        <Button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white"
          disabled={isSubmitting || !isAdmin}
        >
          {isSubmitting ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}