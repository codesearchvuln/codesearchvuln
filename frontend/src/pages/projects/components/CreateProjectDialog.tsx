import {
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
} from "react";
import { FileText, Package, Plus, Terminal, Upload, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateZipFile } from "@/features/projects/services";
import { REPOSITORY_PLATFORMS } from "@/shared/constants";
import type { CreateProjectForm } from "@/shared/types";
import { toast } from "sonner";
import {
	createEmptyProjectForm,
	PROJECT_ACTION_BTN_SUBTLE,
	stripArchiveSuffix,
} from "../constants";

interface CreateProjectDialogProps {
	open: boolean;
	supportedLanguages: string[];
	onOpenChange: (open: boolean) => void;
	onCreateRepositoryProject: (input: CreateProjectForm) => Promise<void>;
	onCreateZipProject: (input: CreateProjectForm, file: File) => Promise<void>;
}

function LanguageSelector({
	selectedLanguages,
	supportedLanguages,
	onToggleLanguage,
}: {
	selectedLanguages: string[];
	supportedLanguages: string[];
	onToggleLanguage: (language: string, checked: boolean) => void;
}) {
	return (
		<div className="space-y-2">
			<Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
				技术栈
			</Label>
			<div className="flex flex-wrap gap-2">
				{supportedLanguages.map((lang) => {
					const checked = selectedLanguages.includes(lang);
					return (
						<label
							key={lang}
							className={`flex items-center space-x-2 px-3 py-1.5 border cursor-pointer transition-all rounded ${
								checked
									? "border-primary bg-primary/10 text-primary"
									: "border-border hover:border-border text-muted-foreground"
							}`}
						>
							<input
								type="checkbox"
								checked={checked}
								onChange={(event) =>
									onToggleLanguage(lang, event.target.checked)
								}
								className="rounded border border-border w-3.5 h-3.5 text-primary focus:ring-0 bg-transparent"
							/>
							<span className="text-xs font-mono font-bold uppercase">
								{lang}
							</span>
						</label>
					);
				})}
			</div>
		</div>
	);
}

export default function CreateProjectDialog({
	open,
	supportedLanguages,
	onOpenChange,
	onCreateRepositoryProject,
	onCreateZipProject,
}: CreateProjectDialogProps) {
	const [form, setForm] = useState<CreateProjectForm>(createEmptyProjectForm);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [activeTab, setActiveTab] = useState<"upload" | "repository">("upload");
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!open) {
			setActiveTab("upload");
			setSelectedFile(null);
			setUploading(false);
			setUploadProgress(0);
			setForm(createEmptyProjectForm());
		}
	}, [open]);

	function updateForm(updates: Partial<CreateProjectForm>) {
		setForm((previous) => ({
			...previous,
			...updates,
		}));
	}

	function toggleLanguage(language: string, checked: boolean) {
		setForm((previous) => ({
			...previous,
			programming_languages: checked
				? [...previous.programming_languages, language]
				: previous.programming_languages.filter((item) => item !== language),
		}));
	}

	function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
		const inputElement = event.target;
		const file = event.target.files?.[0];
		if (!file) return;

		const validation = validateZipFile(file);
		if (!validation.valid) {
			toast.error(validation.error);
			return;
		}

		const autoProjectName = stripArchiveSuffix(file.name).trim();
		if (autoProjectName) {
			updateForm({ name: autoProjectName });
		}
		setSelectedFile(file);
		inputElement.value = "";
	}

	async function handleCreateRepository() {
		if (!form.name.trim()) {
			toast.error("请输入项目名称");
			return;
		}

		try {
			await onCreateRepositoryProject({
				...form,
				source_type: "repository",
			});
			onOpenChange(false);
		} catch {
			// keep dialog state for retry
		}
	}

	async function handleCreateZip() {
		if (!selectedFile) {
			toast.error("请先选择压缩包文件");
			return;
		}
		if (!form.name.trim()) {
			toast.error("请先输入项目名称");
			return;
		}

		let progressTimer: ReturnType<typeof setInterval> | null = null;
		try {
			setUploading(true);
			setUploadProgress(0);
			progressTimer = setInterval(() => {
				setUploadProgress((previous) => {
					if (previous >= 90) return previous;
					return previous + 20;
				});
			}, 120);

			await onCreateZipProject(
				{
					...form,
					source_type: "zip",
					repository_type: "other",
					repository_url: undefined,
				},
				selectedFile,
			);
			setUploadProgress(100);
			onOpenChange(false);
		} catch {
			// keep dialog state for retry
		} finally {
			if (progressTimer) {
				clearInterval(progressTimer);
			}
			setUploading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!w-[min(90vw,700px)] !max-w-none max-h-[85vh] flex flex-col p-0 gap-0 cyber-dialog border border-border rounded-lg">
				<DialogHeader className="px-6 pt-4 flex-shrink-0">
					<DialogTitle className="font-mono text-lg uppercase tracking-wider flex items-center gap-2 text-foreground">
						<Terminal className="w-5 h-5 text-primary" />
						初始化新项目
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-6">
					<Tabs
						value={activeTab}
						onValueChange={(value) =>
							setActiveTab(value as "upload" | "repository")
						}
						className="w-full"
					>
						<TabsList className="grid grid-cols-2 w-full">
							<TabsTrigger value="upload">
								<Package className="w-4 h-4" />
								上传项目
							</TabsTrigger>
							<TabsTrigger value="repository">
								<Globe className="w-4 h-4" />
								远程仓库
							</TabsTrigger>
						</TabsList>

						<TabsContent value="upload" className="flex flex-col gap-5 mt-5">
							<div className="space-y-1.5">
								<Label
									htmlFor="upload-name"
									className="font-mono font-bold uppercase text-base text-muted-foreground"
								>
									项目名称
								</Label>
								<Input
									id="upload-name"
									value={form.name}
									onChange={(event) => updateForm({ name: event.target.value })}
									placeholder="输入项目名称"
									className="h-11 text-base border-0 border-b border-border rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-primary"
								/>
							</div>

							<div className="space-y-4">
								<Label className="font-mono font-bold uppercase text-base text-muted-foreground">
									源代码
								</Label>

								{!selectedFile ? (
									<div
										className="border border-dashed border-border bg-muted/50 rounded p-6 text-center hover:bg-muted hover:border-border transition-colors cursor-pointer group"
										onClick={() => fileInputRef.current?.click()}
									>
										<Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3 group-hover:text-primary transition-colors" />
										<h3 className="text-base font-bold text-foreground uppercase mb-1">
											上传项目文件
										</h3>
										<p className="text-xs font-mono text-muted-foreground mb-3">
											最大: 500MB // 格式: .zip .tar .tar.gz .tar.bz2
											.7z .rar
										</p>
										<input
											ref={fileInputRef}
											type="file"
											accept=".zip,.tar,.tar.gz,.tar.bz2,.7z,.rar"
											onChange={handleFileSelect}
											className="hidden"
											disabled={uploading}
										/>
										<Button
											type="button"
											variant="outline"
											className="cyber-btn-outline h-8 text-xs"
											disabled={uploading}
											onClick={(event) => {
												event.stopPropagation();
												fileInputRef.current?.click();
											}}
										>
											<FileText className="w-3 h-3 mr-2" />
											选择文件
										</Button>
									</div>
								) : (
									<div className="border border-border bg-muted/50 p-4 flex items-center justify-between rounded">
										<div className="flex items-center space-x-3 overflow-hidden">
											<div className="w-10 h-10 bg-muted border border-border rounded flex items-center justify-center flex-shrink-0">
												<FileText className="w-5 h-5 text-primary" />
											</div>
											<div className="min-w-0">
												<p className="font-mono font-bold text-sm text-foreground truncate">
													{selectedFile.name}
												</p>
												<p className="font-mono text-xs text-muted-foreground">
													{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
												</p>
											</div>
										</div>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => setSelectedFile(null)}
											disabled={uploading}
											className="hover:bg-rose-500/10 hover:text-rose-400"
										>
											<Plus className="w-4 h-4 rotate-45" />
										</Button>
									</div>
								)}

								{uploading ? (
									<div className="space-y-1.5">
										<div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
											<span>上传并分析中...</span>
											<span className="text-primary">{uploadProgress}%</span>
										</div>
										<Progress
											value={uploadProgress}
											className="h-2 bg-muted [&>div]:bg-primary"
										/>
									</div>
								) : null}
							</div>

							<LanguageSelector
								selectedLanguages={form.programming_languages}
								supportedLanguages={supportedLanguages}
								onToggleLanguage={toggleLanguage}
							/>

							<div className="flex justify-end space-x-4 pt-4 border-t border-border mt-auto">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									disabled={uploading}
									className="cyber-btn-outline"
								>
									取消
								</Button>
								<Button
									onClick={handleCreateZip}
									className={PROJECT_ACTION_BTN_SUBTLE}
									disabled={!selectedFile || uploading}
								>
									{uploading ? "上传中..." : "执行创建"}
								</Button>
							</div>
						</TabsContent>

						<TabsContent
							value="repository"
							className="flex flex-col gap-5 mt-5"
						>
							<div className="grid grid-cols-2 gap-5">
								<div className="space-y-1.5">
									<Label
										htmlFor="repository-name"
										className="font-mono font-bold uppercase text-base text-muted-foreground"
									>
										项目名称
									</Label>
									<Input
										id="repository-name"
										value={form.name}
										onChange={(event) =>
											updateForm({ name: event.target.value })
										}
										placeholder="输入项目名称"
										className="h-11 text-base border-0 border-b border-border rounded-none px-0 bg-transparent focus-visible:ring-0 focus-visible:border-primary"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
										认证类型
									</Label>
									<Select
										value={form.repository_type}
										onValueChange={(value) =>
											updateForm({
												repository_type:
													value as CreateProjectForm["repository_type"],
											})
										}
									>
										<SelectTrigger className="cyber-input">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="cyber-dialog border-border">
											{REPOSITORY_PLATFORMS.map((platform) => (
												<SelectItem key={platform.value} value={platform.value}>
													{platform.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-5">
								<div className="space-y-1.5">
									<Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
										仓库地址
									</Label>
									<Input
										value={form.repository_url}
										onChange={(event) =>
											updateForm({ repository_url: event.target.value })
										}
										placeholder={
											form.repository_type === "other"
												? "git@github.com:user/repo.git"
												: "https://github.com/user/repo"
										}
										className="cyber-input"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="font-mono font-bold uppercase text-xs text-muted-foreground">
										默认分支
									</Label>
									<Input
										value={form.default_branch}
										onChange={(event) =>
											updateForm({ default_branch: event.target.value })
										}
										placeholder="main"
										className="cyber-input"
									/>
								</div>
							</div>

							<LanguageSelector
								selectedLanguages={form.programming_languages}
								supportedLanguages={supportedLanguages}
								onToggleLanguage={toggleLanguage}
							/>

							<div className="flex justify-end space-x-4 pt-4 border-t border-border">
								<Button
									variant="outline"
									onClick={() => onOpenChange(false)}
									className="cyber-btn-outline"
								>
									取消
								</Button>
								<Button
									onClick={handleCreateRepository}
									className={PROJECT_ACTION_BTN_SUBTLE}
								>
									执行创建
								</Button>
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</DialogContent>
		</Dialog>
	);
}
