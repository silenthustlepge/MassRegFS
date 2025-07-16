"use client";

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { PlayCircle } from 'lucide-react';

const formSchema = z.object({
  signupCount: z.coerce.number().min(1, 'Please enter at least 1.').max(100, 'Cannot exceed 100.'),
});

interface SignupControlPanelProps {
  onStartProcess: (count: number) => void;
  isProcessing: boolean;
}

export function SignupControlPanel({ onStartProcess, isProcessing }: SignupControlPanelProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      signupCount: 10,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    onStartProcess(values.signupCount);
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Signup Control Panel</CardTitle>
        <CardDescription>
          Set the number of signups and start the account creation process.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            <FormField
              control={form.control}
              name="signupCount"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="signupCount">Number of Signups</Label>
                  <FormControl>
                    <Input id="signupCount" type="number" placeholder="e.g., 50" {...field} disabled={isProcessing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isProcessing}>
              <PlayCircle className="mr-2 h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Start Process'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
