'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { LogIn, UserPlus, X } from 'lucide-react'

/**
 * Compact mobile authentication control
 * Uses a segmented control/toggle style with 3 states: collapsed, sign-in, sign-up
 * Perfect for saving space on mobile headers
 */
export default function MobileAuthControl() {
  const [selected, setSelected] = useState<'none' | 'signin' | 'signup'>('none')

  // If collapsed, show a compact button to expand
  if (selected === 'none') {
    return (
      <button
        onClick={() => setSelected('signin')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-all text-sm font-medium shadow-sm"
        aria-label="Show authentication options"
      >
        <LogIn className="h-4 w-4" />
        <span>Auth</span>
      </button>
    )
  }

  // When expanded, show segmented control with both options
  return (
    <div className="inline-flex rounded-md border border-indigo-600 bg-white shadow-sm overflow-hidden">
      <Link
        href="/auth?mode=signin"
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all ${
          selected === 'signin'
            ? 'bg-indigo-600 text-white'
            : 'text-gray-700 hover:bg-indigo-50 active:bg-indigo-100'
        }`}
        onMouseDown={() => setSelected('signin')}
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign In</span>
      </Link>
      
      <div className="w-px bg-indigo-300" />
      
      <Link
        href="/auth?mode=signup"
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all ${
          selected === 'signup'
            ? 'bg-indigo-600 text-white'
            : 'text-gray-700 hover:bg-indigo-50 active:bg-indigo-100'
        }`}
        onMouseDown={() => setSelected('signup')}
      >
        <UserPlus className="h-3.5 w-3.5" />
        <span>Sign Up</span>
      </Link>
      
      <div className="w-px bg-indigo-300" />
      
      <button
        onClick={() => setSelected('none')}
        className="px-2 py-1.5 text-gray-500 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
        aria-label="Collapse authentication options"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
