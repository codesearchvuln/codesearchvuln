import CreateProjectAuditDialog from "./CreateProjectAuditDialog";
import { useNavigate } from "react-router-dom";

interface CreateStaticAuditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onTaskCreated?: () => void;
	preselectedProjectId?: string;
	navigateOnSuccess?: boolean;
	showReturnButton?: boolean;
	onReturn?: () => void;
}

export default function CreateStaticAuditDialog(props: CreateStaticAuditDialogProps) {
	const navigate = useNavigate();
	return (
		<CreateProjectAuditDialog
			{...props}
			initialMode="static"
			lockMode
				allowUploadProject
				createButtonVariant="dual"
				primaryCreateLabel="创建并跳转"
				secondaryCreateLabel="创建并返回"
				onSecondaryCreateSuccess={() => navigate("/projects#quick-actions")}
			/>
		);
}
