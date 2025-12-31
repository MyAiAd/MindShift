'use client'

import React from 'react'
import Link from 'next/link'
import { User } from 'lucide-react'

/**
 * Ultra-compact icon-only authentication button
 * Alternative to MobileAuthControl for extreme space constraints
 * Opens auth page directly without intermediate steps
 */
export default function IconAuthButton() {
  return (
    <Link
      href="/auth"
      className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-all shadow-sm"
      aria-label="Sign in or sign up"
    >
      <User className="h-5 w-5" />
    </Link>
  )
}
