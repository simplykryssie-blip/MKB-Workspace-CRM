import type { Metadata } from "next";
import { Activity } from "@/components/dashboard/Activity";
import { Appointments } from "@/components/dashboard/Appointments";
import { Greeting } from "@/components/dashboard/Greeting";
import { Invoices } from "@/components/dashboard/Invoices";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { ServiceDonut } from "@/components/dashboard/ServiceDonut";
import { StatCards } from "@/components/dashboard/StatCards";
import { Tasks } from "@/components/dashboard/Tasks";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  // With the backend on, only real numbers are shown (the sample widgets are design mock-ups).
  if (process.env.NEXT_PUBLIC_BACKEND === "1") return <LiveDashboard />;
  return (
    <div className="space-y-5 lg:space-y-6">
      <Greeting />
      <StatCards />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <RevenueChart />
        <ServiceDonut />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-2">
        <Appointments />
        <Tasks />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-2">
        <Activity />
        <Invoices />
      </div>
    </div>
  );
}
