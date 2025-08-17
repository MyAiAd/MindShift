# Stripe Integration Setup Guide

## 🚀 Quick Start

Your Stripe integration is now complete! Follow these steps to get payments working:

## 1. Create Stripe Account & Get API Keys

1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Navigate to **Developers → API Keys**
3. Copy your API keys:
   - `Publishable key` (starts with `pk_test_` for test mode)
   - `Secret key` (starts with `sk_test_` for test mode)

## 2. Set Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Site URL (for redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 3. Set Up Webhook Endpoint

1. Go to **Developers → Webhooks** in your Stripe dashboard
2. Click **Add endpoint**
3. Set the URL to: `http://localhost:3000/api/webhooks/stripe` (for development)
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`
5. Copy the **Signing secret** (starts with `whsec_`) to your `STRIPE_WEBHOOK_SECRET`

## 4. Test the Integration

1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000/dashboard/subscription`
3. Click "Start Plan" on any subscription tier
4. Use Stripe's test card: `4242 4242 4242 4242`
5. Use any future expiration date and any 3-digit CVC

## 5. Create Products in Stripe (Optional)

Your app creates products dynamically, but you can also create them manually:

1. Go to **Products** in Stripe Dashboard
2. Create products matching your subscription plans:
   - **Problem Shifting Access**: $29.99/month
   - **Complete MyAi Access**: $79.99/month

## 6. Production Setup

For production deployment:

1. Switch to **Live mode** in Stripe dashboard
2. Get your live API keys (start with `pk_live_` and `sk_live_`)
3. Update environment variables in your deployment platform
4. Update webhook URL to your production domain

## ✅ What Works Now

- ✅ Stripe Checkout for new subscriptions
- ✅ Automatic customer creation
- ✅ Webhook processing for subscription updates
- ✅ Billing portal for payment method management
- ✅ Subscription cancellation
- ✅ Success/cancel page handling
- ✅ Payment transaction recording

## 🔧 Troubleshooting

### "Payment service unavailable" error
- Check that `STRIPE_SECRET_KEY` is set correctly
- Make sure you're using the right key for your environment (test vs live)

### Webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check that webhook URL is accessible
- Ensure selected events match those listed above

### Checkout not opening
- Verify `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
- Check browser console for JavaScript errors

### Database errors
- Ensure your subscription_plans table has data
- Check that user profiles exist and are properly linked

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check your server logs
3. Verify all environment variables are set
4. Test with Stripe's test card numbers

## 🔄 Test Card Numbers

Use these for testing:
- **Success**: 4242 4242 4242 4242
- **Declined**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

All test cards use:
- Any future expiration date
- Any 3-digit CVC
- Any billing ZIP code 