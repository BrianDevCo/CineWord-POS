"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const emp = getSession();
    if (!emp) { router.push("/"); return; }
    if (emp.cargo !== "admin" && emp.cargo !== "supervisor") {
      router.push("/pos");
    }
  }, [router]);

  return <>{children}</>;
}
