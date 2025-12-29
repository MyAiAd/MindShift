import React from 'react'
import Link from 'next/link'
import { Brain, Target, TrendingUp, Users, Sparkles, ArrowRight, Zap, Shield, Globe, Clock, Award, BookOpen } from 'lucide-react'
import MobileAuthControl from '@/components/auth/MobileAuthControl'

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-foreground">MindShifting</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/features" className="text-indigo-600 font-medium">Features</Link>
              <Link href="/pricing" className="text-foreground hover:text-indigo-600 transition-colors">Pricing</Link>
              <Link href="/about" className="text-foreground hover:text-indigo-600 transition-colors">About</Link>
              <Link href="/contact" className="text-foreground hover:text-indigo-600 transition-colors">Contact</Link>
            </nav>
            <div className="flex items-center">
              {/* Mobile: Compact auth control */}
              <div className="md:hidden">
                <MobileAuthControl />
              </div>
              {/* Desktop: Traditional buttons */}
              <div className="hidden md:flex space-x-4">
                <Link href="/auth" className="text-foreground hover:text-indigo-600 transition-colors">Sign In</Link>
                <Link href="/auth" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Powerful Features for <span className="text-indigo-600">Mind Transformation</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Discover how our AI-powered platform combines cutting-edge technology with proven psychological methods 
            to create lasting mindset changes and personal growth.
          </p>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Core Capabilities
            </h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to transform your mindset and achieve your goals
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <Brain className="h-12 w-12 text-indigo-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">AI-Powered Analysis</h3>
              <p className="text-muted-foreground mb-4">
                Advanced machine learning algorithms analyze your thoughts, behaviors, and patterns to provide personalized insights and recommendations.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Natural language processing for thought analysis</li>
                <li>• Pattern recognition in behavior data</li>
                <li>• Personalized coaching recommendations</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
              <Target className="h-12 w-12 text-emerald-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Smart Goal Setting</h3>
              <p className="text-muted-foreground mb-4">
                Set meaningful goals with AI-guided strategies to overcome obstacles and achieve success through proven psychological frameworks.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• SMART goal framework integration</li>
                <li>• Obstacle prediction and mitigation</li>
                <li>• Progress tracking and adjustments</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
              <TrendingUp className="h-12 w-12 text-violet-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Progress Analytics</h3>
              <p className="text-muted-foreground mb-4">
                Monitor your growth journey with detailed analytics, visualizations, and insights into your transformation process.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Real-time progress visualization</li>
                <li>• Milestone tracking and celebrations</li>
                <li>• Trend analysis and predictions</li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100">
              <Users className="h-12 w-12 text-orange-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Team Collaboration</h3>
              <p className="text-muted-foreground mb-4">
                Work together with coaches, mentors, and team members to accelerate your growth through shared insights and support.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Shared goal tracking</li>
                <li>• Team progress dashboards</li>
                <li>• Collaborative coaching sessions</li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-100">
              <Zap className="h-12 w-12 text-amber-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Instant Insights</h3>
              <p className="text-muted-foreground mb-4">
                Get real-time feedback and insights about your mindset patterns, emotional states, and growth opportunities.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Real-time mindset analysis</li>
                <li>• Emotional state recognition</li>
                <li>• Immediate action recommendations</li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
              <BookOpen className="h-12 w-12 text-rose-600 mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-4">Learning Resources</h3>
              <p className="text-muted-foreground mb-4">
                Access a comprehensive library of evidence-based techniques, exercises, and educational content for continuous learning.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Guided meditation sessions</li>
                <li>• Cognitive behavioral exercises</li>
                <li>• Educational video content</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section className="py-20 bg-secondary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Advanced Capabilities
            </h2>
            <p className="text-xl text-muted-foreground">
              Premium features for organizations and dedicated practitioners
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Shield className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Enterprise Security</h3>
                    <p className="text-muted-foreground">
                      Bank-level security with end-to-end encryption, GDPR compliance, and SOC 2 certification to protect your sensitive data.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Globe className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Multi-Language Support</h3>
                    <p className="text-muted-foreground">
                      Access the platform in over 20 languages with culturally-adapted content and region-specific insights.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Clock className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">24/7 AI Assistant</h3>
                    <p className="text-muted-foreground">
                      Get round-the-clock support from our AI assistant for guidance, motivation, and immediate crisis support.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <Award className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Certification Programs</h3>
                    <p className="text-muted-foreground">
                      Earn recognized certifications in mindset coaching and personal development to advance your career.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-card rounded-2xl shadow-xl p-8">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">AI Coaching Session</h4>
                    <p className="text-sm text-muted-foreground">Personalized guidance in real-time</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800"><strong>AI:</strong> I've noticed you've been struggling with confidence in presentations. Let's work on reframing those limiting beliefs.</p>
                  </div>
                  <div className="bg-secondary/20 p-4 rounded-lg">
                    <p className="text-sm text-foreground"><strong>You:</strong> I always feel like everyone is judging me when I speak.</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800"><strong>AI:</strong> That's a common fear. Let's try a perspective shift exercise. What evidence do you have that people are actually judging you negatively?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Experience These Features?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Start your transformation journey today with a free trial and discover the power of AI-driven mindset coaching.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth" className="inline-flex items-center bg-card text-indigo-600 px-8 py-4 rounded-lg hover:bg-secondary transition-colors text-lg font-semibold">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link href="/contact" className="inline-flex items-center border border-white text-white px-8 py-4 rounded-lg hover:bg-card/10 transition-colors text-lg font-semibold">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border text-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="h-6 w-6 text-indigo-400" />
                <span className="text-xl font-bold">MindShifting</span>
              </div>
              <p className="text-muted-foreground">
                AI-powered mindset transformation for personal growth and success.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 mt-8 text-center text-muted-foreground">
                          <p>&copy; 2024 MindShifting. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 