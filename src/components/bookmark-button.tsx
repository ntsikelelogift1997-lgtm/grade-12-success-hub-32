import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  questionId,
  userId,
  className,
}: {
  questionId: string;
  userId: string;
  className?: string;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("question_bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("question_id", questionId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setBookmarked(!!data);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [questionId, userId]);

  const toggle = useCallback(async () => {
    if (pending) return;
    setPending(true);
    const next = !bookmarked;
    setBookmarked(next); // optimistic
    if (next) {
      const { error } = await supabase
        .from("question_bookmarks")
        .insert({ user_id: userId, question_id: questionId });
      if (error && error.code !== "23505") setBookmarked(false);
    } else {
      const { error } = await supabase
        .from("question_bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("question_id", questionId);
      if (error) setBookmarked(true);
    }
    setPending(false);
  }, [bookmarked, pending, questionId, userId]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark question"}
      className={cn("gap-1.5", className)}
    >
      <Star className={cn("h-4 w-4", bookmarked && "fill-amber-400 text-amber-500")} />
      <span className="text-xs">{bookmarked ? "Bookmarked" : "Bookmark"}</span>
    </Button>
  );
}
