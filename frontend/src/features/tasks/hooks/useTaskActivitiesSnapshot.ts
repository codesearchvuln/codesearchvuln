import { useCallback, useEffect, useState } from "react";
import {
	getTaskActivitiesStoreState,
	loadTaskActivitiesSnapshot,
	refreshTaskActivitiesSnapshot,
	subscribeTaskActivitiesStore,
} from "@/features/tasks/services/taskActivitiesStore";

interface UseTaskActivitiesSnapshotOptions {
	autoLoad?: boolean;
	forceInitial?: boolean;
}

export function useTaskActivitiesSnapshot(
	options: UseTaskActivitiesSnapshotOptions = {},
) {
	const { autoLoad = true, forceInitial = false } = options;
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
