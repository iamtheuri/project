export const isLoggedIn = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("userEmail");
};
