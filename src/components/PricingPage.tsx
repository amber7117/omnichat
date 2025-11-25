import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../common/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../common/components/ui/card';

export function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '0 USDT',
      description: 'Perfect for getting started',
      features: [
        '1 Channel',
        'Basic Support',
        'Community Access',
      ],
      buttonText: 'Current Plan',
      disabled: true,
    },
    {
      name: 'Pro',
      price: '29 USDT',
      period: '/month',
      description: 'For growing businesses',
      features: [
        'Unlimited Channels',
        'Priority Support',
        'Advanced Analytics',
        'Custom Branding',
      ],
      buttonText: 'Upgrade to Pro',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations',
      features: [
        'Unlimited Channels',
        'Dedicated Support',
        'SLA',
        'On-premise Deployment',
      ],
      buttonText: 'Contact Sales',
    },
  ];

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-gray-600">Choose the plan that's right for you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card key={plan.name} className={`flex flex-col ${plan.highlight ? 'border-blue-500 shadow-lg scale-105' : ''}`}>
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="text-gray-500">{plan.period}</span>}
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant={plan.highlight ? 'default' : 'outline'}
                disabled={plan.disabled}
                onClick={() => {
                  if (!plan.disabled) {
                    // Handle upgrade logic here (e.g., redirect to Stripe)
                    alert('Redirecting to payment provider...');
                  }
                }}
              >
                {plan.buttonText}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
