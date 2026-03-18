import { useCallback, useEffect, useMemo, useState } from "react";
import {
	getTaskActivitiesStoreState,
	loadTaskActivitiesSnapshot,
	refreshTaskActivitiesSnapshot,
	subscribeTaskActivitiesStore,
} from "@/features/tasks/services/taskActivitiesStore";

interface UseTaskActivitiesSnapshotOptions {
	autoLoad?: boolean;
	forceInitial?: boolean;
	/**
	 * 当存在运行中或待处理的任务时，以该间隔（毫秒）自动刷新数据。
	 * 所有任务均为终态时停止轮询。
	 */
	pollingIntervalMs?: number;
	idlePollingIntervalMs?: number;
}

const ACTIVE_STATUSES = new Set(["running", "pending"]);
const IDLE_POLLING_INTERVAL_MS = 60_000;

export function useTaskActivitiesSnapshot(
	options: UseTaskActivitiesSnapshotOptions = {},
) {
	const {
		autoLoad = true,
		forceInitial = false,
		pollingIntervalMs,
		idlePollingIntervalMs = IDLE_POLLING_INTERVAL_MS,
	} = options;
	const [storeState, setStoreState] = useState(() =>
		getTaskActivitiesStoreState(),
	);

	useEffect(() => {
		return subscribeTaskActivitiesStore(() => {
			setStoreState(getTaskActivitiesStoreState());
		});
	}, []);

	useEffect(() => {
		if (!autoLoad) return;
		void loadTaskActivitiesSnapshot({ force: forceInitial });
	}, [autoLoad, forceInitial]);

	const hasActiveTasks = useMemo(
		() =>
			(storeState.snapshot?.activities ?? []).some((a) =>
				ACTIVE_STATUSES.has(a.status),
			),
		[storeState.snapshot?.activities],
	);

	useEffect(() => {
		if (!pollingIntervalMs || !hasActiveTasks) return;
		const timer = window.setInterval(() => {
			void refreshTaskActivitiesSnapshot();
		}, pollingIntervalMs);
		return () => {
			window.clearInterval(timer);
		};
	}, [pollingIntervalMs, hasActiveTasks]);

	useEffect(() => {
		if (!pollingIntervalMs || hasActiveTasks) return;
		const interval = Math.max(idlePollingIntervalMs, pollingIntervalMs);
		const timer = window.setInterval(() => {
			void refreshTaskActivitiesSnapshot();
		}, interval);
		return () => {
			window.clearInterval(timer);
		};
	}, [idlePollingIntervalMs, pollingIntervalMs, hasActiveTasks]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void refreshTaskActivitiesSnapshot();
			}
		};
		const handleFocus = () => {
			void refreshTaskActivitiesSnapshot();
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleFocus);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleFocus);
		};
	}, []);

	const refresh = useCallback(() => {
		return refreshTaskActivitiesSnapshot();
	}, []);

	return {
		...storeState,
		projects: storeState.snapshot?.projects || [],
		activities: storeState.snapshot?.activities || [],
		refresh,
	};
}
