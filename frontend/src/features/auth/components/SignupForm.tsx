import React from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  return (
    <Card className="w-full max-w-md border-border/40 shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Join our chat community today
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" placeholder="John Doe" className="bg-background/50 h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="john@example.com" className="bg-background/50 h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone Number</Label>
          <Input id="phone" type="tel" placeholder="+1234567890" className="bg-background/50 h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" type="password" className="bg-background/50 h-9" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm</Label>
            <Input id="confirm-password" type="password" className="bg-background/50 h-9" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 pt-2">
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
          Create Account
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <button 
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium"
          >
            Log in
          </button>
        </p>
      </CardFooter>
    </Card>
  );
}
