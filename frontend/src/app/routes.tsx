import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import AgentAudit from "@/pages/AgentAudit";
import AdminDashboard from "@/pages/AdminDashboard";
// import Account from "@/pages/Account";
import AuditRules from "@/pages/AuditRules";
import OpengrepRules from "@/pages/OpengrepRules";
import StaticAnalysis from "@/pages/StaticAnalysis";
import type { ReactNode } from "react";

export interface RouteConfig {
    name: string;
    path: string;
    element: ReactNode;
    visible?: boolean;
}

const routes: RouteConfig[] = [
    {
        name: "首页",
        path: "/",
        element: <AgentAudit />,
        visible: true,
    },
    {
        name: "Agent审计任务",
        path: "/agent-audit/:taskId",
        element: <AgentAudit />,
        visible: false,
    },
    {
        name: "仪表盘",
        path: "/dashboard",
        element: <Dashboard />,
        visible: true,
    },
    {
        name: "项目管理",
        path: "/projects",
        element: <Projects />,
        visible: true,
    },
    {
        name: "审计规则",
        path: "/audit-rules",
        element: <AuditRules />,
        visible: true,
    },
    {
        name: "Opengrep规则",
        path: "/opengrep-rules",
        element: <OpengrepRules />,
        visible: true,
    },
    {
        name: "静态分析结果",
        path: "/static-analysis/:taskId",
        element: <StaticAnalysis />,
        visible: false,
    },
    {
        name: "系统管理",
        path: "/admin",
        element: <AdminDashboard />,
        visible: true,
    },
];

export default routes;
