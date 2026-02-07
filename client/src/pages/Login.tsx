import { useState } from "react";
import { useAuth } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import companyLogo from "@/pages/logo.jpg";

export default function Login() {
  const { login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);

  // show / hide password states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password modal state
  const [openForgot, setOpenForgot] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmployeeCode, setResetEmployeeCode] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeCode) {
      alert("Please enter your employee code");
      return;
    }

    setIsLoading(true);
    login(employeeCode, password).catch((err) => {
      alert("Login failed");
      setIsLoading(false);
    });
  };

  const handlePasswordReset = () => {
    if (!resetEmployeeCode || !newPassword || !confirmPassword) {
      alert("Please fill all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setResetLoading(true);
    setTimeout(() => {
      alert("Password updated successfully");
      setResetLoading(false);
      setOpenForgot(false);
      setResetEmployeeCode("");
      setNewPassword("");
      setConfirmPassword("");
    }, 1000);
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      {/* LEFT SIDE */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-20 xl:px-32 bg-background">
        <div className="mb-8 lg:hidden">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              K
            </div>
            Knockturn
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h1 className="mb-2 font-display text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground">
              Enter your credentials to access your workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee Code</Label>
              <Input
                type="text"
                placeholder="Enter employee code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <button
                  type="button"
                  onClick={() => setOpenForgot(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Password with Eye Icon */}
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none"
              >
                Remember me
              </label>
            </div>

            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="hidden w-1/2 bg-sidebar lg:flex flex-col justify-between p-12 text-white relative overflow-hidden">
        {/* background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-purple-500/30 opacity-20" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

        {/* company logo */}
        <div className="relative z-10 flex justify-center">
          <img
            src={companyLogo}
            alt="Company Logo"
            className="h-20 object-contain"
          />
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      <Dialog open={openForgot} onOpenChange={setOpenForgot}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Password</DialogTitle>
            <DialogDescription>
              Enter your employee code and choose a new password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee Code</Label>
              <Input
                type="text"
                value={resetEmployeeCode}
                onChange={(e) => setResetEmployeeCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForgot(false)}>
              Cancel
            </Button>
            <Button disabled={resetLoading} onClick={handlePasswordReset}>
              {resetLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
