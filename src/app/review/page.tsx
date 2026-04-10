"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

type ReviewTask = {
  id: string;
  topic_id: string;
  topic_title: string;
  category: string | null;
  mastery: number;
  status: string;
  repetitions: number;
};

export default function ReviewPage() {
  const [dueTopics, setDueTopics] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/daily-tasks");
      const data = await res.json();
      const reviewTasks = (data.tasks || []).filter((t: { type: string }) => t.type === "review");
      setDueTopics(reviewTasks);
      setLoading(false);
    }
    load();
  }, []);

  async function generateReport(period: "weekly" | "monthly") {
    setGenerating(true);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    const data = await res.json();
    setReport(data.report);
    setGenerating(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground">Topics due for review based on spaced repetition</p>
      </div>

      {/* Due for review */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Due Today</CardTitle>
            <Badge variant="secondary">{dueTopics.length} topics</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {dueTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reviews due today. Great job staying on top of things!
            </p>
          ) : (
            <div className="space-y-2">
              {dueTopics.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {task.mastery}%
                    </div>
                    <div>
                      <div className="font-medium">{task.topic_title}</div>
                      <div className="text-xs text-muted-foreground">
                        {task.category} · Rep #{(task.repetitions || 0) + 1}
                      </div>
                    </div>
                  </div>
                  <Link href={`/study/${task.topic_id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Learning Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              onClick={() => generateReport("weekly")}
              disabled={generating}
              variant="outline"
              size="sm"
            >
              {generating ? "Generating..." : "Weekly Review"}
            </Button>
            <Button
              onClick={() => generateReport("monthly")}
              disabled={generating}
              variant="outline"
              size="sm"
            >
              Monthly Review
            </Button>
          </div>
          {report && (
            <div className="mt-4 p-4 rounded-lg bg-muted text-sm whitespace-pre-wrap">
              {report}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
