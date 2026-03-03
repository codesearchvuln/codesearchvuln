import { Skeleton } from "@/components/ui/skeleton";

export default function TaskRouteFallback() {
	return (
		<div className="space-y-6 p-6 bg-background min-h-screen font-mono relative">
			<div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />
			<div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10">
				{Array.from({ length: 5 }).map((_, index) => (
					<div key={index} className="cyber-card p-4 space-y-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-20" />
					</div>
				))}
			</div>
			<div className="cyber-card p-4 relative z-10 space-y-4">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-9 w-full" />
			</div>
			<div className="cyber-card p-4 relative z-10 space-y-4">
				<Skeleton className="h-5 w-44" />
				<div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
					{Array.from({ length: 2 }).map((_, index) => (
						<div
							key={index}
							className="rounded-lg border border-border/60 bg-muted/15 p-3 space-y-3"
						>
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
