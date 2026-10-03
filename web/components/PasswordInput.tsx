'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
	const [visible, setVisible] = useState(false)
	const { className = '', ...rest } = props

	return (
		<div className="relative">
			<input {...rest} type={visible ? 'text' : 'password'} className={`${className} pr-11`} />
			<button
				type="button"
				onClick={() => setVisible((value) => !value)}
				aria-label={visible ? 'Hide password' : 'Show password'}
				className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
			>
				{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
			</button>
		</div>
	)
}
