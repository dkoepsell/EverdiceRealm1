import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, X, Send, CheckCircle2, Star, Bug, Lightbulb, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackWidgetProps {
  variant?: "floating" | "inline";
}

type FeedbackCategory = "bug" | "idea" | "praise";

const CATEGORIES: { value: FeedbackCategory; label: string; icon: typeof Bug }[] = [
  { value: "bug", label: "Bug", icon: Bug },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "praise", label: "Praise", icon: Heart },
];

export function FeedbackWidget({ variant = "floating" }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [feltConfusing, setFeltConfusing] = useState(false);
  const [feltSlow, setFeltSlow] = useState(false);
  const [wouldUse, setWouldUse] = useState(false);
  const [comment, setComment] = useState("");
  const [showFlags, setShowFlags] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setRating(0);
    setHoverRating(0);
    setCategory(null);
    setFeltConfusing(false);
    setFeltSlow(false);
    setWouldUse(false);
    setComment("");
    setShowFlags(false);
  };

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", {
        rating: rating || null,
        category,
        feltConfusing,
        feltSlow,
        wouldUse,
        comment: comment.trim() || null,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Thanks for your feedback!", description: "Your input helps us improve." });
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        resetForm();
      }, 2000);
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
    },
  });

  const hasInput =
    rating > 0 || category !== null || feltConfusing || feltSlow || wouldUse || comment.trim().length > 0;

  const feedbackContent = (
    <div className="space-y-4">
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <p className="text-sm font-medium text-green-400">Thank you!</p>
        </div>
      ) : (
        <>
          {/* Star rating */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-amber-100">How was your session?</p>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star === rating ? 0 : star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="flex gap-2">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(category === value ? null : value)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  category === value
                    ? "border-amber-500 bg-amber-500/20 text-amber-100"
                    : "border-border/50 text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Free-text */}
          <Textarea
            placeholder="Tell us what stood out — or what got in the way..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[70px] max-h-[140px] bg-background/50 border-border/50 text-sm resize-none"
          />

          {/* Secondary quick flags */}
          <div>
            <button
              type="button"
              onClick={() => setShowFlags((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFlags ? "− Hide quick flags" : "+ Add quick flags"}
            </button>
            {showFlags && (
              <div className="space-y-3 pt-3">
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
            )}
          </div>

          <Button
            onClick={() => feedbackMutation.mutate()}
            disabled={!hasInput || feedbackMutation.isPending}
            size="sm"
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border-0"
          >
            {feedbackMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
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
          <h4 className="font-semibold text-sm text-amber-100">Share Feedback</h4>
        </div>
        {feedbackContent}
      </div>
    );
  }

  return (
    <div className="fixed bottom-16 left-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 left-0 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-amber-500/20 bg-card shadow-xl shadow-black/30 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-amber-500" />
                <h4 className="font-semibold text-sm text-amber-100">Share Feedback</h4>
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
