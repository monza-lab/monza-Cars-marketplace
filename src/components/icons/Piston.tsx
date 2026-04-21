import type { SVGProps } from "react"

export function Piston({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="7" y="3" width="10" height="8" rx="1.5" />
      <path d="M9 11 V16" />
      <path d="M15 11 V16" />
      <circle cx="12" cy="19" r="2" />
      <path d="M10.6 17.7 L9.8 16.2" />
      <path d="M13.4 17.7 L14.2 16.2" />
    </svg>
  )
}
