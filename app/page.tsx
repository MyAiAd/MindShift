import React from 'react'
import Image from 'next/image'
import { Brain, Target, TrendingUp, Users, Sparkles, ArrowRight } from 'lucide-react'
import MobileAuthControl from '@/components/auth/MobileAuthControl'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <Image src="/logo.jpg" alt="MindShifting Logo" width={32} height={32} className="h-8 w-8 rounded" priority />
              <span className="text-2xl font-bold text-foreground">MindShifting</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="/features" className="text-muted-foreground hover:text-primary transition-colors">Features</a>
              <a href="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</a>
              <a href="/about" className="text-muted-foreground hover:text-primary transition-colors">About</a>
              <a href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
            </nav>
            <div className="flex items-center">
              {/* Mobile: Compact auth control */}
              <div className="md:hidden">
                <MobileAuthControl />
              </div>
              {/* Desktop: Traditional buttons */}
              <div className="hidden md:flex space-x-4">
                <a href="/auth" className="text-muted-foreground hover:text-primary transition-colors">Sign In</a>
                <a href="/auth" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
              Transform Your <span className="text-primary">Mindset</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Harness the power of AI to overcome limiting beliefs, achieve personal growth, 
              and unlock your true potential with personalized coaching and insights.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/auth" className="bg-primary text-primary-foreground px-8 py-4 rounded-lg hover:bg-primary/90 transition-colors text-lg font-semibold flex items-center justify-center">
              Start Your Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a href="/dashboard" className="border border-border text-foreground px-8 py-4 rounded-lg hover:bg-accent transition-colors text-lg font-semibold">
              View Demo
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Powerful Features for Personal Growth
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to transform your mindset and achieve your goals
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <Brain className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">AI-Powered Analysis</h3>
              <p className="text-muted-foreground">
                Advanced AI algorithms analyze your thoughts, behaviors, and patterns to provide personalized insights.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <Target className="h-12 w-12 text-accent mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Goal Achievement</h3>
              <p className="text-muted-foreground">
                Set meaningful goals and receive AI-guided strategies to overcome obstacles and achieve success.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <TrendingUp className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Progress Tracking</h3>
              <p className="text-muted-foreground">
                Monitor your growth journey with detailed analytics and visualizations of your transformation.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <Users className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Community Support</h3>
              <p className="text-muted-foreground">
                Connect with like-minded individuals on similar journeys and share experiences.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <Sparkles className="h-12 w-12 text-accent mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Personalized Coaching</h3>
              <p className="text-muted-foreground">
                Receive tailored recommendations and coaching based on your unique personality and goals.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow">
              <Brain className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Mindset Transformation</h3>
              <p className="text-muted-foreground">
                Transform limiting beliefs into empowering thoughts through proven psychological techniques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Choose Your Transformation Level
            </h2>
            <p className="text-xl text-muted-foreground">
                              Start with Problem Shifting or unlock the complete MindShifting experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Level 1 Plan */}
            <div className="bg-card rounded-xl shadow-lg p-8 border border-border flex flex-col h-full">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Target className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Problem Shifting</h3>
                <p className="text-muted-foreground">Perfect for getting started with mindset transformation</p>
              </div>
              
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-foreground">$29</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">$299/year (save $49)</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Core Problem Shifting methodology</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Basic assessments and progress tracking</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Up to 5 coaching sessions per month</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Email support</span>
                </li>
              </ul>
              
              <a href="/auth" className="block w-full bg-primary text-primary-foreground text-center py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors font-semibold mt-auto">
                Start Problem Shifting
              </a>
            </div>

            {/* Level 2 Plan */}
            <div className="bg-card rounded-xl shadow-lg p-8 border-2 border-primary relative flex flex-col h-full">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                  <Brain className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Complete MindShifting</h3>
                <p className="text-muted-foreground">Full access to all methodologies and premium features</p>
              </div>
              
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-foreground">$49</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">$499/year (save $89)</p>
              </div>
              
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">All transformation methodologies</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">AI-powered insights and recommendations</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Unlimited coaching sessions</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Advanced analytics and reporting</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Team management and collaboration</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-foreground">Priority support</span>
                </li>
              </ul>
              
              <a href="/auth" className="block w-full bg-primary text-primary-foreground text-center py-3 px-6 rounded-lg hover:bg-primary/90 transition-colors font-semibold mt-auto">
                Start Complete Access
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Transform Your Mind?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of others who have already started their journey to personal growth and success.
          </p>
          <a href="/auth" className="inline-block bg-background text-foreground px-8 py-4 rounded-lg hover:bg-background/90 transition-colors text-lg font-semibold">
            Start Your Free Trial
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">MindShifting</span>
              </div>
              <p className="text-muted-foreground">
                AI-powered mindset transformation for personal growth and success.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-muted-foreground">
                            <p>&copy; 2025 MindShifting. All rights reserved. Built with ❤️ by <a href="https://MyAi.ad" className="text-blue-600 hover:text-blue-700">MyAi</a>.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 