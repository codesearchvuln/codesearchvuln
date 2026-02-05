import CreateProjectAuditDialog from "./CreateProjectAuditDialog";
import { useNavigate } from "react-router-dom";

interface CreateAgentAuditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onTaskCreated?: () => void;
	preselectedProjectId?: string;
	navigateOnSuccess?: boolean;
	showReturnButton?: boolean;
	onReturn?: () => void;
}

export default function CreateAgentAuditDialog(props: CreateAgentAuditDialogProps) {
	const navigate = useNavigate();
	return (
		<CreateProjectAuditDialog
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
