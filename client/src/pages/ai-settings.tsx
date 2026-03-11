import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Brain, Key, Server, CheckCircle2, XCircle, Loader2, Shield,
  Trash2, Pencil, Plus, Zap, Globe, Monitor, ArrowRight, ArrowLeft, Sparkles, AlertTriangle, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LlmConfig {
  id: number;
  userId: number;
  provider: string;
  apiKey: string;
  endpoint: string | null;
  model: string | null;
  isActive: boolean;
  label: string;
  createdAt: string;
  updatedAt: string | null;
}

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, o1, o3 and more",
    icon: Sparkles,
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.5-preview", "o1", "o1-mini", "o3-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    needsEndpoint: false,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — requires billing on your Anthropic account",
    icon: Brain,
    defaultModel: "claude-3-haiku-20240307",
    models: [
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku (recommended · all tiers)" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (paid tier)" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (paid tier)" },
      { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (paid tier)" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus (paid tier)" },
    ],
    needsEndpoint: true,
    defaultEndpoint: "https://api.anthropic.com/v1",
  },
  {
    id: "local",
    name: "Local / Self-Hosted",
    description: "Ollama, LM Studio, vLLM, or any OpenAI-compatible API",
    icon: Monitor,
    defaultModel: "",
    models: [],
    needsEndpoint: true,
    defaultEndpoint: "http://localhost:11434/v1",
  },
  {
    id: "other",
    name: "Other Provider",
    description: "Any OpenAI-compatible API (Together, Groq, Fireworks, etc.)",
    icon: Globe,
    defaultModel: "",
    models: [],
    needsEndpoint: true,
  },
];

export default function AISettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LlmConfig | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<number | null>(null);

  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  const { data: configs = [], isLoading: configsLoading } = useQuery<LlmConfig[]>({
    queryKey: ["/api/llm-config"],
    enabled: !!user,
  });

  const { data: activeConfig } = useQuery({
    queryKey: ["/api/llm-config/active"],
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingConfig) {
        const res = await apiRequest("PATCH", `/api/llm-config/${editingConfig.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/llm-config", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config/active"] });
      toast({ title: editingConfig ? "Configuration updated" : "Configuration saved" });
      resetWizard();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/llm-config/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config/active"] });
      setDeleteDialogId(null);
      toast({ title: "Configuration removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/llm-config/${id}`, { isActive: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config/active"] });
      toast({ title: "Configuration activated" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/llm-config/${id}`, { isActive: false });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config/active"] });
      toast({ title: "Switched to Everdice AI" });
    },
  });

  function resetWizard() {
    setShowWizard(false);
    setWizardStep(0);
    setSelectedProvider("openai");
    setApiKey("");
    setEndpoint("");
    setModel("");
    setLabel("");
    setTestResult(null);
    setEditingConfig(null);
  }

  function startEdit(config: LlmConfig) {
    setEditingConfig(config);
    setSelectedProvider(config.provider);
    setApiKey("");
    setEndpoint(config.endpoint || "");
    setModel(config.model || "");
    setLabel(config.label);
    setTestResult(null);
    setWizardStep(1);
    setShowWizard(true);
  }

  function startNew() {
    resetWizard();
    setShowWizard(true);
  }

  async function testConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/llm-config/test", {
        provider: selectedProvider,
        apiKey,
        endpoint: endpoint || undefined,
        model: model || undefined,
      });
      const result = await res.json();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Test failed" });
    } finally {
      setIsTesting(false);
    }
  }

  function handleSave() {
    const data: any = {
      provider: selectedProvider,
      label: label || providerInfo?.name || "My LLM",
      model: model || providerInfo?.defaultModel || undefined,
      endpoint: endpoint || undefined,
      isActive: true,
    };
    if (apiKey) {
      data.apiKey = apiKey;
    } else if (!editingConfig) {
      toast({ title: "API key is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate(data);
  }

  const providerInfo = PROVIDERS.find(p => p.id === selectedProvider);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const usingCustom = (activeConfig as any)?.isCustom;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">AI Configuration</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Choose how Everdice powers its AI features — use our built-in AI or connect your own service.
        </p>

        <Card className="mb-6 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Current AI Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {usingCustom ? (
                  <>
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Server className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{(activeConfig as any)?.label || "Custom AI"}</p>
                      <p className="text-sm text-muted-foreground">
                        {(activeConfig as any)?.provider} — {(activeConfig as any)?.model || "default model"}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 border-emerald-500 text-emerald-500">Custom</Badge>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Everdice AI</p>
                      <p className="text-sm text-muted-foreground">Powered by GPT-4o — no setup needed</p>
                    </div>
                    <Badge variant="outline" className="ml-2">Default</Badge>
                  </>
                )}
              </div>
              {usingCustom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const active = configs.find(c => c.isActive);
                    if (active) deactivateMutation.mutate(active.id);
                  }}
                  disabled={deactivateMutation.isPending}
                >
                  Switch to Everdice AI
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Your AI Configurations</CardTitle>
                <CardDescription>Manage your connected AI services</CardDescription>
              </div>
              <Button onClick={startNew} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {configsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="mb-1">No custom AI providers configured</p>
                <p className="text-sm">Everdice is using its built-in AI for all features.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      config.isActive ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        config.isActive ? "bg-emerald-500/10" : "bg-muted"
                      }`}>
                        {config.provider === "local" ? (
                          <Monitor className="h-4 w-4" />
                        ) : config.provider === "openai" ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <Globe className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {config.label}
                          {config.isActive && (
                            <Badge className="bg-emerald-500 text-white text-xs">Active</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {config.provider} {config.model && `— ${config.model}`}
                          <span className="ml-2 text-xs opacity-70">Key: {config.apiKey}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!config.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => activateMutation.mutate(config.id)}
                          disabled={activateMutation.isPending}
                        >
                          Activate
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => startEdit(config)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDialogId(config.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>By default, Everdice uses its own AI subscription for story generation, NPC creation, and all AI features.</li>
                  <li>You can connect your own OpenAI, Anthropic, or local LLM to power these features instead.</li>
                  <li>Your API key is stored securely and never shared. It's only used server-side for AI calls during your sessions.</li>
                  <li>You can switch between providers at any time without losing any game data.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showWizard} onOpenChange={(open) => { if (!open) resetWizard(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {editingConfig ? "Edit AI Provider" : "Connect AI Provider"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 0 && "Choose which AI service to connect"}
              {wizardStep === 1 && "Enter your credentials"}
              {wizardStep === 2 && "Test your connection"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            {[0, 1, 2].map(step => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step <= wizardStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {wizardStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <RadioGroup value={selectedProvider} onValueChange={(val) => {
                  setSelectedProvider(val);
                  const info = PROVIDERS.find(p => p.id === val);
                  if (info) {
                    setModel(info.defaultModel);
                    if (info.needsEndpoint && info.defaultEndpoint) {
                      setEndpoint(info.defaultEndpoint);
                    } else if (!info.needsEndpoint) {
                      setEndpoint("");
                    }
                  }
                }}>
                  <div className="space-y-3">
                    {PROVIDERS.map(provider => (
                      <Label
                        key={provider.id}
                        htmlFor={`provider-${provider.id}`}
                        className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedProvider === provider.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <RadioGroupItem value={provider.id} id={`provider-${provider.id}`} />
                        <provider.icon className="h-6 w-6 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-sm text-muted-foreground">{provider.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </motion.div>
            )}

            {wizardStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="label">Display Name</Label>
                  <Input
                    id="label"
                    placeholder={`My ${providerInfo?.name || "AI"}`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">A friendly name for this configuration</p>
                </div>

                <div>
                  <Label htmlFor="apiKey" className="flex items-center gap-2">
                    <Key className="h-3.5 w-3.5" />
                    API Key
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={editingConfig ? "Enter new key to update (leave blank to keep)" : "sk-..."}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Stored securely, never exposed after saving
                  </p>
                </div>

                {(providerInfo?.needsEndpoint || selectedProvider === "other") && (
                  <div>
                    <Label htmlFor="endpoint" className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5" />
                      API Endpoint
                    </Label>
                    <Input
                      id="endpoint"
                      placeholder={providerInfo?.defaultEndpoint || "https://api.example.com/v1"}
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedProvider === "local"
                        ? "Your local LLM endpoint (Ollama default: http://localhost:11434/v1)"
                        : "The base URL for the API"}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="model">Model</Label>
                  {providerInfo?.models && providerInfo.models.length > 0 ? (
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {providerInfo.models.map((m: any) => {
                          const val = typeof m === "string" ? m : m.value;
                          const label = typeof m === "string" ? m : m.label;
                          return <SelectItem key={val} value={val}>{label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="model"
                      placeholder="e.g., llama3, mixtral-8x7b, mistral"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">The model to use for AI features</p>
                </div>
              </motion.div>
            )}

            {wizardStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h4 className="font-medium mb-2">Configuration Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Provider:</span>
                      <span>{providerInfo?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Label:</span>
                      <span>{label || providerInfo?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span>{model || providerInfo?.defaultModel || "default"}</span>
                    </div>
                    {endpoint && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Endpoint:</span>
                        <span className="text-xs truncate max-w-[200px]">{endpoint}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">API Key:</span>
                      <span>{apiKey ? "Provided" : editingConfig ? "Unchanged" : "Missing"}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={testConnection}
                  disabled={isTesting || (!apiKey && !editingConfig)}
                  variant="outline"
                  className="w-full"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing connection...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{testResult.message}</AlertDescription>
                  </Alert>
                )}

                {!apiKey && !editingConfig && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Go back and enter an API key to test and save.</AlertDescription>
                  </Alert>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="flex justify-between sm:justify-between mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                if (wizardStep === 0) resetWizard();
                else setWizardStep(s => s - 1);
              }}
            >
              {wizardStep === 0 ? "Cancel" : (
                <>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </>
              )}
            </Button>
            {wizardStep < 2 ? (
              <Button onClick={() => setWizardStep(s => s + 1)}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || (!apiKey && !editingConfig)}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingConfig ? "Update" : "Save & Activate"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogId !== null} onOpenChange={(open) => { if (!open) setDeleteDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove AI Configuration?</DialogTitle>
            <DialogDescription>
              This will delete the saved configuration. If it's currently active, Everdice will switch back to its built-in AI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialogId && deleteMutation.mutate(deleteDialogId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
