"use client";
import { useState, useEffect } from "react";
import { User, Mail, Save } from "lucide-react";
import { getUserByEmail, updateUserDetails } from "@/utils/db/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

type UserSettings = {
  name: string;
  email: string;
};

const DEFAULT_SETTINGS: UserSettings = {
  name: "No name provided",
  email: "No email provided",
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  usePageTitle("Profile");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userEmail = localStorage.getItem("userEmail");
        console.log("userEmail", userEmail);
        if (!userEmail) {
          setError("No user email found");
          return;
        }

        const user = await getUserByEmail(userEmail);
        if (user) {
          setSettings({
            name: user.name ?? DEFAULT_SETTINGS.name,
            email: user.email ?? DEFAULT_SETTINGS.email,
          });
          setUserId(user.id);
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
    e.preventDefault();
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
        settings.email
      );

      if (updatedUser) {
        localStorage.setItem("userInfo", JSON.stringify(settings));
        toast({
          title: "Success",
          description: "Settings updated successfully!",
        });
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold mb-6 text-gray-800">
        Profile
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {[
          { field: "name", icon: User, label: "Full Name", type: "text" },
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
                required
              />
              <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
        ))}

        <Button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white"
          disabled={isSubmitting}
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