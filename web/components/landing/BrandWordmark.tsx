import Image from 'next/image'

export function BrandWordmark({
	width = 180,
	className = '',
}: {
	width?: number
	className?: string
}) {
	return (
		<Image
			src="/brand-wordmark.png"
			alt="AuditToPitch Pro"
			width={width}
		height={Math.round(width / 5)}
			className={`h-auto shrink-0 object-contain ${className}`}
		/>
	)
}