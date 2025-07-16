"use client";

import type { Account } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle2, XCircle, LogIn, Wrench, FileText, Mail, Send, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import * as React from 'react';

interface AccountListProps {
  accounts: Account[];
  onTroubleshoot: (errorLog: string) => void;
}

export function AccountList({ accounts, onTroubleshoot }: AccountListProps) {
  const { toast } = useToast();

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
            <FileText className="h-12 w-12 mb-4" />
            <p>No accounts to display.</p>
            <p className="text-sm">Start a new process to see accounts here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleLoginClick = async (account: Account) => {
    try {
      // Fetch fresh login details from the backend
      const response = await fetch(`/api/account/${account.id}/login-details`);
      if (!response.ok) {
        throw new Error("Could not fetch login details. The account might not be fully verified.");
      }
      const loginDetails = await response.json();

      if (!loginDetails.access_token || !loginDetails.refresh_token) {
        throw new Error("Fetched login details are incomplete.");
      }

      const loginLoaderUrl = `/login-loader.html?access_token=${encodeURIComponent(loginDetails.access_token)}&refresh_token=${encodeURIComponent(loginDetails.refresh_token)}`;
      window.open(loginLoaderUrl, '_blank');

    } catch (error: any) {
      console.error("Login failed for account", account, error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
      });
    }
  };

  const getStatusBadge = (status: Account['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500 text-white hover:bg-green-500/80"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'credentials_generated':
        return <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Generated</Badge>;
      case 'verification_link_sent':
        return <Badge variant="secondary"><Send className="mr-1 h-3 w-3" />Link Sent</Badge>;
      case 'email_received':
        return <Badge variant="secondary"><Mail className="mr-1 h-3 w-3" />Email Received</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Account List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const isLoginReady = account.status === 'verified';
                  const isFailed = account.status === 'failed';
                  
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.id}</TableCell>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {isFailed && account.errorLog && (
                          <Button variant="outline" size="sm" onClick={() => onTroubleshoot(account.errorLog as string)}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Analyze Error
                          </Button>
                        )}
                        {isLoginReady && (
                          <Button variant="ghost" size="sm" onClick={() => handleLoginClick(account)}>
                            <LogIn className="mr-2 h-4 w-4" />
                            Login
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
