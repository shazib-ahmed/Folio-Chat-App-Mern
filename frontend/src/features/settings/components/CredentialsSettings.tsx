import React from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function CredentialsSettings() {
  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input id="current-password" type="password" className="bg-background/50" placeholder="••••••••" />
        </div>
        
        <div className="border-t border-border/40 my-6" />
        
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input id="new-password" type="password" className="bg-background/50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">Confirm New Password</Label>
          <Input id="confirm-new-password" type="password" className="bg-background/50" />
        </div>
      </div>

      <div className="pt-6">
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
          Update Password
        </Button>
      </div>
      
      <p className="text-xs text-center text-muted-foreground pt-4">
        We recommend using a strong password that you don't use elsewhere.
      </p>
    </div>
  );
}
