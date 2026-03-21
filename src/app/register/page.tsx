'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  DISTRICTS,
  ROLE_DASHBOARDS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_ICONS,
  PUBLIC_ROLES,
  type UserRole
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '' as UserRole | '',
    district: '',
    address: '',
    organisationName: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.role) {
      setError('Please select a role')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: formData.fullName,
          role: formData.role,
          district: formData.district,
          address: formData.address,
          organisation_name: formData.organisationName,
          phone: formData.phone,
          is_approved: true,
        })

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      router.push(ROLE_DASHBOARDS[formData.role as UserRole])
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Smart Waste Management</h1>
          <p className="text-slate-500 text-sm mt-1">Colombo Municipal Council</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800">Create Account</CardTitle>
            <CardDescription>
              {step === 1 ? 'Select your account type to get started' : 'Fill in your details to complete registration'}
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`}/>
              <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}/>
            </div>
          </CardHeader>

          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4">
                  Choose the account type that best describes you
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PUBLIC_ROLES.map((role) => (
                    <div
                      key={role}
                      onClick={() => setFormData({ ...formData, role })}
                      className={`
                        cursor-pointer rounded-xl border-2 p-5 transition-all
                        ${formData.role === role
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-3xl">{ROLE_ICONS[role]}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className={`font-semibold text-sm ${formData.role === role ? 'text-blue-700' : 'text-slate-800'}`}>
                              {ROLE_LABELS[role]}
                            </h3>
                            {formData.role === role && (
                              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${formData.role === role ? 'text-blue-600' : 'text-slate-500'}`}>
                            {ROLE_DESCRIPTIONS[role]}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 text-center">
                    🔒 Accounts for CMC staff, contractors, recyclers and facility operators
                    are created by the system administrator
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                    {error}
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (!formData.role) {
                      setError('Please select an account type')
                      return
                    }
                    setError('')
                    setStep(2)
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
                  <span className="text-xl">{ROLE_ICONS[formData.role as UserRole]}</span>
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      {ROLE_LABELS[formData.role as UserRole]}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      Change account type
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    placeholder="Your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                {formData.role === 'commercial_establishment' && (
                  <div className="space-y-2">
                    <Label htmlFor="organisationName">Organisation / Business name</Label>
                    <Input
                      id="organisationName"
                      placeholder="Your business name"
                      value={formData.organisationName}
                      onChange={(e) => setFormData({ ...formData, organisationName: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    placeholder="+94 77 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repeat password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>District</Label>
                  <Select onValueChange={(value) => setFormData({ ...formData, district: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your district" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>{district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Your full address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="justify-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}