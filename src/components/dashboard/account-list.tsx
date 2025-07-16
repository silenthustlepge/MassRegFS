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
import { Clock, CheckCircle2, XCircle, LogIn, Wrench, FileText } from 'lucide-react';
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
    // The button is disabled if these are missing, but this is a safeguard.
    if (!account.access_token || !account.refresh_token) {
      console.error("Missing login details for account", account);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Access or refresh token is missing for this account.",
      });
      return;
    }

    // Generate the loader URL with the tokens
    const loginLoaderUrl = `/login-loader.html?access_token=${encodeURIComponent(account.access_token)}&refresh_token=${encodeURIComponent(account.refresh_token)}`;
    
    // Open the new tab
    window.open(loginLoaderUrl, '_blank');
  };

  const getStatusBadge = (status: Account['status']) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-accent text-accent-foreground hover:bg-accent/80"><CheckCircle2 className="mr-1 h-3 w-3" />Verified</Badge>;
      case 'created':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Created</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
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
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const isLoginReady = account.status === 'verified' && account.access_token && account.refresh_token;
                  
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.id}</TableCell>
                      <TableCell>{account.username}</TableCell>
                      <TableCell>{getStatusBadge(account.status)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {account.status === 'failed' && account.errorLog && (
                          <Button variant="outline" size="sm" onClick={() => onTroubleshoot(account.errorLog as string)}>
                            <Wrench className="mr-2 h-4 w-4" />
                            Analyze Error
                          </Button>
                        )}
                        {account.status === 'verified' && (
                          <Button variant="ghost" size="sm" onClick={() => handleLoginClick(account)} disabled={!isLoginReady}>
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