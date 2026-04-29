import { GripVerticalIcon } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/shared/utils/utils";

function ResizablePanelGroup({
	className,
	...props
}: ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
	return (
		<ResizablePrimitive.PanelGroup
			data-slot="resizable-panel-group"
			className={cn(
				"flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	);
}

function ResizablePanel({
	...props
}: ComponentProps<typeof ResizablePrimitive.Panel>) {
	return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
	withHandle,
	handlePositionPx,
	className,
	style,
	...props
}: ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
	withHandle?: boolean;
	handlePositionPx?: number;
}) {
	const handleStyle = {
		...style,
		...(typeof handlePositionPx === "number"
			? {
					"--resizable-handle-position-px": `${handlePositionPx}px`,
				}
			: {}),
	} as CSSProperties;

	return (
		<ResizablePrimitive.PanelResizeHandle
			data-slot="resizable-handle"
			className={cn(
				"bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
				className,
			)}
			style={handleStyle}
			{...props}
		>
			{withHandle && (
				<div
					className={cn(
						"bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border",
						typeof handlePositionPx === "number"
							? "data-[panel-group-direction=vertical]:absolute data-[panel-group-direction=vertical]:left-[var(--resizable-handle-position-px)] data-[panel-group-direction=vertical]:top-1/2 data-[panel-group-direction=vertical]:-translate-x-1/2 data-[panel-group-direction=vertical]:-translate-y-1/2"
							: "",
					)}
				>
					<GripVerticalIcon className="size-2.5" />
				</div>
			)}
		</ResizablePrimitive.PanelResizeHandle>
	);
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
