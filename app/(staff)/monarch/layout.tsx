import { MonarchProvider } from "@/lib/store/monarch-store";

/** Monarch Tax Suite — the service bureau workspace, inside the same app and sign-in. */
export default function MonarchLayout({ children }: { children: React.ReactNode }) {
  return <MonarchProvider>{children}</MonarchProvider>;
}
