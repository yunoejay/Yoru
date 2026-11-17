"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { profileDisplayName, type PublicProfile } from "@/lib/profile";
import { notifyAuthChanged } from "@/components/useSessionUser";

interface ProfileStats {
  library: number;
  chaptersRead: number;
  seriesTracked: number;
}

interface ProfileForm {
  username: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
}

const MAX_UPLOAD_BYTES = { avatar: 2 * 1024 * 1024, banner: 3 * 1024 * 1024 };
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function formFromProfile(profile: PublicProfile): ProfileForm {
  return {
    username: profile.name ?? "",
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    location: profile.location ?? "",
    website: profile.website ?? "",
  };
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    username: "",
    displayName: "",
    bio: "",
    location: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/profile", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!res.ok) throw new Error("Could not load your profile.");
        return res.json();
      })
      .then((data) => {
        if (!active || !data) return;
        setProfile(data.user);
        setStats(data.stats ?? null);
        setForm(formFromProfile(data.user));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Profile update failed.");
        return;
      }
      setProfile(data.user);
      setForm(formFromProfile(data.user));
      setMessage("Profile saved.");
      // The Navbar shows the avatar/display name; refresh it in place.
      notifyAuthChanged();
    } catch {
      setError("Network error while saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(kind: "avatar" | "banner", file: File) {
    setMessage("");
    setError("");
    setUploading(kind);
    try {
      const body = new FormData();
      body.append("kind", kind);
      body.append("file", file);

      const res = await fetch("/api/auth/profile/image", { method: "POST", body });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not upload that image.");
        return;
      }
      setProfile(data.user);
      setMessage(kind === "avatar" ? "Profile picture updated." : "Banner updated.");
      notifyAuthChanged();
    } catch {
      setError("Network error while uploading.");
    } finally {
      setUploading(null);
    }
  }

  function handleFilePicked(kind: "avatar" | "banner", file: File | null) {
    setError("");
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES[kind]) {
      setError(
        `${kind === "avatar" ? "Profile picture" : "Banner"} must be ${
          MAX_UPLOAD_BYTES[kind] / (1024 * 1024)
        } MB or smaller.`,
      );
      return;
    }
    void uploadImage(kind, file);
  }

  async function removeImage(kind: "avatar" | "banner") {
    setMessage("");
    setError("");
    setUploading(kind);
    try {
      const res = await fetch(`/api/auth/profile/image?kind=${kind}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not remove that image.");
        return;
      }
      setProfile(data.user);
      setMessage(kind === "avatar" ? "Profile picture removed." : "Banner removed.");
      notifyAuthChanged();
    } catch {
      setError("Network error while removing the image.");
    } finally {
      setUploading(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    notifyAuthChanged();
    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-52 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
        <div className="skeleton h-72 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="info-card mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {error || "Redirecting to login…"}
        </p>
        {error ? (
          <Link href="/login" className="btn-primary">
            Go to login
          </Link>
        ) : null}
      </div>
    );
  }

  const displayName = profileDisplayName(profile);
  const initials = displayName.slice(0, 1).toUpperCase();
  const busy = saving || uploading !== null;

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => {
          handleFilePicked("avatar", event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => {
          handleFilePicked("banner", event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      <div className="mx-auto max-w-4xl space-y-6 pb-10">
        {/* Banner + avatar hero */}
        <section className="hero-panel overflow-hidden">
          <div className="relative h-40 w-full sm:h-56">
            {profile.bannerUrl ? (
              <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.55),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.45),transparent_50%)]"
                aria-hidden
              />
            )}
            <div
              className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent"
              aria-hidden
            />
            <div className="absolute right-3 top-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={busy}
                className="rounded-full border border-white/30 bg-slate-950/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-slate-950/70 disabled:opacity-60"
              >
                {uploading === "banner" ? "Uploading…" : profile.bannerUrl ? "Change banner" : "Add banner"}
              </button>
              {profile.bannerUrl ? (
                <button
                  type="button"
                  onClick={() => void removeImage("banner")}
                  disabled={busy}
                  className="rounded-full border border-white/30 bg-slate-950/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-red-500/70 disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-wrap items-end gap-5 sm:-mt-16">
              <div>
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={`${displayName}'s profile picture`}
                    className="h-28 w-28 rounded-[1.75rem] border-4 border-white object-cover shadow-xl dark:border-slate-950"
                  />
                ) : (
                  <span className="flex h-28 w-28 items-center justify-center rounded-[1.75rem] border-4 border-white bg-gradient-to-br from-brand to-brand-accent text-3xl font-bold text-white shadow-xl dark:border-slate-950">
                    {initials}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-semibold text-slate-900 dark:text-white">
                    {displayName}
                  </h1>
                  <span
                    className={`chip ${
                      profile.verified
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                    }`}
                  >
                    {profile.verified ? "Verified" : "Unverified"}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                  {profile.name ? `@${profile.name}` : profile.email}
                  {profile.name && profile.email ? ` · ${profile.email}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Member since {memberSince(profile.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={busy}
                  className="btn-ghost !px-3 !py-1.5 text-xs"
                >
                  {profile.avatarUrl ? "Change picture" : "Add picture"}
                </button>
                {profile.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => void removeImage("avatar")}
                    disabled={busy}
                    className="btn-danger !px-3 !py-1.5 text-xs"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            {profile.bio ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-slate-500 dark:text-slate-400">
                No bio yet — tell readers a little about yourself.
              </p>
            )}

            {profile.location || profile.website ? (
              <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {profile.location ? <span>📍 {profile.location}</span> : null}
                {profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand hover:underline dark:text-brand-accent"
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        </section>

        {error ? <p className="alert alert-error">{error}</p> : null}
        {message ? <p className="alert alert-success">{message}</p> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Chapters read" value={stats?.chaptersRead ?? 0} />
          <Stat label="Series tracked" value={stats?.seriesTracked ?? 0} />
          <Stat label="Bookmarks" value={stats?.library ?? 0} />
        </div>

        <div className="card-surface border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-950/60">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile details</h2>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              This is what shows on your profile and in the navbar. Everything except your email is editable.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="account-username" className="field-label">Username</label>
                <input
                  id="account-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={event => setForm(prev => ({ ...prev, username: event.target.value }))}
                  placeholder="your_handle"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]{3,30}"
                  title="3–30 characters: letters, numbers, and underscores only"
                  className="field-input"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Your unique handle, shown as @{form.username || "handle"}.
                </p>
              </div>
              <div>
                <label htmlFor="account-display-name" className="field-label">Display name</label>
                <input
                  id="account-display-name"
                  type="text"
                  value={form.displayName}
                  onChange={event => setForm(prev => ({ ...prev, displayName: event.target.value }))}
                  placeholder="Demo Reader"
                  maxLength={60}
                  className="field-input"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  The name people see. {form.displayName.length}/60
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="account-email" className="field-label">Email</label>
              <input
                id="account-email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                className="field-input opacity-70"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Changing your email needs a fresh verification and is not available here yet.
              </p>
            </div>

            <div>
              <label htmlFor="account-bio" className="field-label">Bio</label>
              <textarea
                id="account-bio"
                value={form.bio}
                onChange={event => setForm(prev => ({ ...prev, bio: event.target.value }))}
                placeholder="What do you read? Any favourites?"
                rows={3}
                maxLength={280}
                className="field-input resize-y"
              />
              <p className="mt-1 text-right text-[11px] text-slate-500 dark:text-slate-400">
                {form.bio.length}/280
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="account-location" className="field-label">Location</label>
                <input
                  id="account-location"
                  type="text"
                  value={form.location}
                  onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))}
                  placeholder="Seoul, KR"
                  maxLength={80}
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="account-website" className="field-label">Website</label>
                <input
                  id="account-website"
                  type="text"
                  inputMode="url"
                  value={form.website}
                  onChange={event => setForm(prev => ({ ...prev, website: event.target.value }))}
                  placeholder="https://example.com"
                  maxLength={200}
                  className="field-input"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Bare domains get https:// automatically.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="submit" disabled={busy} className="btn-primary">
                {saving ? "Saving…" : "Save changes"}
              </button>
              <Link href="/library" className="btn-ghost">Browse library</Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="btn-danger ml-auto"
              >
                Log out
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
