import type { Metadata } from 'next'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata: Metadata = {
	title: 'Reset Password | AuditToPitch Pro',
}

export default function ForgotPasswordPage() {
	return <ForgotPasswordForm />
}
