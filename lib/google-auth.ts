import type { User } from "@supabase/supabase-js";

function getRequiredEmail(user: User) {
  if (!user.email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  return user.email;
}

export function resolveGoogleUserName(user: User) {
  const fullName = user.user_metadata.full_name;
  const displayName = user.user_metadata.name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return null;
}

export function resolveGoogleUserAvatarUrl(user: User) {
  const avatarUrl = user.user_metadata.avatar_url;
  const picture = user.user_metadata.picture;

  if (typeof avatarUrl === "string" && avatarUrl.trim()) {
    return avatarUrl.trim();
  }

  if (typeof picture === "string" && picture.trim()) {
    return picture.trim();
  }

  return null;
}

export function buildAppUserRecord(user: User) {
  return {
    id: user.id,
    email: getRequiredEmail(user),
    full_name: resolveGoogleUserName(user),
    profile_photo_url: resolveGoogleUserAvatarUrl(user)
  };
}

export function buildGoogleProfileRecord(user: User) {
  return {
    user_id: user.id,
    name: resolveGoogleUserName(user),
    email: getRequiredEmail(user),
    avatar_url: resolveGoogleUserAvatarUrl(user)
  };
}
