import {
	type CSSProperties,
	type RefObject,
	type UIEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { LogItem } from "../types";
import { EVENT_LOG_ROW_HEIGHT_PX } from "../constants";
import { LogEntry } from "./LogEntry";

const EVENT_LOG_OVERSCAN_ROWS = 8;

interface EventLogVirtualListProps {
	items: LogItem[];
	highlightedLogId: string | null;
	onOpenDetail: (id: string, anchorId: string) => void;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	onScroll?: () => void;
	className?: string;
	style?: CSSProperties;
}

export default function EventLogVirtualList({
	items,
	highlightedLogId,
	onOpenDetail,
	scrollContainerRef,
	onScroll,
	className,
	style,
}: EventLogVirtualListProps) {
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);

	const syncViewportMetrics = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		setScrollTop(container.scrollTop);
		setViewportHeight(container.clientHeight);
	}, [scrollContainerRef]);

	useEffect(() => {
		syncViewportMetrics();
		const container = scrollContainerRef.current;
		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver(() => {
			syncViewportMetrics();
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [scrollContainerRef, syncViewportMetrics]);

	useEffect(() => {
		syncViewportMetrics();
	}, [items.length, syncViewportMetrics]);

	const handleScroll = useCallback(
		(_event: UIEvent<HTMLDivElement>) => {
			syncViewportMetrics();
			onScroll?.();
		},
		[onScroll, syncViewportMetrics],
	);

	const totalHeight = items.length * EVENT_LOG_ROW_HEIGHT_PX;
	const visibleRange = useMemo(() => {
		if (items.length === 0) {
			return { startIndex: 0, endIndex: -1 };
		}

		const safeViewportHeight =
			viewportHeight > 0
				? viewportHeight
				: EVENT_LOG_ROW_HEIGHT_PX * (EVENT_LOG_OVERSCAN_ROWS * 2);
		const startIndex = Math.max(
			0,
			Math.floor(scrollTop / EVENT_LOG_ROW_HEIGHT_PX) - EVENT_LOG_OVERSCAN_ROWS,
		);
		const endIndex = Math.min(
			items.length - 1,
			Math.ceil((scrollTop + safeViewportHeight) / EVENT_LOG_ROW_HEIGHT_PX) +
				EVENT_LOG_OVERSCAN_ROWS,
		);
		return { startIndex, endIndex };
	}, [items.length, scrollTop, viewportHeight]);

	const virtualItems = useMemo(() => {
		if (visibleRange.endIndex < visibleRange.startIndex) {
			return [];
		}
		return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
	}, [items, visibleRange.endIndex, visibleRange.startIndex]);

	return (
		<div
			ref={scrollContainerRef}
			onScroll={handleScroll}
			className={className}
			style={style}
		>
			<div
				className="relative px-3"
				style={{ height: `${Math.max(totalHeight, viewportHeight)}px` }}
			>
				{virtualItems.map((item, index) => {
					const actualIndex = visibleRange.startIndex + index;
					const anchorId = `log-item-${item.id}`;
					return (
						<div
							key={item.id}
							className={actualIndex > 0 ? "absolute inset-x-0 border-t border-border/60" : "absolute inset-x-0"}
							style={{
								top: `${actualIndex * EVENT_LOG_ROW_HEIGHT_PX}px`,
								height: `${EVENT_LOG_ROW_HEIGHT_PX}px`,
							}}
						>
							<LogEntry
								item={item}
								anchorId={anchorId}
								highlighted={highlightedLogId === item.id}
								onOpenDetail={onOpenDetail}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}
