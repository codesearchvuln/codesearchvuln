import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import AgentAudit from "@/pages/AgentAudit";
import AdminDashboard from "@/pages/AdminDashboard";
import ProjectDetail from "@/pages/ProjectDetail";
// import AuditRules from "@/pages/AuditRules";
import OpengrepRules from "@/pages/OpengrepRules";
import IntelligentAudit from "@/pages/IntelligentAudit";
import StaticAnalysis from "@/pages/StaticAnalysis";
import type { ReactNode } from "react";
import type { I18nKey } from "@/shared/i18n";

export interface RouteConfig {
    name: string;
    nameKey?: I18nKey;
    path: string;
    element: ReactNode;
    visible?: boolean;
}

const routes: RouteConfig[] = [
    {
        name: "首页",
        nameKey: "route.home",
        path: "/",
        element: <AgentAudit />,
        visible: true,
    },
    {
        name: "Agent审计任务",
        nameKey: "route.agentTask",
        path: "/agent-audit/:taskId",
        element: <AgentAudit />,
        visible: false,
    },
    {
        name: "仪表盘",
        nameKey: "route.dashboard",
        path: "/dashboard",
        element: <Dashboard />,
        visible: true,
    },
    {
        name: "项目管理",
        nameKey: "route.projects",
        path: "/projects",
        element: <Projects />,
        visible: true,
    },
    {
        name: "项目详情",
        nameKey: "route.projectDetail",
        path: "/projects/:id",
        element: <ProjectDetail />,
        visible: false,
    },
    {
        name: "审计规则",
        nameKey: "route.auditRules",
        path: "/opengrep-rules",
        element: <OpengrepRules />,
        visible: true,
    },
    {
        name: "智能审计",
        nameKey: "route.intelligentAudit",
        path: "/intelligent-audit",
        element: <IntelligentAudit />,
        visible: true,
    },
    {
        name: "静态分析结果",
        nameKey: "route.staticAnalysis",
        path: "/static-analysis/:taskId",
        element: <StaticAnalysis />,
        visible: false,
    },
    {
        name: "系统管理",
        nameKey: "route.admin",
        path: "/admin",
        element: <AdminDashboard />,
        visible: true,
    },
];

export default routes;
