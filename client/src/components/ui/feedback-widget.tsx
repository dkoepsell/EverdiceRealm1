import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, X, Send, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackWidgetProps {
  variant?: "floating" | "inline";
}

export function FeedbackWidget({ variant = "floating" }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feltConfusing, setFeltConfusing] = useState(false);
  const [feltSlow, setFeltSlow] = useState(false);
  const [wouldUse, setWouldUse] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", {
        feltConfusing,
        feltSlow,
        wouldUse,
        comment: comment.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Thanks for your feedback!", description: "Your input helps us improve." });
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setFeltConfusing(false);
        setFeltSlow(false);
        setWouldUse(false);
        setComment("");
      }, 2000);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
    },
  });

  const hasSelection = feltConfusing || feltSlow || wouldUse || comment.trim().length > 0;

  const feedbackContent = (
    <div className="space-y-4">
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="text-sm font-medium text-green-400">Thank you!</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={feltConfusing}
                onCheckedChange={(v) => setFeltConfusing(!!v)}
                className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Something felt confusing
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={feltSlow}
                onCheckedChange={(v) => setFeltSlow(!!v)}
                className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Something felt slow
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <Checkbox
                checked={wouldUse}
                onCheckedChange={(v) => setWouldUse(!!v)}
                className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                I'd use this in a real campaign
              </span>
            </label>
          </div>

          <Textarea
            placeholder="Anything else? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[60px] max-h-[120px] bg-background/50 border-border/50 text-sm resize-none"
          />

          <Button
            onClick={() => feedbackMutation.mutate()}
            disabled={!hasSelection || feedbackMutation.isPending}
            size="sm"
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
          >
            {feedbackMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send Feedback
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-amber-500" />
          <h4 className="font-semibold text-sm text-amber-100">Quick Feedback</h4>
        </div>
        {feedbackContent}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 right-0 w-72 rounded-lg border border-amber-500/20 bg-card shadow-xl shadow-black/30 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-100">Quick Feedback</h4>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {feedbackContent}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-10 w-10 rounded-full shadow-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 border-0"
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
      </Button>
    </div>
  );
}
