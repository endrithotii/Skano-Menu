"use client";

import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeedbackMenuItem {
  id: string;
  name: string;
}

interface FeedbackFormProps {
  restaurantId: string;
  menuItems?: FeedbackMenuItem[];
  className?: string;
}

interface FormState {
  rating: number;
  menuItemId: string;
  customerName: string;
  comment: string;
}

const initialState: FormState = {
  rating: 0,
  menuItemId: "",
  customerName: "",
  comment: "",
};

export function FeedbackForm({ restaurantId, menuItems = [], className }: FeedbackFormProps) {
  const [form, setForm] = React.useState<FormState>(initialState);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const menuItemOptions = menuItems.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.rating === 0) {
      setError("Please select a star rating before submitting.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        rating: form.rating,
        comment: form.comment.trim() || undefined,
        customerName: form.customerName.trim() || undefined,
        menuItemId: form.menuItemId || undefined,
      };

      const res = await fetch(`/api/restaurants/${restaurantId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Failed to submit feedback. Please try again.");
      }

      setSuccess(true);
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 py-12 px-6 text-center rounded-2xl bg-green-50 border border-green-100",
          className
        )}
      >
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Thank you for your feedback!</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            Your review helps us serve you better. We appreciate you taking the time.
          </p>
        </div>
        <button
          onClick={() => setSuccess(false)}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2 transition-colors"
        >
          Submit another review
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-6",
        className
      )}
      noValidate
    >
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Leave a Review</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Share your experience with other diners.
        </p>
      </div>

      {/* Star rating */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">
          Your Rating <span className="text-orange-500">*</span>
        </span>
        <StarRating
          rating={form.rating}
          onChange={(r) => setForm((prev) => ({ ...prev, rating: r }))}
          size="lg"
        />
        {form.rating > 0 && (
          <p className="text-xs text-gray-400">
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][form.rating]}
          </p>
        )}
      </div>

      {/* Menu item select */}
      {menuItemOptions.length > 0 && (
        <Select
          label="Reviewed Item (optional)"
          placeholder="Select a menu item..."
          options={menuItemOptions}
          value={form.menuItemId}
          onChange={(v) => setForm((prev) => ({ ...prev, menuItemId: v }))}
        />
      )}

      {/* Customer name */}
      <Input
        label="Your Name (optional)"
        placeholder="e.g. Maria K."
        value={form.customerName}
        onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
        maxLength={80}
      />

      {/* Comment */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700" htmlFor="feedback-comment">
          Your Comment (optional)
        </label>
        <textarea
          id="feedback-comment"
          rows={4}
          placeholder="Tell us what you thought about your experience..."
          value={form.comment}
          onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
          maxLength={1000}
          className={cn(
            "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400",
            "resize-none transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent",
            "hover:border-gray-300"
          )}
        />
        <p className="text-xs text-gray-400 text-right">
          {form.comment.length}/1000
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        loading={loading}
        disabled={loading}
        size="md"
        className="w-full gap-2"
      >
        <Send className="w-4 h-4" />
        Submit Review
      </Button>
    </form>
  );
}

export type { FeedbackFormProps, FeedbackMenuItem };
