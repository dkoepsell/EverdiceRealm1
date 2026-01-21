import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Shield, Key, Smartphone, Loader2, Check, X, Calendar, Mail, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaSetupData, setTwoFaSetupData] = useState<{ qrCode: string } | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; email?: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/user/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to change password", description: error.message, variant: "destructive" });
    }
  });

  const setup2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user/2fa/setup", {});
      return res.json();
    },
    onSuccess: (data) => {
      setTwoFaSetupData({ qrCode: data.qrCode });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to setup 2FA", description: error.message, variant: "destructive" });
    }
  });

  const enable2FAMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/user/2fa/enable", { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setTwoFaSetupData(null);
      setTwoFaCode("");
      toast({ title: "2FA enabled successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to enable 2FA", description: error.message, variant: "destructive" });
    }
  });

  const disable2FAMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/user/2fa/disable", { password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setShowDisableDialog(false);
      setDisablePassword("");
      toast({ title: "2FA disabled successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to disable 2FA", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleUpdateProfile = () => {
    updateProfileMutation.mutate({
      displayName: displayName || undefined,
      email: email || undefined
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleEnable2FA = () => {
    enable2FAMutation.mutate(twoFaCode);
  };

  const handleDisable2FA = () => {
    disable2FAMutation.mutate(disablePassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold flex items-center gap-3 bg-gradient-to-r from-primary via-amber-500 to-orange-500 bg-clip-text text-transparent">
            <UserCircle className="h-10 w-10 text-primary" />
            Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">Manage your account settings and security</p>
        </motion.div>

        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </CardTitle>
                <CardDescription>Your basic account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground text-xs">Username</Label>
                    <p className="font-medium">{user.username}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Member Since</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Display Name</Label>
                    <p className="font-medium">{user.displayName || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {user.email || "-"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Update Profile</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        placeholder={user.displayName || "Enter display name"}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={user.email || "Enter email"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending || (!displayName && !email)}
                  >
                    {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <X className="h-4 w-4" /> Passwords don't match
                  </p>
                )}
                {newPassword && confirmPassword && newPassword === confirmPassword && (
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <Check className="h-4 w-4" /> Passwords match
                  </p>
                )}
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    changePasswordMutation.isPending ||
                    !currentPassword ||
                    !newPassword ||
                    newPassword !== confirmPassword
                  }
                >
                  {changePasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className={`h-8 w-8 ${user.twoFactorEnabled ? "text-green-500" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        {user.twoFactorEnabled
                          ? "Your account is protected with 2FA"
                          : "Protect your account with an authenticator app"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={user.twoFactorEnabled ? "default" : "secondary"}>
                    {user.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {!user.twoFactorEnabled && !twoFaSetupData && (
                  <Button onClick={() => setup2FAMutation.mutate()} disabled={setup2FAMutation.isPending}>
                    {setup2FAMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Setup 2FA
                  </Button>
                )}

                {twoFaSetupData && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="text-center">
                      <p className="font-medium mb-2">Scan this QR code with your authenticator app</p>
                      <img
                        src={twoFaSetupData.qrCode}
                        alt="2FA QR Code"
                        className="mx-auto rounded-lg border"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Or enter this secret manually: <code className="bg-muted px-1 rounded">{twoFaSetupData.secret}</code>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twoFaCode">Enter verification code from your app</Label>
                      <div className="flex gap-2">
                        <Input
                          id="twoFaCode"
                          placeholder="000000"
                          value={twoFaCode}
                          onChange={(e) => setTwoFaCode(e.target.value)}
                          maxLength={6}
                        />
                        <Button onClick={handleEnable2FA} disabled={enable2FAMutation.isPending || twoFaCode.length !== 6}>
                          {enable2FAMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Verify & Enable
                        </Button>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setTwoFaSetupData(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {user.twoFactorEnabled && (
                  <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive">Disable 2FA</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                        <DialogDescription>
                          Enter your password to confirm disabling 2FA. This will make your account less secure.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="disablePassword">Password</Label>
                          <Input
                            id="disablePassword"
                            type="password"
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleDisable2FA}
                            disabled={disable2FAMutation.isPending || !disablePassword}
                          >
                            {disable2FAMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Disable 2FA
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
