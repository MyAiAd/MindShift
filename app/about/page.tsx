import React from 'react'
import Link from 'next/link'
import { Brain, Users, Target, Heart, Award, ArrowRight } from 'lucide-react'
import MobileAuthControl from '@/components/auth/MobileAuthControl'

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">MindShifting</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/features" className="text-gray-700 hover:text-indigo-600 transition-colors">Features</Link>
              <Link href="/pricing" className="text-gray-700 hover:text-indigo-600 transition-colors">Pricing</Link>
              <Link href="/about" className="text-indigo-600 font-medium">About</Link>
              <Link href="/contact" className="text-gray-700 hover:text-indigo-600 transition-colors">Contact</Link>
            </nav>
            <div className="flex items-center">
              {/* Mobile: Compact auth control */}
              <div className="md:hidden">
                <MobileAuthControl />
              </div>
              {/* Desktop: Traditional buttons */}
              <div className="hidden md:flex space-x-4">
                <Link href="/auth" className="text-gray-700 hover:text-indigo-600 transition-colors">Sign In</Link>
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
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Transforming <span className="text-indigo-600">Minds</span>, Changing Lives
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            We believe everyone has the potential for extraordinary growth. Our mission is to make 
            world-class mindset transformation accessible through the power of AI and human insight.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                To democratize access to world-class mindset transformation by combining cutting-edge 
                AI technology with proven psychological principles and human wisdom.
              </p>
              <p className="text-lg text-gray-600 mb-8">
                We envision a world where limiting beliefs no longer hold people back from achieving 
                their full potential, where personal growth is accessible to everyone, and where 
                technology serves humanity's deepest need for meaning and connection.
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 mb-2">10,000+</div>
                  <div className="text-gray-600">Lives Transformed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600 mb-2">95%</div>
                  <div className="text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl p-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Human-Centered</h3>
                      <p className="text-gray-600">Technology that serves human flourishing</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Evidence-Based</h3>
                      <p className="text-gray-600">Grounded in psychological research</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Accessible</h3>
                      <p className="text-gray-600">Available to everyone, everywhere</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
                <Heart className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Empathy First</h3>
              <p className="text-gray-600">
                We deeply understand the struggles of personal transformation and approach 
                every interaction with compassion and genuine care.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Excellence</h3>
              <p className="text-gray-600">
                We're committed to delivering the highest quality experience, continuously 
                improving our platform based on user feedback and scientific research.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Inclusivity</h3>
              <p className="text-gray-600">
                Personal growth is a universal right. We build our platform to be accessible 
                across cultures, languages, and socioeconomic backgrounds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Our Story
            </h2>
            <p className="text-xl text-gray-600">
              How MindShifting came to be
            </p>
          </div>

          <div className="prose prose-lg mx-auto text-gray-600">
            <p>
              MindShifting was born from a simple observation: while the science of human behavior 
              and mindset transformation has advanced tremendously, access to these insights 
              remained limited to those who could afford expensive coaching or therapy.
            </p>
            
            <p>
              Our founder, having experienced their own transformation journey, recognized that 
              millions of people struggle with limiting beliefs, self-doubt, and mental barriers 
              that prevent them from achieving their full potential. The question became: 
              How could we scale personalized, effective mindset coaching to reach everyone who needs it?
            </p>
            
            <p>
              The answer lay in combining artificial intelligence with proven psychological 
              frameworks. By training AI models on decades of research in cognitive behavioral 
              therapy, positive psychology, and neuroscience, we could create a platform that 
              provides personalized, evidence-based guidance at scale.
            </p>
            
            <p>
              Today, MindShifting serves thousands of users worldwide, helping them overcome 
              limiting beliefs, achieve their goals, and create lasting positive change in 
              their lives. But we're just getting started.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join Our Mission
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Be part of a movement that's transforming how people grow, learn, and achieve their dreams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth" className="inline-flex items-center bg-white text-indigo-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors text-lg font-semibold">
              Start Your Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link href="/contact" className="inline-flex items-center border border-white text-white px-8 py-4 rounded-lg hover:bg-white/10 transition-colors text-lg font-semibold">
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Brain className="h-6 w-6 text-indigo-400" />
                <span className="text-xl font-bold">MindShifting</span>
              </div>
              <p className="text-gray-400">
                AI-powered mindset transformation for personal growth and success.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 mt-8 text-center text-gray-400">
                          <p>&copy; 2024 MindShifting. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 