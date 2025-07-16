"use client";

import type { Account } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, UserPlus, UserCheck, UserX } from 'lucide-react';

interface ProgressDashboardProps {
  accounts: Account[];
  totalSignups: number;
}

export function ProgressDashboard({ accounts, totalSignups }: ProgressDashboardProps) {
  if (totalSignups === 0) return null;

  const createdCount = accounts.filter(a => ['created', 'verified'].includes(a.status)).length;
  const verifiedCount = accounts.filter(a => a.status === 'verified').length;
  const failedCount = accounts.filter(a => a.status === 'failed').length;
  const attemptedCount = accounts.filter(a => a.status !== 'pending').length;

  const totalProgress = totalSignups > 0 ? (attemptedCount / totalSignups) * 100 : 0;
  const createdProgress = totalSignups > 0 ? (createdCount / totalSignups) * 100 : 0;
  const verifiedProgress = createdCount > 0 ? (verifiedCount / createdCount) * 100 : 0;

  const metrics = [
    { title: 'Overall Progress', count: attemptedCount, progress: totalProgress, Icon: Users, description: `${attemptedCount} of ${totalSignups} attempts made`},
    { title: 'Accounts Created', count: createdCount, progress: createdProgress, Icon: UserPlus, description: `${createdCount} of ${totalSignups} successful creations`},
    { title: 'Accounts Verified', count: verifiedCount, progress: verifiedProgress, Icon: UserCheck, description: `${verifiedCount} of ${createdCount} created accounts verified`},
    { title: 'Failures', count: failedCount, progress: totalSignups > 0 ? (failedCount/totalSignups) * 100 : 0, Icon: UserX, description: `${failedCount} of ${totalSignups} attempts failed` }
  ];
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.count}</div>
            <p className="text-xs text-muted-foreground">
              {metric.description}
            </p>
            <Progress value={metric.progress} className={`mt-4 ${metric.title === 'Failures' ? '[&>div]:bg-destructive' : ''}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
