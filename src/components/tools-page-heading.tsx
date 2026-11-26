import type {ReactNode} from 'react';

export function ToolsPageHeading({title,description,actions}:{title:string;description:string;actions?:ReactNode}){
 return <header className="tools-page-heading">
  <div><span className="section-eyebrow">AWE / INVESTMENT TOOLS</span><h1>{title}</h1><p>{description}</p></div>
  {actions&&<div className="tools-page-actions">{actions}</div>}
 </header>;
}
