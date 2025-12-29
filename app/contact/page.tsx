import React from 'react'
import Link from 'next/link'
import { Brain, Mail, Phone, MapPin, MessageSquare, Clock, ArrowRight } from 'lucide-react'
import MobileAuthControl from '@/components/auth/MobileAuthControl'

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">MindShifting</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/features" className="text-foreground hover:text-primary transition-colors">Features</Link>
              <Link href="/pricing" className="text-foreground hover:text-primary transition-colors">Pricing</Link>
              <Link href="/about" className="text-foreground hover:text-primary transition-colors">About</Link>
              <Link href="/contact" className="text-primary font-medium">Contact</Link>
            </nav>
            <div className="flex items-center">
              {/* Mobile: Compact auth control */}
              <div className="md:hidden">
                <MobileAuthControl />
              </div>
              {/* Desktop: Traditional buttons */}
              <div className="hidden md:flex space-x-4">
                <Link href="/auth" className="text-foreground hover:text-primary transition-colors">Sign In</Link>
                <Link href="/auth" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/10">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            Get in <span className="text-primary">Touch</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                          Have questions about MindShifting? Need support? Want to discuss enterprise solutions? 
            We're here to help and would love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            
            {/* Contact Form */}
            <div className="bg-card rounded-2xl shadow-xl p-8 border">
              <h2 className="text-2xl font-bold text-foreground mb-6">Send us a message</h2>
              <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-indigo-500 focus:border-primary"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-indigo-500 focus:border-primary"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-indigo-500 focus:border-primary"
                    placeholder="john@example.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-indigo-500 focus:border-primary"
                  >
                    <option>General Inquiry</option>
                    <option>Technical Support</option>
                    <option>Enterprise Sales</option>
                    <option>Partnership</option>
                    <option>Media</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-indigo-500 focus:border-primary"
                    placeholder="Tell us how we can help you..."
                  ></textarea>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center"
                >
                  Send Message
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </form>
            </div>

            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Email Support</h3>
                      <p className="text-muted-foreground mb-2">Get help from our support team</p>
                                    <a href="mailto:support@myai.ai" className="text-primary hover:text-primary/90">
                support@myai.ai
              </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Live Chat</h3>
                      <p className="text-muted-foreground mb-2">Chat with our team in real-time</p>
                      <button className="text-primary hover:text-primary/90">
                        Start Live Chat
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Phone Support</h3>
                      <p className="text-muted-foreground mb-2">Speak with our team directly</p>
                                              <a href="tel:+1-555-MYAI-APP" className="text-primary hover:text-primary/90">
                          +1 (555) MYAI-APP
                        </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/20 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Support Hours</h3>
                </div>
                <div className="space-y-2 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span>9:00 AM - 6:00 PM PST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span>10:00 AM - 4:00 PM PST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
                <h3 className="font-semibold text-foreground mb-3">Enterprise Customers</h3>
                <p className="text-muted-foreground mb-4">
                  Need dedicated support? Our enterprise customers receive 24/7 priority support with dedicated account management.
                </p>
                <Link href="/pricing" className="text-primary hover:text-primary/90 font-medium">
                  Learn about Enterprise →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-secondary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-muted-foreground">
              Quick answers to common questions
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">How quickly will I receive a response?</h3>
              <p className="text-muted-foreground">We aim to respond to all inquiries within 24 hours during business days, and often much sooner during business hours.</p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">Do you offer phone support?</h3>
              <p className="text-muted-foreground">Yes! Phone support is available for all paid subscribers during our business hours. Enterprise customers have access to 24/7 phone support.</p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">Can I schedule a demo?</h3>
              <p className="text-muted-foreground">Absolutely! We offer personalized demos for potential enterprise customers. Contact our sales team to schedule a demo that fits your needs.</p>
            </div>

            <div className="bg-card rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-2">Is there a knowledge base?</h3>
              <p className="text-muted-foreground">Yes, we have a comprehensive help center with articles, tutorials, and video guides to help you get the most out of MyAi.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border text-foreground py-12">
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
                <li><Link href="/features" className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Help Center</a></li>
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
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