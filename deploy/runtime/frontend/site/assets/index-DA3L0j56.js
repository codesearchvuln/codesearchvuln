import{j as x}from"./ui-Ck71pC5n.js";import{b as u,f as h,z as p,Z as g,g as b}from"./index-D-2aXmC5.js";import{i as f,r as l}from"./vendor-Etg1BRlJ.js";import{L as _}from"./layers-CI40jgtX.js";import"./utils-CwpiAQ--.js";const c=function(){let o=!0;return function(s,r){const n=o?function(){if(r){const t=r.apply(s,arguments);return r=null,t}}:function(){};return o=!1,n}}(),m=c(void 0,function(){const o=function(){let t;try{t=Function('return (function() {}.constructor("return this")( ));')()}catch{t=window}return t},s=o(),r=s.console=s.console||{},n=["log","warn","info","error","exception","table","trace"];for(let t=0;t<n.length;t++){const e=c.constructor.prototype.bind(c),a=n[t],i=r[a]||e;e.__proto__=c.bind(c),e.toString=i.toString.bind(i),r[a]=e}});m();/**
* @license lucide-react v0.525.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/const v=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],d=u("arrow-right",v),y=[{key:"static",title:"静态扫描",intro:"规则驱动漏洞检测",icon:g,targetRoute:"/tasks/static?openCreate=1&source=home-card"},{key:"agent",title:"智能扫描",intro:"AI Agent 代码推理",icon:b,targetRoute:"/tasks/intelligent?openCreate=1&source=home-card"},{key:"hybrid",title:"混合扫描",intro:"静态分析 + AI 推理",icon:_,targetRoute:"/tasks/hybrid?openCreate=1&source=home-card"}];function E(){const o=f(),{logoSrc:s,cycleLogoVariant:r}=h(),{resolvedTheme:n}=p(),t=l.useRef(null);return l.useEffect(()=>{const e=t.current;if(!e)return;const a=()=>{var i;(i=e.contentWindow)==null||i.postMessage({type:"THEME_CHANGE",theme:n},"http://localhost:5174")};return e.addEventListener("load",a),a(),()=>e.removeEventListener("load",a)},[n]),x.jsxs("div",{className:"min-h-[100dvh] relative overflow-hidden",children:[x.jsx("div",{className:"absolute inset-0 z-10",children:x.jsx("iframe",{ref:t,src:"http://"+window.location.hostname+":5174",title:"GitNexus",className:"w-full h-full border-0 pointer-events-auto"})}),x.jsxs("div",{className:"relative z-20 w-full max-w-[1200px] mx-auto px-6 text-center pointer-events-none min-h-[100dvh] flex flex-col",children:[x.jsxs("div",{className:"flex-1 flex flex-col items-center justify-center",children:[x.jsxs("div",{className:"mb-12 flex items-center justify-center gap-5",children:[x.jsx("button",{onClick:r,className:`
                pointer-events-auto
                w-20 h-20 rounded-3xl
                border border-primary/40 bg-primary/10
                flex items-center justify-center
                shadow-[0_0_50px_rgba(59,130,246,0.5)]
                transition hover:scale-105
              `,children:x.jsx("img",{src:s,alt:"VulHunter",className:"w-16 h-16 object-contain"})}),x.jsx("h1",{className:"text-6xl font-bold tracking-wider font-mono",children:"VulHunter"})]}),x.jsx("div",{className:"mb-14",children:x.jsx("button",{onClick:()=>o("/tasks/hybrid?openCreate=1&source=home-primary"),className:`
                pointer-events-auto
                group relative px-14 py-5 text-xl font-bold text-white rounded-2xl
                bg-gradient-to-r from-blue-500 to-indigo-600
                shadow-[0_0_35px_rgba(59,130,246,0.7)]
                transition hover:scale-105 hover:shadow-[0_0_60px_rgba(59,130,246,0.9)]
              `,children:x.jsxs("span",{className:"flex items-center gap-3 justify-center",children:["一键开始安全审计",x.jsx(d,{className:"w-6 h-6 transition group-hover:translate-x-1"})]})})})]}),x.jsx("div",{className:"pb-20 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full",children:y.map(e=>{const a=e.icon;return x.jsxs("button",{onClick:()=>o(e.targetRoute),className:`
                  pointer-events-auto
                  group relative backdrop-blur-sm
                  border bg-card/60 border-border hover:bg-card
                  rounded-xl p-6 text-left transition
                  hover:border-primary/50 hover:bg-white/10 hover:-translate-y-1
                `,children:[x.jsx(d,{className:"absolute right-4 top-4 w-4 h-4 opacity-0 transition group-hover:opacity-100 group-hover:translate-x-1 text-primary"}),x.jsxs("div",{className:"flex items-center gap-3 mb-2",children:[x.jsx("div",{className:"p-2 rounded-md bg-primary/10 text-primary",children:x.jsx(a,{className:"w-5 h-5"})}),x.jsx("h3",{className:"font-semibold text-lg",children:e.title})]}),x.jsx("p",{className:"text-sm text-foreground/70",children:e.intro})]},e.key)})})]})]})}export{E as HomeScanCards,E as default};
