import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
	title: 'Sign In | AuditToPitch Pro',
}

export default function LoginPage() {
	return <LoginForm />
}