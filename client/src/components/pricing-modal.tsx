
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Building2, Sparkles, TrendingUp } from "lucide-react";
import { PRICING_TIERS } from "@shared/pricing";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
}

export function PricingModal({ isOpen, onClose, currentTier = 'FREE_TRIAL' }: PricingModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'starter': return Zap;
      case 'creator': return Sparkles;
      case 'pro': return Crown;
      case 'enterprise': return Building2;
      default: return Sparkles;
    }
  };

  const handleUpgrade = (tierId: string) => {
    // TODO: Implement Stripe/payment integration
    console.log(`Upgrading to ${tierId}`);
    alert(`Payment integration coming soon! You selected: ${PRICING_TIERS[tierId as keyof typeof PRICING_TIERS].name}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center mb-4">
            Choose Your Plan
          </DialogTitle>
          <p className="text-center text-muted-foreground mb-6">
            Start with a 30-day free trial. No credit card required.
          </p>
        </DialogHeader>

        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border p-1">
            <Button
              variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === 'annual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingCycle('annual')}
            >
              Annual
              <Badge variant="secondary" className="ml-2">Save 20%</Badge>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(PRICING_TIERS).map(([key, tier]) => {
            if (key === 'FREE_TRIAL') return null; // Don't show free trial in pricing
            
            const Icon = getTierIcon(key);
            const isCurrentTier = key === currentTier;
            const monthlyPrice = tier.price || 0;
            const annualTotal = Math.round(monthlyPrice * 12 * 0.8); // 20% discount
            const annualMonthlyEquivalent = Math.round(annualTotal / 12);
            
            const displayPrice = billingCycle === 'annual' ? annualTotal : monthlyPrice;
            const showAnnualSavings = billingCycle === 'annual' && tier.price;

            return (
              <Card
                key={key}
                className={`p-6 relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                {(tier as any).limitedTime && (
                  <Badge variant="destructive" className="absolute -top-3 right-4">
                    Limited Time
                  </Badge>
                )}
                {(tier as any).spotsRemaining && (
                  <div className="text-xs text-center mb-2 text-orange-500 font-semibold">
                    ⚡ Only {(tier as any).spotsRemaining} spots left!
                  </div>
                )}

                <div className="text-center mb-6">
                  <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <h3 className="font-bold text-xl mb-2">{tier.name}</h3>
                  <div className="mb-4">
                    {tier.price !== null ? (
                      <>
                        <span className="text-4xl font-bold">${displayPrice}</span>
                        <span className="text-muted-foreground">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                        {showAnnualSavings && (
                          <div className="text-sm text-muted-foreground mt-1">
                            ${annualMonthlyEquivalent}/mo billed annually
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-2xl font-bold">Custom</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                  disabled={isCurrentTier}
                  onClick={() => handleUpgrade(key)}
                >
                  {isCurrentTier ? 'Current Plan' : tier.price === null ? 'Contact Sales' : 'Upgrade'}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 space-y-4">
          {/* Credit Packs Section */}
          <div className="border-t pt-6">
            <h3 className="text-xl font-bold text-center mb-4">Need More? Buy Credit Packs</h3>
            <p className="text-center text-sm text-muted-foreground mb-6">
              One-time purchases that never expire. Stack with your subscription!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Starter Pack', price: 9, credits: 100, bonus: 0 },
                { name: 'Standard Pack', price: 19, credits: 250, bonus: 25, popular: true },
                { name: 'Premium Pack', price: 49, credits: 750, bonus: 150 },
                { name: 'Ultimate Pack', price: 99, credits: 1800, bonus: 450 }
              ].map((pack) => (
                <Card key={pack.name} className={`p-4 ${pack.popular ? 'border-primary shadow-lg' : ''}`}>
                  {pack.popular && (
                    <Badge className="mb-2">Best Value</Badge>
                  )}
                  <div className="text-center">
                    <h4 className="font-semibold mb-1">{pack.name}</h4>
                    <div className="text-3xl font-bold mb-2">${pack.price}</div>
                    <div className="text-sm text-muted-foreground mb-3">
                      {pack.credits} credits
                      {pack.bonus > 0 && (
                        <div className="text-primary font-medium">+{pack.bonus} bonus!</div>
                      )}
                    </div>
                    <Button size="sm" className="w-full">
                      Purchase
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Credits Pricing Reference */}
          <Card className="p-4 bg-muted/50">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              What Credits Buy
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">1 Video Generation:</span> 10 credits
              </div>
              <div>
                <span className="font-medium">1 AI Generation:</span> 5 credits
              </div>
              <div>
                <span className="font-medium">1GB Storage/month:</span> 2 credits
              </div>
              <div>
                <span className="font-medium">1 Processing Minute:</span> 1 credit
              </div>
            </div>
          </Card>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>All plans include 30-day money-back guarantee</p>
            <p className="mt-2">Credits never expire • Stack unlimited packs</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
