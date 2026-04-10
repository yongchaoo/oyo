"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

type Topic = {
  id: string;
  title: string;
  category: string | null;
  content: string | null;
  difficulty: number;
  priority: number;
  mastery: number;
  status: string;
  next_review: string | null;
};

type PlanDetail = {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  topics: Topic[];
  stats: {
    total: number;
    mastered: number;
    reviewing: number;
    learning: number;
    new_count: number;
    avg_mastery: number;
  };
};

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPlan() {
    const res = await fetch(`/api/plans/${id}`);
    if (res.ok) setPlan(await res.json());
    setLoading(false);
  }

  useEffect(() => { loadPlan(); }, [id]);

  async function handleDeleteTopic(topicId: string) {
    await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
    await loadPlan();
  }

  async function handleMarkMastered(topicId: string) {
    await fetch(`/api/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "mastered", mastery: 100 }),
    });
    await loadPlan();
  }

  async function handleResetTopic(topicId: string) {
    await fetch(`/api/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "new", mastery: 0 }),
    });
    await loadPlan();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (!plan) {
    return <div className="text-center text-muted-foreground">Plan not found</div>;
  }

  const categories = plan.topics.reduce<Record<string, Topic[]>>((acc, t) => {
    const cat = t.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const avgMastery = Math.round(plan.stats?.avg_mastery || 0);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          {plan.description && (
            <p className="text-muted-foreground mt-1">{plan.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      {plan.stats && plan.stats.total > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-xl font-bold">{plan.stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-xl font-bold text-green-500">{plan.stats.mastered}</div>
              <div className="text-xs text-muted-foreground">Mastered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-xl font-bold text-blue-500">{plan.stats.reviewing}</div>
              <div className="text-xs text-muted-foreground">Reviewing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-xl font-bold text-yellow-500">{plan.stats.learning}</div>
              <div className="text-xs text-muted-foreground">Learning</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-xl font-bold">{avgMastery}%</div>
              <div className="text-xs text-muted-foreground">Avg Mastery</div>
              <Progress value={avgMastery} className="mt-1 h-1" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Topics by category */}
      {Object.entries(categories).map(([category, topics]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {category}
              <Badge variant="secondary">{topics.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="flex items-center justify-between p-3 rounded-lg border group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <MasteryDot mastery={topic.mastery} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{topic.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {topic.mastery}%
                  </Badge>
                  <StatusBadge status={topic.status} />
                  {topic.status === "new" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs opacity-0 group-hover:opacity-100"
                      onClick={() => handleMarkMastered(topic.id)}
                    >
                      Already know
                    </Button>
                  )}
                  {topic.status === "mastered" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs opacity-0 group-hover:opacity-100"
                      onClick={() => handleResetTopic(topic.id)}
                    >
                      Reset
                    </Button>
                  )}
                  <Link href={`/study/${topic.id}`}>
                    <Button size="sm" variant={topic.status === "new" ? "default" : "outline"}>
                      Study
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteTopic(topic.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {plan.topics.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              Add markdown files to topics/{plan.title}/ then click &quot;Sync from Files&quot; on the plans page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MasteryDot({ mastery }: { mastery: number }) {
  let color = "bg-gray-400";
  if (mastery >= 90) color = "bg-green-500";
  else if (mastery >= 60) color = "bg-blue-500";
  else if (mastery >= 30) color = "bg-yellow-500";
  else if (mastery > 0) color = "bg-orange-500";

  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    new: "outline",
    learning: "secondary",
    reviewing: "default",
    mastered: "default",
  };
  return (
    <Badge variant={variants[status] || "outline"} className={status === "mastered" ? "bg-green-600" : ""}>
      {status}
    </Badge>
  );
}
