"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Plan = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  created_at: string;
};

export default function PlanListPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function loadPlans() {
    const res = await fetch("/api/plans");
    setPlans(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function handleSync() {
    setSyncing(true);
    const res = await fetch("/api/sync", { method: "POST" });
    if (res.ok) await loadPlans();
    setSyncing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Study Plans</h1>
          <p className="text-muted-foreground">
            Add markdown files to topics/ folder, then sync
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync from Files"}
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              No plans yet. Add folders to topics/ and click &quot;Sync from
              Files&quot;.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/plan/${plan.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer mb-3">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.title}</CardTitle>
                    <Badge
                      variant={
                        plan.status === "active" ? "default" : "secondary"
                      }
                    >
                      {plan.status}
                    </Badge>
                  </div>
                </CardHeader>
                {plan.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
