import { preferencesFromMetadata } from "@/lib/account-preferences";
import type { AuthedCustomer } from "@/lib/auth";

import { CloseAccountCard } from "./close-account-card";
import { CommunicationPreferencesCard } from "./communication-preferences-card";
import { ProfileCard } from "./profile-card";
import { SignInSecurityCard } from "./sign-in-security-card";

export type AccountSettingsViewProps = {
  customer: AuthedCustomer;
};

export function AccountSettingsView({ customer }: AccountSettingsViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl text-foreground">
          Account settings
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Your details, password, and how we reach you.
        </p>
      </div>

      <ProfileCard customer={customer} />
      <SignInSecurityCard authProvider={customer.authProvider} />
      <CommunicationPreferencesCard
        initialPreferences={preferencesFromMetadata(customer.metadata)}
      />
      <CloseAccountCard />
    </div>
  );
}
