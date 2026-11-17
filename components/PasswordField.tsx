"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a `type="button"` so tapping the eye can never submit the form,
 * and the glyphs are inline SVG rather than an icon package (consistent with the
 * small hand-drawn glyphs elsewhere in the app). All input props pass through,
 * so `autoComplete`, `required`, `aria-describedby` etc. keep working.
 */
export default function PasswordField({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`field-input !pr-11 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible(value => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-[18px] w-[18px]"
    >
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-[18px] w-[18px]"
    >
      <path d="m2 2 20 20" />
      <path d="M6.71 6.71A10.94 10.94 0 0 0 2.06 11.65a1 1 0 0 0 0 .7 10.75 10.75 0 0 0 13.94 5.94" />
      <path d="M10.73 5.08A10.75 10.75 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.9 10.9 0 0 1-3.2 4.6" />
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    </svg>
  );
}
