import{j as n}from"./jsx-runtime-DFAAy_2V.js";import{r as a}from"./index-Bc2G9s8g.js";import{c as u}from"./cn-BLSKlp9E.js";import{B as c}from"./button--PXUDdV_.js";import"./index-EXTQMK5R.js";const s=a.forwardRef(({open:t,onClose:r,className:D,children:_,...x},h)=>{const o=a.useRef(null);a.useImperativeHandle(h,()=>o.current,[]),a.useEffect(()=>{const e=o.current;e&&(t&&!e.open?typeof e.showModal=="function"?e.showModal():e.setAttribute("open",""):!t&&e.open&&e.close())},[t]);const l=a.useCallback(e=>{e.preventDefault(),r()},[r]);return a.useEffect(()=>{const e=o.current;if(e)return e.addEventListener("cancel",l),()=>e.removeEventListener("cancel",l)},[l]),n.jsx("dialog",{ref:o,onClick:e=>{e.target===o.current&&r()},className:u("rounded-lg border border-[rgb(var(--ud-border))] bg-[rgb(var(--ud-bg))] p-0 text-[rgb(var(--ud-fg))] shadow-xl backdrop:bg-black/50","open:animate-in open:fade-in-0",D),...x,children:n.jsx("div",{className:"p-6",children:_})})});s.displayName="Dialog";function d({children:t,className:r}){return n.jsx("h2",{className:u("mb-2 text-lg font-semibold",r),children:t})}function p({children:t,className:r}){return n.jsx("p",{className:u("mb-4 text-sm text-[rgb(var(--ud-muted-fg))]",r),children:t})}try{d.displayName="DialogTitle",d.__docgenInfo={description:"",displayName:"DialogTitle",props:{className:{defaultValue:null,description:"",name:"className",required:!1,type:{name:"string"}}}}}catch{}try{p.displayName="DialogDescription",p.__docgenInfo={description:"",displayName:"DialogDescription",props:{className:{defaultValue:null,description:"",name:"className",required:!1,type:{name:"string"}}}}}catch{}try{s.displayName="Dialog",s.__docgenInfo={description:"",displayName:"Dialog",props:{open:{defaultValue:null,description:"",name:"open",required:!0,type:{name:"boolean"}},onClose:{defaultValue:null,description:"",name:"onClose",required:!0,type:{name:"() => void"}}}}}catch{}const C={title:"Components/Dialog",component:s},i={render:()=>{const[t,r]=a.useState(!1);return n.jsxs(n.Fragment,{children:[n.jsx(c,{onClick:()=>r(!0),children:"Open dialog"}),n.jsxs(s,{open:t,onClose:()=>r(!1),children:[n.jsx(d,{children:"Confirm action"}),n.jsx(p,{children:"This action cannot be undone."}),n.jsxs("div",{className:"flex justify-end gap-2",children:[n.jsx(c,{variant:"ghost",onClick:()=>r(!1),children:"Cancel"}),n.jsx(c,{variant:"destructive",onClick:()=>r(!1),children:"Delete"})]})]})]})}};var f,m,g;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = useState(false);
    return <>\r
        <Button onClick={() => setOpen(true)}>Open dialog</Button>\r
        <Dialog open={open} onClose={() => setOpen(false)}>\r
          <DialogTitle>Confirm action</DialogTitle>\r
          <DialogDescription>This action cannot be undone.</DialogDescription>\r
          <div className="flex justify-end gap-2">\r
            <Button variant="ghost" onClick={() => setOpen(false)}>\r
              Cancel\r
            </Button>\r
            <Button variant="destructive" onClick={() => setOpen(false)}>\r
              Delete\r
            </Button>\r
          </div>\r
        </Dialog>\r
      </>;
  }
}`,...(g=(m=i.parameters)==null?void 0:m.docs)==null?void 0:g.source}}};const k=["Default"];export{i as Default,k as __namedExportsOrder,C as default};
