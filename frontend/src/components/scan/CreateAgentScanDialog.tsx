import CreateProjectScanDialog from "./CreateProjectScanDialog";
import { useNavigate } from "react-router-dom";

interface CreateAgentScanDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onTaskCreated?: () => void;
	preselectedProjectId?: string;
	navigateOnSuccess?: boolean;
	showReturnButton?: boolean;
	onReturn?: () => void;
}

export default function CreateAgentScanDialog(props: CreateAgentScanDialogProps) {
	const navigate = useNavigate();
	return (
		<CreateProjectScanDialog
			{...props}
			initialMode="agent"
			lockMode
				allowUploadProject
				createButtonVariant="dual"
				primaryCreateLabel="创建并跳转"
				secondaryCreateLabel="创建并返回"
				onSecondaryCreateSuccess={() => navigate("/projects#quick-actions")}
			/>
		);
}
