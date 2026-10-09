'use client'

import { useEffect, useState } from 'react'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'

interface Props {
	userId: string
	userEmail?: string
}

export default function CheckoutButton({ userId, userEmail }: Props) {
	const [paddle, setPaddle] = useState<Paddle | undefined>()
	const [isLoading, setIsLoading] = useState(Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN))

	useEffect(() => {
		let isMounted = true
		const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
		const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
			? 'production'
			: 'sandbox'

		if (!token) {
			console.error('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set')
			return
		}

		void initializePaddle({ token, environment })
			.then((instance) => {
				if (isMounted) setPaddle(instance)
			})
			.catch((error: unknown) => {
				console.error('Could not initialize Paddle checkout:', error)
			})
			.finally(() => {
				if (isMounted) setIsLoading(false)
			})

		return () => {
			isMounted = false
		}
	}, [])

	const handleCheckout = () => {
		if (!paddle) return

		paddle.Checkout.open({
			items: [{ priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!, quantity: 1 }],
			customer: userEmail ? { email: userEmail } : undefined,
			customData: { userId },
			settings: { displayMode: 'overlay', theme: 'dark' },
		})
	}

	return (
		<button
			type="button"
			onClick={handleCheckout}
			disabled={isLoading || !paddle}
			className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-[#03120a] transition hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
		>
			{isLoading ? 'Loading checkout...' : 'Upgrade to Pro'}
		</button>
	)
}
