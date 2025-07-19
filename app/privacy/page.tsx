// ===============================================
// PRIVACY POLICY PAGE
// ===============================================
// GDPR-compliant privacy policy for EU/German markets

import React from 'react';
import Link from 'next/link';
import { Brain, Shield, Lock, Eye, FileText, Clock, Globe, Mail } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Brain className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-900">MindShifting</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-indigo-600 transition-colors">
                Home
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-indigo-600 transition-colors">
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            We respect your privacy and are committed to protecting your personal data. 
            This privacy policy explains how we collect, use, and protect your information.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="privacy-notice mb-8">
          <h3 className="flex items-center space-x-2 mb-2">
            <Eye className="h-5 w-5" />
            <span>Quick Summary</span>
          </h3>
          <p>
            We collect minimal personal data necessary to provide our services. You have full control 
            over your data and can request access, correction, or deletion at any time. We never sell 
            your personal information to third parties.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* 1. Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <FileText className="h-6 w-6 text-indigo-600" />
              <span>1. Introduction</span>
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                MindShifting ("we", "our", or "us") is committed to protecting and respecting your privacy. 
                This privacy policy explains how we collect, use, disclose, and safeguard your 
                information when you use our website and services.
              </p>
              <p>
                This policy applies to all users of our services, regardless of location, but 
                includes specific provisions for users in the European Union (EU) and European 
                Economic Area (EEA) to comply with the General Data Protection Regulation (GDPR).
              </p>
            </div>
          </section>

          {/* 2. Data Controller */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Globe className="h-6 w-6 text-indigo-600" />
              <span>2. Data Controller</span>
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                For the purposes of GDPR, MindShifting is the data controller of your personal information. 
                You can contact us at:
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="mb-2"><strong>MindShifting</strong></p>
                <p className="mb-2">Email: <a href="mailto:privacy@myai.com" className="text-indigo-600 hover:text-indigo-700">privacy@myai.com</a></p>
                <p className="mb-2">Data Protection Officer: <a href="mailto:dpo@myai.com" className="text-indigo-600 hover:text-indigo-700">dpo@myai.com</a></p>
              </div>
            </div>
          </section>

          {/* 3. Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Lock className="h-6 w-6 text-indigo-600" />
              <span>3. Information We Collect</span>
            </h2>
            <div className="prose prose-gray max-w-none">
              <h3>3.1 Personal Information</h3>
              <p>We collect the following types of personal information:</p>
              <ul>
                <li><strong>Account Information:</strong> Name, email address, password (encrypted)</li>
                <li><strong>Profile Information:</strong> Optional biography, preferences, accessibility settings</li>
                <li><strong>Usage Information:</strong> How you interact with our services, feature usage</li>
                <li><strong>Communication Data:</strong> Messages you send to us, support requests</li>
                <li><strong>Payment Information:</strong> Billing address, payment method (processed by Stripe)</li>
              </ul>

              <h3>3.2 Technical Information</h3>
              <ul>
                <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
                <li><strong>Log Information:</strong> IP address, access times, pages visited</li>
                <li><strong>Cookies:</strong> Session cookies, preference cookies, analytics cookies</li>
                <li><strong>Location Information:</strong> Country/region for legal compliance</li>
              </ul>

              <h3>3.3 Legal Basis for Processing</h3>
              <p>We process your personal data based on:</p>
              <ul>
                <li><strong>Contract:</strong> To provide our services and fulfill our obligations</li>
                <li><strong>Consent:</strong> For marketing communications and optional features</li>
                <li><strong>Legitimate Interests:</strong> To improve our services and ensure security</li>
                <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations</li>
              </ul>
            </div>
          </section>

          {/* 4. How We Use Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. How We Use Information</h2>
            <div className="prose prose-gray max-w-none">
              <p>We use your information to:</p>
              <ul>
                <li>Provide and maintain our services</li>
                <li>Process payments and manage subscriptions</li>
                <li>Communicate with you about your account and our services</li>
                <li>Improve our services and develop new features</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
                <li>Send marketing communications (with your consent)</li>
              </ul>
            </div>
          </section>

          {/* 5. Data Sharing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
            <div className="prose prose-gray max-w-none">
              <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
              <ul>
                <li><strong>Service Providers:</strong> Third parties that help us provide our services (e.g., Stripe for payments, Supabase for database)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
              </ul>

              <h3>5.1 International Transfers</h3>
              <p>
                Some of our service providers may be located outside the EU/EEA. We ensure adequate 
                protection through appropriate safeguards such as Standard Contractual Clauses or 
                adequacy decisions.
              </p>
            </div>
          </section>

          {/* 6. Your Rights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Your Rights (GDPR)</h2>
            <div className="prose prose-gray max-w-none">
              <p>Under GDPR, you have the following rights:</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Right to Access</h4>
                  <p className="text-blue-800 text-sm">Request a copy of your personal data</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Right to Rectification</h4>
                  <p className="text-green-800 text-sm">Correct inaccurate personal data</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Right to Erasure</h4>
                  <p className="text-red-800 text-sm">Request deletion of your personal data</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Right to Portability</h4>
                  <p className="text-purple-800 text-sm">Receive your data in a structured format</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-900 mb-2">Right to Object</h4>
                  <p className="text-yellow-800 text-sm">Object to processing of your data</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-indigo-900 mb-2">Right to Restriction</h4>
                  <p className="text-indigo-800 text-sm">Limit how we use your data</p>
                </div>
              </div>
              <p className="mt-4">
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:privacy@myai.com" className="text-indigo-600 hover:text-indigo-700">
                  privacy@myai.com
                </a>
                {' '}or use the data management tools in your account settings.
              </p>
            </div>
          </section>

          {/* 7. Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Clock className="h-6 w-6 text-indigo-600" />
              <span>7. Data Retention</span>
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>We retain your personal information for the following periods:</p>
              <ul>
                <li><strong>Account Data:</strong> Until you delete your account or request deletion</li>
                <li><strong>Usage Data:</strong> Up to 2 years for service improvement</li>
                <li><strong>Payment Data:</strong> 7 years for legal and tax compliance</li>
                <li><strong>Support Communications:</strong> 3 years</li>
                <li><strong>Marketing Data:</strong> Until you withdraw consent</li>
              </ul>
              <p>
                After the retention period, we securely delete or anonymize your data unless we 
                have a legal obligation to retain it longer.
              </p>
            </div>
          </section>

          {/* 8. Security */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Security</h2>
            <div className="prose prose-gray max-w-none">
              <p>We implement appropriate technical and organizational measures to protect your data:</p>
              <ul>
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
              <p>
                While we strive to protect your personal information, no method of transmission 
                over the internet or electronic storage is 100% secure.
              </p>
            </div>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cookies and Tracking</h2>
            <div className="prose prose-gray max-w-none">
              <p>We use cookies and similar technologies to:</p>
              <ul>
                <li>Maintain your session and preferences</li>
                <li>Analyze site usage and performance</li>
                <li>Provide personalized content</li>
                <li>Remember your accessibility settings</li>
              </ul>
              <p>
                You can manage your cookie preferences through our cookie consent banner or 
                your browser settings. Essential cookies cannot be disabled as they are 
                necessary for the service to function.
              </p>
            </div>
          </section>

          {/* 10. Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Children's Privacy</h2>
            <div className="prose prose-gray max-w-none">
              <p>
                Our services are not intended for children under 16 years old. We do not 
                knowingly collect personal information from children under 16. If you believe 
                we have collected information from a child under 16, please contact us immediately.
              </p>
            </div>
          </section>

          {/* 11. Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
            <div className="prose prose-gray max-w-none">
              <p>
                We may update this privacy policy from time to time. We will notify you of 
                any changes by posting the new privacy policy on this page and updating the 
                "Last updated" date. For material changes, we will provide additional notice 
                such as email notification.
              </p>
            </div>
          </section>

          {/* 12. Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Mail className="h-6 w-6 text-indigo-600" />
              <span>12. Contact Us</span>
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                If you have any questions about this privacy policy or our data practices, 
                please contact us:
              </p>
              <div className="bg-gray-100 p-6 rounded-lg">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">General Privacy Questions</h4>
                    <p className="text-gray-700">Email: <a href="mailto:privacy@myai.com" className="text-indigo-600 hover:text-indigo-700">privacy@myai.com</a></p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Protection Officer</h4>
                    <p className="text-gray-700">Email: <a href="mailto:dpo@myai.com" className="text-indigo-600 hover:text-indigo-700">dpo@myai.com</a></p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Data Subject Rights</h4>
                    <p className="text-gray-700">Email: <a href="mailto:rights@myai.com" className="text-indigo-600 hover:text-indigo-700">rights@myai.com</a></p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">General Support</h4>
                    <p className="text-gray-700">Email: <a href="mailto:support@myai.com" className="text-indigo-600 hover:text-indigo-700">support@myai.com</a></p>
                  </div>
                </div>
              </div>
              <p className="mt-4">
                <strong>Response Time:</strong> We aim to respond to all privacy-related inquiries within 72 hours, 
                and data subject rights requests within 30 days as required by GDPR.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Brain className="h-6 w-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">MindShifting</span>
            </div>
            <p className="text-gray-600 mb-4">
              Committed to protecting your privacy and ensuring GDPR compliance.
            </p>
            <div className="flex justify-center space-x-6 text-sm">
              <Link href="/" className="text-gray-500 hover:text-indigo-600">Home</Link>
              <Link href="/contact" className="text-gray-500 hover:text-indigo-600">Contact</Link>
              <Link href="/privacy" className="text-gray-500 hover:text-indigo-600">Privacy</Link>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              © 2024 MindShifting. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
} 