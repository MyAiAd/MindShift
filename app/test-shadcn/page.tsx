'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestShadcnPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-2">shadcn/ui Component Test</h1>
        <p className="text-muted-foreground mb-8">Testing Button and Card components from shadcn/ui</p>

        {/* Test Card 1 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Button Variants</CardTitle>
            <CardDescription>All available button styles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Card 2 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Button Sizes</CardTitle>
            <CardDescription>Different size options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">🎨</Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Card 3 */}
        <Card>
          <CardHeader>
            <CardTitle>Card Component Test</CardTitle>
            <CardDescription>This is a test of the Card component from shadcn/ui</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-4">
              If you can see this card with proper styling, the shadcn/ui components are working correctly!
            </p>
            <Button onClick={() => alert('Button works!')}>Click Me</Button>
          </CardContent>
        </Card>

        {/* Verification Message */}
        <div className="mt-12 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="text-lg font-semibold text-green-900 mb-2">✅ Setup Complete!</h2>
          <p className="text-green-800">
            shadcn/ui has been successfully initialized and components are working. 
            Next step: Verify v4 voice functionality is not affected.
          </p>
        </div>
      </div>
    </div>
  )
}
