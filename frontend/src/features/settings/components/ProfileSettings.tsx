import React from 'react';
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera } from '@fortawesome/free-solid-svg-icons';

export function ProfileSettings() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-primary/20">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <button className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <FontAwesomeIcon icon={faCamera} className="text-white text-xl" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Click the avatar to change your profile picture</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="profile-username">Username</Label>
          <Input id="profile-username" defaultValue="johndoe" className="bg-background/50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email Address</Label>
          <Input id="profile-email" type="email" defaultValue="john@example.com" className="bg-background/50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-phone">Phone Number</Label>
          <Input id="profile-phone" type="tel" defaultValue="+1 234 567 890" className="bg-background/50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-country">Country</Label>
          <Input id="profile-country" defaultValue="United States" className="bg-background/50" />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
