import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";

// Form schemas
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [location, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
    },
  });
  
  // Track if this is a new registration (to redirect to Hearth)
  const isNewRegistration = registerMutation.isSuccess;
  
  // If user is already logged in, redirect appropriately
  // New users go to Hearth for onboarding, returning users go to dashboard
  useEffect(() => {
    if (user) {
      if (isNewRegistration) {
        // New users get directed to the guided first-run funnel
        navigate("/begin");
      } else {
        // Returning users go to their dashboard
        navigate("/");
      }
    }
  }, [user, navigate, isNewRegistration]);
  
  // If the user is logged in, don't render the auth page
  if (user) {
    return null;
  }

  // Handle login form submission
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  // Handle register form submission
  const onRegisterSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Left column with form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border-primary/10">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              {activeTab === "login" ? "Welcome Back" : "Join the Adventure"}
            </CardTitle>
            <CardDescription className="text-center">
              {activeTab === "login" 
                ? "Sign in to continue your journey" 
                : "Create your account and start playing in minutes"
              }
            </CardDescription>
          </CardHeader>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                  <CardContent className="space-y-4 pt-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter your username" 
                              {...field} 
                              disabled={loginMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="••••••••" 
                              {...field} 
                              disabled={loginMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  
                  <CardFooter className="flex justify-center">
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
            
            {/* Register Form */}
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <CardContent className="space-y-4 pt-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Choose a username" 
                              {...field} 
                              disabled={registerMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Create a password" 
                              {...field} 
                              disabled={registerMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm your password"
                              {...field}
                              disabled={registerMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="For the occasional gentle reminder — never shared"
                              {...field}
                              disabled={registerMutation.isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  
                  <CardFooter className="flex justify-center">
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      
      {/* Right column with hero content */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent"></div>
        </div>
        <div className="max-w-lg text-center text-white relative z-10">
          <div className="mb-6">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 mx-auto text-amber-400 mb-4"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 2V22M12 2L19 19.5M12 2L5 19.5M2 12H22M6 7H18M6 17H18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            Beginner-Friendly. DM-Respectful.
          </h1>
          <p className="text-base mb-8 text-white/80 leading-relaxed max-w-md mx-auto">
            Everdice makes it easy for anyone to start playing D&D while giving Dungeon Masters 
            the structure they need for meaningful campaigns.
          </p>
          <div className="space-y-3 text-left">
            <div className="flex items-center bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                <span className="text-amber-400 text-sm font-medium">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 text-sm">Simple to Learn</h3>
                <p className="text-xs text-white/60">Start playing in minutes, no pressure</p>
              </div>
            </div>
            <div className="flex items-center bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                <span className="text-amber-400 text-sm font-medium">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 text-sm">Campaigns That Remember</h3>
                <p className="text-xs text-white/60">Pick up right where you left off</p>
              </div>
            </div>
            <div className="flex items-center bg-white/5 rounded-lg p-4 backdrop-blur-sm border border-white/5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center mr-4 flex-shrink-0">
                <span className="text-amber-400 text-sm font-medium">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-amber-300 text-sm">Safe for Families</h3>
                <p className="text-xs text-white/60">No ads, designed for all ages</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-6 italic">
            For experienced tables: Everdice stays out of your way and keeps long campaigns coherent.
          </p>
        </div>
      </div>
    </div>
  );
}